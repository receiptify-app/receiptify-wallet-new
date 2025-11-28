import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Read Vite client envs (must be in client/.env and prefixed VITE_)
const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined, // NOTE: use _ between PROJECT and ID
  appId: import.meta.env.VITE_FIREBASE_APPID as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

console.log('VITE env preview:', {
  apiKey: Boolean(requiredEnvVars.apiKey),
  projectId: requiredEnvVars.projectId,
  appId: Boolean(requiredEnvVars.appId),
  storageBucket: Boolean(requiredEnvVars.storageBucket),
});

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingVars.length > 0) {
  console.error('Missing Firebase environment variables (client):', missingVars);
  // degrade gracefully — do not throw so the UI can load
}

export let firebaseConfig: {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
} | null = null;

if (!missingVars.includes('apiKey') && !missingVars.includes('projectId') && !missingVars.includes('appId')) {
  firebaseConfig = {
    apiKey: requiredEnvVars.apiKey!,
    authDomain: requiredEnvVars.authDomain || `${requiredEnvVars.projectId}.firebaseapp.com`,
    projectId: requiredEnvVars.projectId!,
    storageBucket: requiredEnvVars.storageBucket || `${requiredEnvVars.projectId}.appspot.com`,
    messagingSenderId: requiredEnvVars.messagingSenderId,
    appId: requiredEnvVars.appId!,
  };
  console.log("Firebase configured with project:", requiredEnvVars.projectId);
} else {
  console.log("Firebase not fully configured due to missing environment variables.");
}

// Initialize Firebase only if we have a config
export let app: ReturnType<typeof initializeApp> | null = null;
export let auth: ReturnType<typeof getAuth> | null = null;
export let storage: ReturnType<typeof getStorage> | null = null;

if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  storage = getStorage(app);
  console.log("Firebase initialized with project:", firebaseConfig.projectId);
}

export default app;