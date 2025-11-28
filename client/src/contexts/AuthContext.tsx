import { createContext, useContext, useEffect, useState } from "react";
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Helper to fail fast when Firebase isn't configured
  function ensureAuth() {
    if (!auth) {
      const err = new Error("Firebase not configured");
      toast({
        title: "Auth unavailable",
        description: "Firebase is not configured. Authentication actions are disabled in this environment.",
        variant: "destructive",
      });
      throw err;
    }
    return auth;
  }

  async function signup(email: string, password: string, displayName: string) {
    try {
      const _auth = ensureAuth();
      const result = await createUserWithEmailAndPassword(_auth, email, password);
      await updateProfile(result.user, { displayName });
      toast({
        title: "Account created!",
        description: "Welcome to Receiptify! You can now start managing your receipts.",
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      let errorMessage = "Failed to create account";
      if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "An account with this email already exists.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Please use at least 6 characters.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address.";
      }
      toast({
        title: "Signup failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  }

  async function login(email: string, password: string) {
    try {
      const _auth = ensureAuth();
      await signInWithEmailAndPassword(_auth, email, password);
      toast({
        title: "Welcome back!",
        description: "Successfully signed in to your account.",
      });
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Failed to sign in";
      if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email address.";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      toast({
        title: "Sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  }

  async function logout() {
    try {
      const _auth = ensureAuth();
      await signOut(_auth);
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  }

  async function resetPassword(email: string) {
    try {
      const _auth = ensureAuth();
      await sendPasswordResetEmail(_auth, email);
      toast({
        title: "Password reset sent",
        description: "Check your email for password reset instructions.",
      });
    } catch (error: any) {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  }

  async function signInWithGoogle() {
    try {
      const _auth = ensureAuth();
       const provider = new GoogleAuthProvider();
       provider.addScope('email');
       provider.addScope('profile');
       // Add custom parameters for better compatibility
       provider.setCustomParameters({
         prompt: 'select_account'
       });
      await signInWithPopup(_auth, provider);
      toast({
        title: "Welcome!",
        description: "Successfully signed in with Google.",
      });
    } catch (error: any) {
      console.error("Google sign in error:", error);
      let errorMessage = "Failed to sign in with Google";
      if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "Popup was blocked. Please allow popups and try again.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Sign in was cancelled.";
      }
      toast({
        title: "Google sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  }

  async function signInWithFacebook() {
    try {
      const _auth = ensureAuth();
       const provider = new FacebookAuthProvider();
       provider.addScope('email');
      await signInWithPopup(_auth, provider);
      toast({
        title: "Welcome!",
        description: "Successfully signed in with Facebook.",
      });
    } catch (error: any) {
      console.error("Facebook sign in error:", error);
      let errorMessage = "Failed to sign in with Facebook";
      if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "Popup was blocked. Please allow popups and try again.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Sign in was cancelled.";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Facebook sign-in is not enabled. Please contact support.";
      }
      toast({
        title: "Facebook sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  }

  async function signInWithApple() {
    try {
      const _auth = ensureAuth();
       const provider = new OAuthProvider('apple.com');
       provider.addScope('email');
       provider.addScope('name');
      await signInWithPopup(_auth, provider);
      toast({
        title: "Welcome!",
        description: "Successfully signed in with Apple.",
      });
    } catch (error: any) {
      console.error("Apple sign in error:", error);
      let errorMessage = "Failed to sign in with Apple";
      if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "Popup was blocked. Please allow popups and try again.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Sign in was cancelled.";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Apple sign-in is not enabled. Please contact support.";
      }
      toast({
        title: "Apple sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  }

  useEffect(() => {
    // If Firebase auth isn't configured (auth is null), don't call onAuthStateChanged.
    if (!auth) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}