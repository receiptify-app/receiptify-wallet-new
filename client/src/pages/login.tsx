import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import logoPath from "@assets/R_logo_1777038726271.png";
import { FaGoogle } from "react-icons/fa";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { useTranslation } from 'react-i18next';
import { Seo } from "@/components/seo";
import { getPostAuthRedirect } from "@/lib/post-auth-redirect";

interface LoginForm {
  email: string;
  password: string;
}

// Generate or retrieve session ID for tracking
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('signup_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('signup_session_id', sessionId);
  }
  return sessionId;
};

// Track activity to backend
const trackActivity = async (activityType: string, metadata?: any) => {
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-session-id': getSessionId()
      },
      body: JSON.stringify({ activityType, metadata })
    });
  } catch (e) {
    // Silent fail for tracking
  }
};

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { login, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  const hasTrackedVisit = useRef(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  // Track when user visits login page (signup started)
  useEffect(() => {
    if (!hasTrackedVisit.current) {
      hasTrackedVisit.current = true;
      trackActivity('signup_started', { page: 'login' });
    }
  }, []);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      trackActivity('signup_completed', { method: 'email' });
      navigate(getPostAuthRedirect());
    } catch (error) {
      console.error("Login error:", error);
      trackActivity('signup_dropped', { method: 'email', reason: 'login_failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      trackActivity('signup_completed', { method: 'google' });
      navigate(getPostAuthRedirect());
    } catch (error) {
      console.error(`${provider} login error:`, error);
      trackActivity('signup_dropped', { method: 'google', reason: 'cancelled_or_failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Seo
        title="Sign in to Receiptify — Your digital receipt wallet"
        description="Sign in to your Receiptify account to access your digital receipt wallet, spending insights, loyalty cards, warranties and exports."
        path="/login"
        robots="noindex,follow"
      />
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="flex flex-col items-center gap-2 mb-4">
            <img
              src={logoPath}
              alt={t('app.title')}
              className="h-20 w-auto select-none"
              draggable={false}
            />
            <p className="text-sm text-gray-600">{t('landing.footerTagline')}</p>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {t('auth.welcomeBack')}
          </CardTitle>
          <p className="text-gray-600">
            {t('auth.signInDesc')}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Social Login Buttons */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <FaGoogle className="w-5 h-5 mr-3 text-red-500" />
              {t('auth.continueWithGoogle')}
            </Button>

          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">{t('auth.continueWithEmail')}</span>
            </div>
          </div>

          {/* Email Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.enterEmail')}
                  className="pl-10 h-12"
                  {...register("email", {
                    required: t('auth.emailRequired'),
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: t('auth.emailInvalid')
                    }
                  })}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('auth.enterPassword')}
                  className="pl-10 pr-10 h-12"
                  {...register("password", {
                    required: t('auth.passwordRequired')
                  })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Link href="/forgot-password">
                <Button variant="link" className="p-0 h-auto text-green-600 hover:text-green-700">
                  {t('auth.forgotPassword')}
                </Button>
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              {isLoading ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>

          <div className="text-center">
            <span className="text-gray-600">{t('auth.noAccount')} </span>
            <Link href="/signup">
              <Button variant="link" className="p-0 h-auto text-green-600 hover:text-green-700">
                {t('auth.signup')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
