import admin from 'firebase-admin';
import fs from 'fs';

export function initAdmin() {
  if (admin.apps.length) return;

  // Prefer FIREBASE_SERVICE_ACCOUNT raw JSON (CI friendly)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const creds = typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string'
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : process.env.FIREBASE_SERVICE_ACCOUNT;
    admin.initializeApp({
      credential: admin.credential.cert(creds),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    return;
  }

  // GOOGLE_APPLICATION_CREDENTIALS may be a JSON string or a path to a file
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const val = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    try {
      let creds: any;
      if (val.startsWith('{')) {
        creds = JSON.parse(val);
      } else {
        const file = fs.readFileSync(val, 'utf8');
        creds = JSON.parse(file);
      }
      admin.initializeApp({
        credential: admin.credential.cert(creds),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
      return;
    } catch (e) {
      console.warn('Failed to init admin with GOOGLE_APPLICATION_CREDENTIALS, falling back to default:', e);
    }
  }

  // Fallback to application default credentials
  admin.initializeApp({
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export { admin };