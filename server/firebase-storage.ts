import { initAdmin, admin } from './firebase-admin';
import fs from 'fs';
import os from 'os';
import path from 'path';

initAdmin();

export function getBucket() {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (bucketName) return admin.storage().bucket(bucketName);
  return admin.storage().bucket(); // rely on default bucket if configured
}

export async function downloadBufferFromStorage(objectPath: string): Promise<Buffer> {
  const bucket = getBucket();
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`Storage object not found: ${objectPath}`);
  const [contents] = await file.download();
  return Buffer.from(contents);
}

export async function downloadToTempFile(objectPath: string): Promise<string> {
  const buf = await downloadBufferFromStorage(objectPath);
  const tmpDir = os.tmpdir();
  const outName = `receipt_${Date.now()}_${path.basename(objectPath).replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const outPath = path.join(tmpDir, outName);
  await fs.promises.writeFile(outPath, buf);
  return outPath;
}