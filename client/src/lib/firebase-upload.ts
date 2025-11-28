/// <reference types="vite/client" />
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from './firebase';

if (!storage || !auth) {
  // fail fast in dev so upload errors are obvious
  console.warn('Firebase not initialized in client/src/lib/firebase.ts — uploads will fail until env/config is set.');
}

export function uploadReceiptFile(file: File) {
  const a = auth;
  const s = storage;
  if (!a || !s) throw new Error('Firebase not initialized');
  const user = a.currentUser;
  if (!user) throw new Error('Not authenticated');
  const uid = user.uid;
  const safeName = file.name.replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '');
  const objectPath = `users/${uid}/uploads/${Date.now()}_${safeName}`;
  const storageRef = ref(s as any, objectPath);
 
   return new Promise<{ path: string; url?: string }>((resolve, reject) => {
     const task = uploadBytesResumable(storageRef, file, { cacheControl: 'private, max-age=0' });
     task.on('state_changed',
       () => {}, // progress callback optional
       (err) => reject(err),
       async () => {
         const url = await getDownloadURL(storageRef).catch(() => undefined);
         resolve({ path: objectPath, url });
       }
     );
   });
 }