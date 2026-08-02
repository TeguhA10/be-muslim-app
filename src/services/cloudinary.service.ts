import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';

// Configure Cloudinary SDK dynamically
function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || ENV.CLOUDINARY.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY || ENV.CLOUDINARY.API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET || ENV.CLOUDINARY.API_SECRET,
  });
  return cloudinary;
}

/**
 * Kompres gambar ke ukuran target ~100KB (102.400 bytes) menggunakan sharp
 */
async function compressImageTo100KB(buffer: Buffer): Promise<Buffer> {
  try {
    const TARGET_SIZE_BYTES = 102400; // 100 KB
    if (buffer.length <= TARGET_SIZE_BYTES) {
      return buffer;
    }

    let quality = 75;
    let width = 1080;

    let compressed = await sharp(buffer)
      .resize({ width, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, progressive: true, mozjpeg: true })
      .toBuffer();

    // Iteratif kurangi kualitas/dimensi jika masih > 100KB
    while (compressed.length > TARGET_SIZE_BYTES && quality > 25) {
      quality -= 15;
      if (width > 600) width -= 150;

      compressed = await sharp(buffer)
        .resize({ width, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality, progressive: true, mozjpeg: true })
        .toBuffer();
    }

    logger.info(`[Image Compress] Original: ${(buffer.length / 1024).toFixed(1)}KB -> Compressed: ${(compressed.length / 1024).toFixed(1)}KB (quality: ${quality})`);
    return compressed;
  } catch (error: any) {
    logger.warn(`[Image Compress] Sharp compression failed, fallback to original: ${error.message}`);
    return buffer;
  }
}

export class CloudinaryService {
  /**
   * Upload image buffer directly to Cloudinary and compress to ~50KB (300x300 fill avatar)
   */
  static async uploadAvatar(buffer: Buffer, filename = 'avatar'): Promise<string> {
    const cloud = getCloudinary();
    const compressedBuffer = await compressImageTo100KB(buffer);

    return new Promise((resolve, reject) => {
      const uploadStream = cloud.uploader.upload_stream(
        {
          folder: 'muslim_app/avatars',
          public_id: `avatar_${Date.now()}`,
          transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face' },
            { quality: 'auto:eco', fetch_format: 'jpg' },
          ],
        },
        (error, result) => {
          if (error) {
            logger.error('[CloudinaryService] Upload failed:', error);
            return reject(new Error('Gagal mengunggah foto ke Cloudinary.'));
          }
          if (result && result.secure_url) {
            logger.info(`[CloudinaryService] Avatar uploaded successfully: ${result.secure_url} (size: ${result.bytes} bytes)`);
            return resolve(result.secure_url);
          }
          reject(new Error('Cloudinary response missing URL'));
        }
      );

      uploadStream.end(compressedBuffer);
    });
  }

  /**
   * Upload post image to Cloudinary compressed (~100KB target)
   */
  static async uploadImage(buffer: Buffer): Promise<string> {
    const cloud = getCloudinary();
    const compressedBuffer = await compressImageTo100KB(buffer);

    return new Promise((resolve, reject) => {
      const uploadStream = cloud.uploader.upload_stream(
        {
          folder: 'muslim_app/posts',
          public_id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          transformation: [
            { width: 1080, crop: 'limit' },
            { quality: 'auto:eco', fetch_format: 'jpg' },
          ],
        },
        (error, result) => {
          if (error) {
            logger.error('[CloudinaryService] Upload image failed:', error);
            return reject(new Error('Gagal mengunggah gambar postingan ke Cloudinary.'));
          }
          if (result && result.secure_url) {
            logger.info(`[CloudinaryService] Post image uploaded successfully: ${result.secure_url} (size: ${result.bytes} bytes)`);
            return resolve(result.secure_url);
          }
          reject(new Error('Cloudinary response missing URL'));
        }
      );

      uploadStream.end(compressedBuffer);
    });
  }
}
