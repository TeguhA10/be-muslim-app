import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { ENV } from '../config/env';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || ENV.CLOUDINARY.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || ENV.CLOUDINARY.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || ENV.CLOUDINARY.API_SECRET,
});

async function uploadAdzanFiles() {
  const adzanDir = path.resolve(__dirname, '../../../adzan');
  console.log('Target Adzan Directory:', adzanDir);

  const files = [
    { soundId: 'adzan_madinah', fileName: 'madinah_adzan.mp3' },
    { soundId: 'adzan_makkah', fileName: 'makkah _maghrib_adhan.mp3' },
    { soundId: 'adzan_subuh_makkah', fileName: 'misyari_rasyid_adzan_subuh_makkah.mp3' },
    { soundId: 'adzan_soft', fileName: 'soulful_azan_by_mehdi_yarrahi.mp3' },
  ];

  const results: Record<string, string> = {};

  for (const item of files) {
    const filePath = path.join(adzanDir, item.fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    console.log(`Uploading ${item.fileName} (${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB) to Cloudinary...`);
    try {
      const uploadRes = await cloudinary.uploader.upload(filePath, {
        resource_type: 'video', // Cloudinary handles audio files under resource_type 'video'
        folder: 'muslim_app/adzan_audio',
        public_id: item.soundId,
        overwrite: true,
      });

      console.log(`✓ Uploaded ${item.soundId}: ${uploadRes.secure_url}`);
      results[item.soundId] = uploadRes.secure_url;
    } catch (err: any) {
      console.error(`❌ Failed to upload ${item.fileName}:`, err?.message || err);
    }
  }

  console.log('\n=== FINAL CLOUDINARY ADZAN URLS ===');
  console.log(JSON.stringify(results, null, 2));
}

uploadAdzanFiles().catch(console.error);
