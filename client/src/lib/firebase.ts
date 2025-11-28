import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Read Vite client envs (must be in client/.env and prefixed VITE_)
const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

// Optional env vars - can be derived from projectId
const optionalEnvVars = {
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

console.log('VITE env preview:', {
  apiKey: Boolean(requiredEnvVars.apiKey),
  projectId: requiredEnvVars.projectId,
  appId: Boolean(requiredEnvVars.appId),
});

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, v]) => !v)
  .map(([k]) => k);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

if (missingVars.length > 0) {

  console.warn("Missing Firebase environment variables:", missingVars);
  console.warn("Firebase authentication will not be available. Please configure Firebase to enable auth features.");
  console.warn("Set these environment variables:", missingVars.join(", "));
} else {
  const firebaseConfig = {
    apiKey: requiredEnvVars.apiKey,
    authDomain: optionalEnvVars.authDomain || `${requiredEnvVars.projectId}.firebaseapp.com`,
    projectId: requiredEnvVars.projectId,
    storageBucket: optionalEnvVars.storageBucket || `${requiredEnvVars.projectId}.firebasestorage.app`,
    messagingSenderId: optionalEnvVars.messagingSenderId || "",
    appId: requiredEnvVars.appId,
  };

  console.log("Firebase initialized with project:", requiredEnvVars.projectId);

  // Initialize Firebase only if not already initialized
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  // Initialize Firebase Authentication and get a reference to the service
  auth = getAuth(app);
  
  // Initialize Firebase Storage
  storage = getStorage(app);
}

// Export with null checks - consumers should verify auth/storage is available
export { auth, storage };
export default app;