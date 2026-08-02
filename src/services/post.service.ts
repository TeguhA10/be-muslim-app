import { pool } from '../config/database';
import { Post, PostComment } from '../models';

export class PostService {
  static async createPost(
    userId: string, 
    content: string, 
    mediaList: { type: 'IMAGE' | 'LINK', url: string }[] = [], 
    category: string = ''
  ) {
    // Validate category against DB; fallback to first active category
    let validCategory = category && category.trim() ? category.trim() : null;
    const catCheck = await pool.query(
      'SELECT name FROM post_categories WHERE name = $1 AND is_active = true LIMIT 1',
      [validCategory]
    );
    if (catCheck.rows.length === 0) {
      // Use first active category as fallback
      const firstCat = await pool.query(
        'SELECT name FROM post_categories WHERE is_active = true ORDER BY sort_order ASC LIMIT 1'
      );
      validCategory = firstCat.rows[0]?.name ?? 'General';
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert post
      const postRes = await client.query(
        `INSERT INTO posts (user_id, content, category)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, content, validCategory]
      );
      const newPost = postRes.rows[0];

      // Insert media
      if (mediaList && mediaList.length > 0) {
        for (const media of mediaList) {
          await client.query(
            `INSERT INTO post_media (post_id, media_type, url)
             VALUES ($1, $2, $3)`,
            [newPost.id, media.type, media.url]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch complete post data
      const fullRes = await pool.query(
        `SELECT 
           p.id, 
           p.user_id, 
           p.content, 
           p.image_url, 
           p.category,
           p.created_at,
           u.name AS author_name,
           u.avatar_url AS author_avatar,
           0::INT AS likes_count,
           0::INT AS comments_count,
           false AS is_liked_by_me,
           false AS is_bookmarked_by_me,
           COALESCE(
             (
               SELECT json_agg(
                 json_build_object('id', pm.id, 'media_type', pm.media_type, 'url', pm.url)
               ) 
               FROM post_media pm 
               WHERE pm.post_id = p.id
             ), 
             '[]'::json
           ) AS media_urls
         FROM posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.id = $1`,
        [newPost.id]
      );

      return fullRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getFeed(
    currentUserId?: string,
    limit = 20,
    offset = 0,
    sort: 'terbaru' | 'terpopuler' | 'paling_banyak_diskusi' = 'terbaru',
    media: 'semua' | 'gambar_saja' = 'semua',
    search = '',
    category = 'semua',
    followingOnly = false,
    authorId?: string
  ) {
    const params: any[] = [currentUserId || null];
    let paramIndex = 2;

    let whereClause = 'WHERE 1=1';

    if (authorId) {
      whereClause += ` AND p.user_id = $${paramIndex}`;
      params.push(authorId);
      paramIndex++;
    }

    if (followingOnly) {
      if (currentUserId) {
        whereClause += ` AND p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $${paramIndex})`;
        params.push(currentUserId);
        paramIndex++;
      } else {
        whereClause += ` AND 1=0`;
      }
    }

    if (media === 'gambar_saja') {
      whereClause += ` AND ((p.image_url IS NOT NULL AND p.image_url != '') OR EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.id AND pm.url IS NOT NULL AND pm.url != ''))`;
    }

    if (category && category !== 'semua') {
      const catList = category.split(',').map((c) => c.trim()).filter(Boolean);
      if (catList.length === 1) {
        whereClause += ` AND p.category = $${paramIndex}`;
        params.push(catList[0]);
        paramIndex++;
      } else if (catList.length > 1) {
        whereClause += ` AND p.category = ANY($${paramIndex}::text[])`;
        params.push(catList);
        paramIndex++;
      }
    }

    if (search && search.trim()) {
      whereClause += ` AND (p.content ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const sortList = (sort || 'terbaru').split(',').map((s) => s.trim()).filter(Boolean);
    const orderParts: string[] = [];

    if (sortList.includes('terpopuler')) {
      orderParts.push('likes_count DESC');
    }
    if (sortList.includes('paling_banyak_diskusi')) {
      orderParts.push('comments_count DESC');
    }
    if (sortList.includes('terbaru') || orderParts.length === 0) {
      orderParts.push('p.created_at DESC');
    } else {
      orderParts.push('p.created_at DESC');
    }

    const orderByClause = `ORDER BY ${orderParts.join(', ')}`;

    const limitParamIndex = paramIndex;
    params.push(limit);
    paramIndex++;

    const offsetParamIndex = paramIndex;
    params.push(offset);

    const query = `
      SELECT 
        p.id, 
        p.user_id, 
        p.content, 
        p.image_url, 
        p.category,
        p.created_at,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        COUNT(DISTINCT pl.id)::INT AS likes_count,
        COUNT(DISTINCT pc.id)::INT AS comments_count,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) AS is_liked_by_me,
        EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id = p.id AND user_id = $1) AS is_bookmarked_by_me,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', pm.id, 'media_type', pm.media_type, 'url', pm.url)
            ) 
            FROM post_media pm 
            WHERE pm.post_id = p.id
          ), 
          '[]'::json
        ) AS media_urls
      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN post_likes pl ON pl.post_id = p.id
      LEFT JOIN post_comments pc ON pc.post_id = p.id
      ${whereClause}
      GROUP BY p.id, u.id
      ${orderByClause}
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const res = await pool.query(query, params);
    return res.rows;
  }

  static async toggleLike(userId: string, postId: string) {
    const existing = await pool.query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      return { liked: false };
    } else {
      await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
      return { liked: true };
    }
  }

  static async toggleBookmark(userId: string, postId: string) {
    const existing = await pool.query(
      'SELECT id FROM post_bookmarks WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM post_bookmarks WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      return { bookmarked: false };
    } else {
      await pool.query('INSERT INTO post_bookmarks (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
      return { bookmarked: true };
    }
  }

  static async getBookmarks(userId: string, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, 
        p.user_id, 
        p.content, 
        p.image_url, 
        p.created_at,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        COUNT(DISTINCT pl.id)::INT AS likes_count,
        COUNT(DISTINCT pc.id)::INT AS comments_count,
        EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) AS is_liked_by_me,
        true AS is_bookmarked_by_me,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', pm.id, 'media_type', pm.media_type, 'url', pm.url)
            ) 
            FROM post_media pm 
            WHERE pm.post_id = p.id
          ), 
          '[]'::json
        ) AS media_urls
      FROM post_bookmarks pb
      JOIN posts p ON p.id = pb.post_id
      JOIN users u ON u.id = p.user_id
      LEFT JOIN post_likes pl ON pl.post_id = p.id
      LEFT JOIN post_comments pc ON pc.post_id = p.id
      WHERE pb.user_id = $1
      GROUP BY p.id, u.id, pb.created_at
      ORDER BY pb.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const res = await pool.query(query, [userId, limit, offset]);
    return res.rows;
  }

  static async getLikedPosts(userId: string, limit = 20, offset = 0) {
    const query = `
      SELECT 
        p.id, 
        p.user_id, 
        p.content, 
        p.image_url, 
        p.created_at,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        COUNT(DISTINCT pl.id)::INT AS likes_count,
        COUNT(DISTINCT pc.id)::INT AS comments_count,
        true AS is_liked_by_me,
        EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id = p.id AND user_id = $1) AS is_bookmarked_by_me,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', pm.id, 'media_type', pm.media_type, 'url', pm.url)
            ) 
            FROM post_media pm 
            WHERE pm.post_id = p.id
          ), 
          '[]'::json
        ) AS media_urls
      FROM post_likes pl_user
      JOIN posts p ON p.id = pl_user.post_id
      JOIN users u ON u.id = p.user_id
      LEFT JOIN post_likes pl ON pl.post_id = p.id
      LEFT JOIN post_comments pc ON pc.post_id = p.id
      WHERE pl_user.user_id = $1
      GROUP BY p.id, u.id, pl_user.created_at
      ORDER BY pl_user.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const res = await pool.query(query, [userId, limit, offset]);
    return res.rows;
  }

  static async addComment(userId: string, postId: string, content: string, parentId?: string | null) {
    const res = await pool.query(
      `INSERT INTO post_comments (post_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, userId, content, parentId || null]
    );

    return res.rows[0];
  }

  static async getComments(postId: string) {
    const res = await pool.query(
      `SELECT 
         pc.id, 
         pc.post_id, 
         pc.user_id, 
         pc.content, 
         pc.created_at, 
         pc.parent_id,
         u.name AS user_name, 
         u.avatar_url AS user_avatar,
         parent_u.name AS parent_user_name
       FROM post_comments pc
       JOIN users u ON u.id = pc.user_id
       LEFT JOIN post_comments parent_pc ON parent_pc.id = pc.parent_id
       LEFT JOIN users parent_u ON parent_u.id = parent_pc.user_id
       WHERE pc.post_id = $1
       ORDER BY COALESCE(parent_pc.created_at, pc.created_at) ASC, pc.created_at ASC`,
      [postId]
    );

    return res.rows;
  }

  static async deletePost(userId: string, postId: string) {
    const res = await pool.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [postId, userId]
    );
    if (res.rows.length === 0) {
      throw new Error('Postingan tidak ditemukan atau Anda tidak memiliki izin untuk menghapusnya.');
    }
    return true;
  }

  static async getCategories() {
    const res = await pool.query(
      'SELECT id, name, icon, sort_order FROM post_categories WHERE is_active = true ORDER BY sort_order ASC'
    );
    return res.rows;
  }
}
