import { Storage } from '@google-cloud/storage';

const BUCKET = process.env.UPLOAD_BUCKET || process.env.GCS_BUCKET || 'your-bucket-name';
const storage = new Storage({
  // If GOOGLE_CREDENTIALS env JSON is available, the ImageAnnotator code already parses it.
  // The SDK will pick up GOOGLE_APPLICATION_CREDENTIALS or ADC by default.
});

export async function uploadBufferToGCS(buffer: Buffer, key: string, contentType = 'application/octet-stream') {
  const bucket = storage.bucket(BUCKET);
  const file = bucket.file(key);
  await file.save(buffer, { contentType, resumable: false });
  // keep object private by default — return a signed URL for short-lived access
  const expires = Date.now() + (60 * 60 * 1000); // 1 hour
  const [url] = await file.getSignedUrl({ action: 'read', expires });
  return { key, url };
}