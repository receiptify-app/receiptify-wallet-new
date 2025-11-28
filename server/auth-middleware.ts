import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return true;
  
  try {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID?.replace(/[",]/g, '');
    
    if (!projectId) {
      console.warn('Firebase project ID not configured - auth will use fallback mode');
      return false;
    }

    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: projectId,
      });
      console.log('Firebase Admin initialized with project:', projectId);
    }
    
    firebaseInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return false;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('No auth token provided - using anonymous mode');
    req.user = undefined;
    return next();
  }

  const idToken = authHeader.split('Bearer ')[1];
  
  if (!idToken) {
    console.log('Empty auth token - using anonymous mode');
    req.user = undefined;
    return next();
  }

  if (!initializeFirebase()) {
    console.log('Firebase not available - using anonymous mode');
    req.user = undefined;
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
    
    console.log('Authenticated user:', req.user.id, req.user.email);
    next();
  } catch (error: any) {
    console.warn('Token verification failed:', error?.message || error);
    req.user = undefined;
    next();
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function getUserId(req: AuthenticatedRequest): string | null {
  return req.user?.id || null;
}
