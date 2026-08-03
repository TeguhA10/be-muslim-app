import { Request, Response, NextFunction } from 'express';
import { PostService } from '../services/post.service';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middlewares/auth.middleware';
import { CloudinaryService } from '../services/cloudinary.service';

export class PostController {
  static async createPost(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const { content, category } = req.body;
      
      let links: string[] = [];
      try {
        if (req.body.links) {
          links = JSON.parse(req.body.links);
        }
      } catch (e) {
        // Fallback if not JSON string
        if (Array.isArray(req.body.links)) links = req.body.links;
        else if (typeof req.body.links === 'string') links = [req.body.links];
      }

      if (!content) {
        sendError(res, 'Konten postingan wajib diisi', null, 400);
        return;
      }

      if (!category) {
        sendError(res, 'Kategori postingan wajib dipilih', null, 400);
        return;
      }

      const mediaList: { type: 'IMAGE' | 'LINK', url: string }[] = [];

      // Add links to mediaList
      if (links && Array.isArray(links)) {
        for (const link of links) {
          if (link && typeof link === 'string' && link.trim() !== '') {
            mediaList.push({ type: 'LINK', url: link.trim() });
          }
        }
      }

      // Handle file uploads in parallel (significantly speeds up response time)
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const uploadPromises = (req.files as Express.Multer.File[]).map((file) =>
          CloudinaryService.uploadImage(file.buffer)
        );
        const uploadedUrls = await Promise.all(uploadPromises);
        for (const uploadedUrl of uploadedUrls) {
          mediaList.push({ type: 'IMAGE', url: uploadedUrl });
        }
      }

      const post = await PostService.createPost(userId, content, mediaList, category);
      sendSuccess(res, 'Post created successfully', post, 201);
    } catch (error: any) {
      next(error);
    }
  }

  static async getFeed(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || (req.query.user_id as any) || '11111111-1111-1111-1111-111111111111';
      const authorId = (req.query.author_id as string) || (req.query.target_user_id as string) || undefined;
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const offset = parseInt((req.query.offset as string) || '0', 10);
      const sort = (req.query.sort as any) || 'terbaru';
      const media = (req.query.media as any) || 'semua';
      const search = (req.query.search as string) || '';
      const category = (req.query.category as string) || 'semua';
      const followingOnly = req.query.following === 'true' || req.query.following_only === 'true';

      const feed = await PostService.getFeed(userId, limit, offset, sort, media, search, category, followingOnly, authorId);
      sendSuccess(res, 'Feed fetched successfully', feed);
    } catch (error: any) {
      next(error);
    }
  }

  static async toggleLike(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const postId = req.params.id as string;

      if (!postId) {
        sendError(res, 'Post ID is required', null, 400);
        return;
      }

      const result = await PostService.toggleLike(userId, postId);
      sendSuccess(res, result.liked ? 'Post liked' : 'Post unliked', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async toggleBookmark(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const postId = req.params.id as string;

      if (!postId) {
        sendError(res, 'Post ID is required', null, 400);
        return;
      }

      const result = await PostService.toggleBookmark(userId, postId);
      sendSuccess(res, result.bookmarked ? 'Post saved to bookmarks' : 'Post removed from bookmarks', result);
    } catch (error: any) {
      next(error);
    }
  }

  static async getBookmarks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const offset = parseInt((req.query.offset as string) || '0', 10);
      const bookmarks = await PostService.getBookmarks(userId, limit, offset);
      sendSuccess(res, 'Bookmarked posts fetched successfully', bookmarks);
    } catch (error: any) {
      next(error);
    }
  }

  static async getLikedPosts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const offset = parseInt((req.query.offset as string) || '0', 10);
      const likedPosts = await PostService.getLikedPosts(userId, limit, offset);
      sendSuccess(res, 'Liked posts fetched successfully', likedPosts);
    } catch (error: any) {
      next(error);
    }
  }

  static async addComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id || '11111111-1111-1111-1111-111111111111';
      const postId = req.params.id as string;
      const { content, parent_id, parentId } = req.body;

      if (!postId || !content) {
        sendError(res, 'Post ID and content are required', null, 400);
        return;
      }

      const comment = await PostService.addComment(userId, postId, content, parent_id || parentId);
      sendSuccess(res, 'Comment added successfully', comment, 201);
    } catch (error: any) {
      next(error);
    }
  }

  static async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const postId = req.params.id as string;
      const comments = await PostService.getComments(postId);
      sendSuccess(res, 'Comments fetched successfully', comments);
    } catch (error: any) {
      next(error);
    }
  }

  static async deletePost(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak sah. Silakan login kembali.', null, 401);
        return;
      }
      const postId = req.params.id as string;
      await PostService.deletePost(userId, postId);
      sendSuccess(res, 'Postingan berhasil dihapus');
    } catch (error: any) {
      next(error);
    }
  }

  static async restorePost(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak sah. Silakan login kembali.', null, 401);
        return;
      }
      const postId = req.params.id as string;
      await PostService.restorePost(userId, postId);
      sendSuccess(res, 'Postingan berhasil dipulihkan!');
    } catch (error: any) {
      next(error);
    }
  }

  static async getTrashPosts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak sah. Silakan login kembali.', null, 401);
        return;
      }
      const posts = await PostService.getTrashPosts(userId);
      sendSuccess(res, 'Daftar sampah postingan berhasil dimuat', { posts });
    } catch (error: any) {
      next(error);
    }
  }

  static async permanentDeletePost(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak sah. Silakan login kembali.', null, 401);
        return;
      }
      const postId = req.params.id as string;
      await PostService.permanentDeletePost(userId, postId);
      sendSuccess(res, 'Postingan berhasil dihapus secara permanen.');
    } catch (error: any) {
      next(error);
    }
  }

  static async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await PostService.getCategories();
      sendSuccess(res, 'Daftar kategori berhasil diambil', { categories });
    } catch (error: any) {
      next(error);
    }
  }

  static async getUploadSignature(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const folder = (req.query.folder as string) || 'muslim_app/posts';
      const signatureData = CloudinaryService.generateUploadSignature(folder);
      sendSuccess(res, 'Upload signature generated successfully', signatureData);
    } catch (error: any) {
      next(error);
    }
  }
}

