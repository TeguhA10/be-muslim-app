import { pool } from '../config/database';
import { Post, PostComment } from '../models';
import { NotificationService } from './notification.service';

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

    let whereClause = 'WHERE p.deleted_at IS NULL AND p.is_purged = FALSE';

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
        COALESCE(p.like_count, 0)::INT AS likes_count,
        COALESCE(p.comment_count, 0)::INT AS comments_count,
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
      ${whereClause}
      ${orderByClause}
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const res = await pool.query(query, params);
    return res.rows;
  }

  static async toggleLike(userId: string, postId: string) {
    const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
    if (postCheck.rows.length === 0) {
      throw new Error('Postingan telah dihapus.');
    }

    const existing = await pool.query(
      'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      await pool.query('UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = $1', [postId]);
      return { liked: false };
    } else {
      await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
      await pool.query('UPDATE posts SET like_count = like_count + 1 WHERE id = $1', [postId]);

      // Trigger notification asynchronously
      (async () => {
        try {
          const postRes = await pool.query('SELECT user_id, content FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
          const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
          const post = postRes.rows[0];
          const liker = userRes.rows[0];
          if (post && post.user_id !== userId) {
            const actorName = liker?.name || 'Seseorang';
            const postSnippet = post.content ? `"${post.content.substring(0, 40)}..."` : 'postingan Anda';
            await NotificationService.notifyUser({
              recipientId: post.user_id,
              actorId: userId,
              type: 'LIKE_POST',
              title: 'Menyukai Postingan Anda',
              body: `${actorName} menyukai ${postSnippet}`,
              entityType: 'POST',
              entityId: postId,
            });
          }
        } catch (err) {}
      })();

      return { liked: true };
    }
  }

  static async toggleBookmark(userId: string, postId: string) {
    const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
    if (postCheck.rows.length === 0) {
      throw new Error('Postingan telah dihapus.');
    }

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
      WHERE pb.user_id = $1 AND p.deleted_at IS NULL AND p.is_purged = FALSE
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
      WHERE pl_user.user_id = $1 AND p.deleted_at IS NULL AND p.is_purged = FALSE
      GROUP BY p.id, u.id, pl_user.created_at
      ORDER BY pl_user.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const res = await pool.query(query, [userId, limit, offset]);
    return res.rows;
  }

  static async addComment(userId: string, postId: string, content: string, parentId?: string | null) {
    const postCheck = await pool.query('SELECT id FROM posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
    if (postCheck.rows.length === 0) {
      throw new Error('Postingan telah dihapus.');
    }

    const res = await pool.query(
      `INSERT INTO post_comments (post_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, userId, content, parentId || null]
    );

    await pool.query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1', [postId]);

    const newComment = res.rows[0];

    // Trigger notification asynchronously
    (async () => {
      try {
        const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        const commenterName = userRes.rows[0]?.name || 'Seseorang';
        const commentSnippet = content.length > 40 ? `"${content.substring(0, 40)}..."` : `"${content}"`;

        if (parentId) {
          const parentRes = await pool.query('SELECT user_id FROM post_comments WHERE id = $1', [parentId]);
          const parentComment = parentRes.rows[0];
          if (parentComment && parentComment.user_id !== userId) {
            await NotificationService.notifyUser({
              recipientId: parentComment.user_id,
              actorId: userId,
              type: 'REPLY_COMMENT',
              title: 'Membalas Komentar Anda',
              body: `${commenterName} membalas komentar Anda: ${commentSnippet}`,
              entityType: 'POST',
              entityId: postId,
            });
          }
        }

        const postRes = await pool.query('SELECT user_id, content FROM posts WHERE id = $1', [postId]);
        const post = postRes.rows[0];
        if (post && post.user_id !== userId) {
          // If already notified parent comment author and post author is the same person, skip duplicate
          const parentRes = parentId ? await pool.query('SELECT user_id FROM post_comments WHERE id = $1', [parentId]) : null;
          const parentOwnerId = parentRes?.rows[0]?.user_id;

          if (!parentOwnerId || parentOwnerId !== post.user_id) {
            await NotificationService.notifyUser({
              recipientId: post.user_id,
              actorId: userId,
              type: 'COMMENT_POST',
              title: 'Mengomentari Postingan Anda',
              body: `${commenterName} mengomentari postingan Anda: ${commentSnippet}`,
              entityType: 'POST',
              entityId: postId,
            });
          }
        }
      } catch (err) {}
    })();

    return newComment;
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
      'UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id',
      [postId, userId]
    );
    if (res.rows.length === 0) {
      throw new Error('Postingan tidak ditemukan atau Anda tidak memiliki izin untuk menghapusnya.');
    }
    return true;
  }

  static async restorePost(userId: string, postId: string) {
    const res = await pool.query(
      'UPDATE posts SET deleted_at = NULL WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL AND is_purged = FALSE RETURNING id',
      [postId, userId]
    );
    if (res.rows.length === 0) {
      throw new Error('Postingan tidak ditemukan atau telah dihapus secara permanen.');
    }
    return true;
  }

  static async purgeOldDeletedPosts(days: number = 30): Promise<number> {
    const res = await pool.query(
      "DELETE FROM posts WHERE (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '1 day' * $1) OR (is_purged = TRUE AND purged_at < NOW() - INTERVAL '1 day' * $1)",
      [days]
    );
    return res.rowCount ?? 0;
  }

  static async getTrashPosts(userId: string) {
    const query = `
      SELECT 
        p.id, 
        p.user_id, 
        p.content, 
        p.image_url, 
        p.category, 
        p.created_at,
        p.deleted_at,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
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
      WHERE p.user_id = $1 AND p.deleted_at IS NOT NULL AND p.is_purged = FALSE
      ORDER BY p.deleted_at DESC
    `;
    const res = await pool.query(query, [userId]);
    return res.rows;
  }

  static async permanentDeletePost(userId: string, postId: string) {
    const res = await pool.query(
      'UPDATE posts SET is_purged = TRUE, purged_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL AND is_purged = FALSE RETURNING id',
      [postId, userId]
    );
    if (res.rows.length === 0) {
      throw new Error('Postingan tidak ditemukan di sampah.');
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
