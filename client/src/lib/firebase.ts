import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Validate Firebase environment variables
const requiredEnvVars = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => `VITE_FIREBASE_${key.toUpperCase()}`);

if (missingVars.length > 0) {
  console.error("Missing Firebase environment variables:", missingVars);
  throw new Error(`Missing Firebase configuration: ${missingVars.join(", ")}`);
}

const firebaseConfig = {
  apiKey: requiredEnvVars.apiKey,
  authDomain: `${requiredEnvVars.projectId}.firebaseapp.com`,
  projectId: requiredEnvVars.projectId,
  storageBucket: `${requiredEnvVars.projectId}.firebasestorage.app`,
  messagingSenderId: "123456789",
  appId: requiredEnvVars.appId,
};

console.log("Firebase initialized with project:", requiredEnvVars.projectId);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Remove emulator connection for Replit environment
// Firebase will connect directly to production services

export default app;