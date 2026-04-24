import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Lock, Eye, EyeOff, User, AtSign, ArrowLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import logoPath from "@assets/R_logo_1777038726271.png";
import { FaGoogle } from "react-icons/fa";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { useTranslation } from 'react-i18next';
import { Seo } from "@/components/seo";

interface SignupForm {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

type FieldStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function FieldStatusIcon({ status }: { status: FieldStatus }) {
  if (status === 'checking') return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
  if (status === 'available') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'taken' || status === 'invalid') return <XCircle className="w-4 h-4 text-red-500" />;
  return null;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [, navigate] = useLocation();
  const { signup, signInWithGoogle } = useAuth();
  const { t } = useTranslation();

  const [usernameValue, setUsernameValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<FieldStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<FieldStatus>('idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  const debouncedUsername = useDebounce(usernameValue, 500);
  const debouncedEmail = useDebounce(emailValue, 600);

  // Username live check
  useEffect(() => {
    if (!debouncedUsername) { setUsernameStatus('idle'); setUsernameMessage(''); return; }
    if (debouncedUsername.length < 3) {
      setUsernameStatus('invalid');
      setUsernameMessage('Username must be at least 3 characters');
      return;
    }
    if (debouncedUsername.length > 20) {
      setUsernameStatus('invalid');
      setUsernameMessage('Username must be 20 characters or less');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(debouncedUsername)) {
      setUsernameStatus('invalid');
      setUsernameMessage('Only lowercase letters, numbers, and underscores allowed');
      return;
    }
    setUsernameStatus('checking');
    fetch(`/api/check-username?username=${encodeURIComponent(debouncedUsername)}`)
      .then(r => r.json())
      .then(data => {
        if (data.available) {
          setUsernameStatus('available');
          setUsernameMessage('Username is available');
        } else {
          setUsernameStatus('taken');
          setUsernameMessage(data.reason || 'Username is already taken');
        }
      })
      .catch(() => { setUsernameStatus('idle'); setUsernameMessage(''); });
  }, [debouncedUsername]);

  // Email live check
  useEffect(() => {
    if (!debouncedEmail) { setEmailStatus('idle'); setEmailMessage(''); return; }
    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(debouncedEmail)) {
      setEmailStatus('invalid');
      setEmailMessage('Please enter a valid email address');
      return;
    }
    setEmailStatus('checking');
    fetch(`/api/check-email?email=${encodeURIComponent(debouncedEmail)}`)
      .then(r => r.json())
      .then(data => {
        if (data.available) {
          setEmailStatus('available');
          setEmailMessage('');
        } else {
          setEmailStatus('taken');
          setEmailMessage('An account with this email already exists');
        }
      })
      .catch(() => { setEmailStatus('idle'); setEmailMessage(''); });
  }, [debouncedEmail]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SignupForm>();
  const password = watch("password");

  const onSubmit = async (data: SignupForm) => {
    if (data.password !== data.confirmPassword) return;
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return;
    if (emailStatus === 'taken' || emailStatus === 'invalid') return;
    setIsLoading(true);
    try {
      await signup(data.email, data.password, data.name, data.username.toLowerCase());
      navigate("/");
    } catch (error) {
      console.error("Signup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      navigate("/");
    } catch (error) {
      console.error(`${provider} signup error:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Seo
        title="Sign up free — Receiptify | Your digital receipt wallet"
        description="Create a free Receiptify account and start storing every receipt in one place. Snap, email or import — Receiptify reads merchant, date, amount, currency and category automatically."
        path="/signup"
        robots="noindex,follow"
      />
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/">
          <Button variant="ghost" className="mb-4 text-gray-600 hover:text-gray-900" data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
        </Link>
        <Card className="w-full shadow-xl border-0">
          <CardHeader className="text-center space-y-4">
            <div className="flex flex-col items-center gap-2 mb-4">
              <img
                src={logoPath}
                alt={t('app.title')}
                className="h-20 w-auto select-none"
                draggable={false}
              />
              <div className="hidden">
                <h1 className="text-2xl font-bold text-gray-900">{t('app.title')}</h1>
                <p className="text-sm text-gray-600">{t('landing.footerTagline')}</p>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">{t('auth.createAccountTitle')}</CardTitle>
            <p className="text-gray-600">{t('auth.createAccountDesc')}</p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Google Sign-in */}
            <Button
              variant="outline"
              className="w-full h-12 text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <FaGoogle className="w-5 h-5 mr-3 text-red-500" />
              {t('auth.continueWithGoogle')}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">{t('auth.createWithEmail')}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="name">{t('auth.fullName')}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder={t('auth.enterFullName')}
                    className="pl-10 h-12"
                    {...register("name", {
                      required: t('auth.nameRequired'),
                      minLength: { value: 2, message: t('auth.nameMinLength') }
                    })}
                  />
                </div>
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="e.g. john_doe123"
                    className="pl-10 pr-10 h-12"
                    value={usernameValue}
                    {...register("username", {
                      required: "Username is required",
                      minLength: { value: 3, message: "Username must be at least 3 characters" },
                      maxLength: { value: 20, message: "Username must be 20 characters or less" },
                      pattern: { value: /^[a-z0-9_]+$/, message: "Only lowercase letters, numbers, and underscores allowed" },
                    })}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      setValue("username", val);
                      setUsernameValue(val);
                    }}
                  />
                  <div className="absolute right-3 top-3">
                    <FieldStatusIcon status={usernameStatus} />
                  </div>
                </div>
                {usernameMessage && (
                  <p className={`text-sm ${usernameStatus === 'available' ? 'text-green-600' : 'text-red-500'}`}>
                    {usernameMessage}
                  </p>
                )}
                {errors.username && !usernameMessage && (
                  <p className="text-sm text-red-500">{errors.username.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.enterEmail')}
                    className="pl-10 pr-10 h-12"
                    {...register("email", {
                      required: t('auth.emailRequired'),
                      pattern: {
                        value: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
                        message: t('auth.emailInvalid')
                      }
                    })}
                    onChange={(e) => setEmailValue(e.target.value)}
                  />
                  <div className="absolute right-3 top-3">
                    <FieldStatusIcon status={emailStatus} />
                  </div>
                </div>
                {emailMessage && (
                  <p className="text-sm text-red-500">{emailMessage}</p>
                )}
                {errors.email && !emailMessage && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('auth.createPassword')}
                    className="pl-10 pr-10 h-12"
                    {...register("password", {
                      required: t('auth.passwordRequired'),
                      minLength: { value: 6, message: t('auth.passwordMinLength') }
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
                {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t('auth.confirmYourPassword')}
                    className="pl-10 pr-10 h-12"
                    {...register("confirmPassword", {
                      required: t('auth.confirmPasswordRequired'),
                      validate: value => value === password || t('auth.passwordsMustMatch')
                    })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
              </div>

              {/* Terms */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  {...register("terms", { required: t('auth.termsRequired') })}
                />
                <Label htmlFor="terms" className="text-sm text-gray-600">
                  {t('auth.agreeToTerms')}{" "}
                  <button type="button" onClick={() => setShowTermsDialog(true)} className="text-green-600 hover:text-green-700 underline cursor-pointer" data-testid="link-terms-of-service">
                    {t('auth.termsOfService')}
                  </button>
                  {" "}{t('auth.and')}{" "}
                  <button type="button" onClick={() => setShowPrivacyDialog(true)} className="text-green-600 hover:text-green-700 underline cursor-pointer" data-testid="link-privacy-policy">
                    {t('auth.privacyPolicy')}
                  </button>
                </Label>
              </div>
              {errors.terms && <p className="text-sm text-red-500">{errors.terms.message}</p>}

              <Button
                type="submit"
                className="w-full h-12 bg-green-600 hover:bg-green-700"
                disabled={isLoading || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking' || emailStatus === 'taken' || emailStatus === 'checking'}
              >
                {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
              </Button>
            </form>

            <div className="text-center">
              <span className="text-gray-600">{t('auth.haveAccount')} </span>
              <Link href="/login">
                <Button variant="link" className="p-0 h-auto text-green-600 hover:text-green-700">
                  {t('auth.signIn')}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Terms of Service Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('legal.termsTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('legal.termsTitle')}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm text-gray-700">
              <p className="text-xs text-gray-500">{t('legal.termsLastUpdated')}</p>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsAcceptanceTitle')}</h3><p>{t('legal.termsAcceptanceContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsServiceTitle')}</h3><p>{t('legal.termsServiceContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsAccountTitle')}</h3><p>{t('legal.termsAccountContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsUsageTitle')}</h3><p>{t('legal.termsUsageContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsIntellectualTitle')}</h3><p>{t('legal.termsIntellectualContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsLiabilityTitle')}</h3><p>{t('legal.termsLiabilityContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsChangesTitle')}</h3><p>{t('legal.termsChangesContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsContactTitle')}</h3><p>{t('legal.termsContactContent')}</p></section>
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowTermsDialog(false)} data-testid="button-close-terms">{t('common.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('legal.privacyTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('legal.privacyTitle')}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm text-gray-700">
              <p className="text-xs text-gray-500">{t('legal.privacyLastUpdated')}</p>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyIntroTitle')}</h3><p>{t('legal.privacyIntroContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyCollectionTitle')}</h3><p>{t('legal.privacyCollectionContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyUseTitle')}</h3><p>{t('legal.privacyUseContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyStorageTitle')}</h3><p>{t('legal.privacyStorageContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacySharingTitle')}</h3><p>{t('legal.privacySharingContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyRightsTitle')}</h3><p>{t('legal.privacyRightsContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyCookiesTitle')}</h3><p>{t('legal.privacyCookiesContent')}</p></section>
              <section><h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyContactTitle')}</h3><p>{t('legal.privacyContactContent')}</p></section>
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowPrivacyDialog(false)} data-testid="button-close-privacy">{t('common.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
