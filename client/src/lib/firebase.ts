import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Validate Firebase environment variables
const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECTID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APPID as string | undefined,
};

console.log('VITE env preview:', {
  apiKey: Boolean(requiredEnvVars.apiKey),
  projectId: requiredEnvVars.projectId,
  appId: Boolean(requiredEnvVars.appId),
});

const missingVars = Object.entries(requiredEnvVars)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missingVars.length > 0) {
  console.error('Missing Firebase environment variables:', missingVars);
  // degrade gracefully — do not throw so the UI can load
}

// Declare exported bindings at top-level and assign conditionally
export let firebaseConfig: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
} | null = null;

if (missingVars.length === 0) {
  firebaseConfig = {
    apiKey: requiredEnvVars.apiKey,
    authDomain: `${requiredEnvVars.projectId}.firebaseapp.com`,
    projectId: requiredEnvVars.projectId,
    storageBucket: `${requiredEnvVars.projectId}.appspot.com`,
    messagingSenderId: "123456789",
    appId: requiredEnvVars.appId,
  };
  console.log("Firebase configured with project:", requiredEnvVars.projectId);
} else {
  // noop config; app and auth will remain null
  console.log("Firebase not configured due to missing environment variables.");
}

// Initialize Firebase only if we have a config
export let app: ReturnType<typeof initializeApp> | null = null;
export let auth: ReturnType<typeof getAuth> | null = null;

if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  console.log("Firebase initialized with project:", firebaseConfig.projectId);
}

// Remove emulator connection for Replit environment
// Firebase will connect directly to production services

export default app;