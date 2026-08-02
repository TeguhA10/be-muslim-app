import multer from 'multer';
import { Request } from 'express';

// Configure multer memory storage
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('File yang diunggah harus berupa gambar (JPEG, PNG, WEBP, DLL).'));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max upload size, Cloudinary will compress to ~50KB
  },
  fileFilter,
});
