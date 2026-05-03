import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  AtSign,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import logoPath from "@assets/R_logo_1777038726271.png";
import { FaGoogle } from "react-icons/fa";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
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

function getPasswordStrengthScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const PW_STRENGTH_META = [
  { color: "bg-red-400", key: "auth.pwTooShort" },
  { color: "bg-orange-400", key: "auth.pwWeak" },
  { color: "bg-yellow-400", key: "auth.pwOkay" },
  { color: "bg-emerald-500", key: "auth.pwStrong" },
  { color: "bg-emerald-600", key: "auth.pwExcellent" },
] as const;

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
  const password = watch("password") || "";
  const pwScore = useMemo(() => getPasswordStrengthScore(password), [password]);
  const pwMeta = PW_STRENGTH_META[pwScore];

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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 lg:grid lg:grid-cols-[1.05fr_1fr] relative overflow-hidden">
      {/* decorative background blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-emerald-200/35 blur-3xl motion-safe:animate-halo-pulse"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-32 w-[460px] h-[460px] rounded-full bg-emerald-300/25 blur-3xl motion-safe:animate-halo-pulse"
        style={{ animationDelay: "1.5s" }}
      />

      {/* LEFT — brand / value panel (desktop only) */}
      <aside className="hidden lg:flex relative flex-col justify-between p-12 xl:p-16">
        <Link href="/" data-testid="brand-home">
          <div className="flex items-center gap-3 cursor-pointer group">
            <img
              src={logoPath}
              alt={t("app.title")}
              className="h-10 w-auto select-none transition-transform group-hover:scale-105"
              draggable={false}
            />
            <span className="text-xl font-bold tracking-tight text-gray-900">
              {t("app.title")}
            </span>
          </div>
        </Link>

        <div className="max-w-md motion-safe:animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold tracking-wider uppercase">
            {t("auth.signupHeroBadge")}
          </span>
          <h2 className="mt-5 text-4xl xl:text-[2.7rem] font-bold tracking-tight text-gray-900 leading-[1.1]">
            {t("auth.signupHeroTitle")}
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            {t("auth.signupHeroDesc")}
          </p>

          <ul className="mt-8 space-y-4">
            {[
              { Icon: Receipt, title: t("auth.signupFeatureCaptureTitle"), desc: t("auth.signupFeatureCaptureDesc") },
              { Icon: Wallet, title: t("auth.signupFeatureWalletTitle"), desc: t("auth.signupFeatureWalletDesc") },
              { Icon: ShieldCheck, title: t("auth.signupFeaturePrivacyTitle"), desc: t("auth.signupFeaturePrivacyDesc") },
            ].map(({ Icon, title, desc }, i) => (
              <li
                key={title}
                className="flex items-start gap-3 motion-safe:animate-fade-up"
                style={{ animationDelay: `${0.25 + i * 0.1}s` }}
              >
                <div className="shrink-0 w-9 h-9 rounded-xl bg-white border border-emerald-100 flex items-center justify-center shadow-sm">
                  <Icon className="w-[18px] h-[18px] text-emerald-600" strokeWidth={2.2} />
                </div>
                <div className="leading-snug">
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          {t("auth.signupTrustline")}
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="relative flex items-center justify-center p-4 sm:p-8 lg:p-10">
        <div className="w-full max-w-md">
          {/* Compact mobile brand bar + back link */}
          <div className="mb-5 flex items-center justify-between lg:justify-end">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <img src={logoPath} alt={t("app.title")} className="h-8 w-auto" draggable={false} />
              <span className="text-base font-bold text-gray-900">{t("app.title")}</span>
            </Link>
            <Link href="/">
              <Button
                type="button"
                variant="ghost"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-700 hover:bg-transparent px-2 h-8"
                data-testid="button-back-home"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("common.back")}
              </Button>
            </Link>
          </div>

          <div
            className="bg-white/95 backdrop-blur rounded-3xl border border-emerald-100/60 shadow-[0_30px_60px_-25px_rgba(16,185,129,0.25)] p-7 sm:p-9 motion-safe:animate-fade-up"
            style={{ animationDelay: "0.15s" }}
          >
            <div className="text-center">
              <h1 className="text-2xl sm:text-[1.7rem] font-bold tracking-tight text-gray-900">
                {t("auth.createAccountTitle")}
              </h1>
              <p className="mt-1.5 text-sm text-gray-500">
                {t("auth.createAccountDesc")}
              </p>
            </div>

            {/* Google */}
            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full h-11 rounded-xl text-gray-800 border-gray-200 hover:bg-gray-50 hover:border-gray-300 font-medium transition-all motion-safe:hover:-translate-y-0.5"
              onClick={() => handleSocialLogin("google")}
              disabled={isLoading}
              data-testid="button-google-signup"
            >
              <FaGoogle className="w-4 h-4 mr-2.5 text-[#EA4335]" />
              {t("auth.continueWithGoogle")}
            </Button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[11px] uppercase tracking-[0.12em] text-gray-400 font-semibold">
                {t("auth.createWithEmail")}
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Name + Username — paired on sm+ */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-gray-700">
                    {t("auth.fullName")}
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      type="text"
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "name-error" : undefined}
                      placeholder={t("auth.enterFullName")}
                      className="pl-10 h-11 rounded-xl bg-gray-50 border-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                      {...register("name", {
                        required: t("auth.nameRequired"),
                        minLength: { value: 2, message: t("auth.nameMinLength") },
                      })}
                    />
                  </div>
                  {errors.name && (
                    <p id="name-error" className="text-xs text-red-500">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-xs font-semibold text-gray-700">
                    {t("auth.username")}
                  </Label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="username"
                      type="text"
                      autoComplete="username"
                      aria-invalid={usernameStatus === "taken" || usernameStatus === "invalid" || !!errors.username}
                      aria-describedby="username-feedback"
                      placeholder={t("auth.usernamePlaceholder")}
                      className="pl-10 pr-10 h-11 rounded-xl bg-gray-50 border-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                      value={usernameValue}
                      {...register("username", {
                        required: "Username is required",
                        minLength: { value: 3, message: "Username must be at least 3 characters" },
                        maxLength: { value: 20, message: "Username must be 20 characters or less" },
                        pattern: { value: /^[a-z0-9_]+$/, message: "Only lowercase letters, numbers, and underscores allowed" },
                      })}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                        setValue("username", val);
                        setUsernameValue(val);
                      }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <FieldStatusIcon status={usernameStatus} />
                    </div>
                  </div>
                  <div id="username-feedback" aria-live="polite" className="min-h-0">
                    {usernameMessage && (
                      <p className={`text-xs ${usernameStatus === "available" ? "text-emerald-600" : "text-red-500"}`}>
                        {usernameMessage}
                      </p>
                    )}
                    {errors.username && !usernameMessage && (
                      <p className="text-xs text-red-500">{errors.username.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-gray-700">
                  {t("auth.email")}
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={emailStatus === "taken" || emailStatus === "invalid" || !!errors.email}
                    aria-describedby="email-feedback"
                    placeholder={t("auth.enterEmail")}
                    className="pl-10 pr-10 h-11 rounded-xl bg-gray-50 border-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                    {...register("email", {
                      required: t("auth.emailRequired"),
                      pattern: {
                        value: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
                        message: t("auth.emailInvalid"),
                      },
                    })}
                    onChange={(e) => setEmailValue(e.target.value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <FieldStatusIcon status={emailStatus} />
                  </div>
                </div>
                <div id="email-feedback" aria-live="polite" className="min-h-0">
                  {emailMessage && <p className="text-xs text-red-500">{emailMessage}</p>}
                  {errors.email && !emailMessage && (
                    <p className="text-xs text-red-500">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Password + Confirm — paired on sm+ */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-gray-700">
                    {t("auth.password")}
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      aria-invalid={!!errors.password}
                      aria-describedby="password-strength password-error"
                      placeholder={t("auth.createPassword")}
                      className="pl-10 pr-10 h-11 rounded-xl bg-gray-50 border-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                      {...register("password", {
                        required: t("auth.passwordRequired"),
                        minLength: { value: 6, message: t("auth.passwordMinLength") },
                      })}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-gray-700">
                    {t("auth.confirmPassword")}
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      aria-invalid={!!errors.confirmPassword}
                      aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
                      placeholder={t("auth.confirmYourPassword")}
                      className="pl-10 pr-10 h-11 rounded-xl bg-gray-50 border-gray-200 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                      {...register("confirmPassword", {
                        required: t("auth.confirmPasswordRequired"),
                        validate: (value) => value === password || t("auth.passwordsMustMatch"),
                      })}
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password strength meter */}
              {password && (
                <div
                  id="password-strength"
                  className="space-y-1.5 -mt-1"
                  data-testid="password-strength"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i < pwScore ? pwMeta.color : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {t("auth.passwordStrength")}:{" "}
                    <span
                      className={
                        pwScore >= 3
                          ? "text-emerald-600 font-medium"
                          : "text-gray-700 font-medium"
                      }
                    >
                      {t(pwMeta.key)}
                    </span>
                  </p>
                </div>
              )}

              {(errors.password || errors.confirmPassword) && (
                <div className="space-y-0.5 -mt-1">
                  {errors.password && (
                    <p id="password-error" className="text-xs text-red-500">{errors.password.message}</p>
                  )}
                  {errors.confirmPassword && (
                    <p id="confirm-error" className="text-xs text-red-500">{errors.confirmPassword.message}</p>
                  )}
                </div>
              )}

              {/* Terms */}
              <div className="flex items-start gap-2.5 pt-1">
                <Checkbox
                  id="terms"
                  className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  {...register("terms", { required: t("auth.termsRequired") })}
                />
                <Label htmlFor="terms" className="text-xs text-gray-600 leading-relaxed font-normal">
                  {t("auth.agreeToTerms")}{" "}
                  <button
                    type="button"
                    onClick={() => setShowTermsDialog(true)}
                    className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer font-medium"
                    data-testid="link-terms-of-service"
                  >
                    {t("auth.termsOfService")}
                  </button>{" "}
                  {t("auth.and")}{" "}
                  <button
                    type="button"
                    onClick={() => setShowPrivacyDialog(true)}
                    className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2 cursor-pointer font-medium"
                    data-testid="link-privacy-policy"
                  >
                    {t("auth.privacyPolicy")}
                  </button>
                </Label>
              </div>
              {errors.terms && (
                <p className="text-xs text-red-500 -mt-1">{errors.terms.message}</p>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[15px] font-semibold shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] transition-all motion-safe:hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={
                  isLoading ||
                  usernameStatus === "taken" ||
                  usernameStatus === "invalid" ||
                  usernameStatus === "checking" ||
                  emailStatus === "taken" ||
                  emailStatus === "checking"
                }
                data-testid="button-submit-signup"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("auth.creatingAccount")}
                  </span>
                ) : (
                  t("auth.createAccount")
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              {t("auth.haveAccount")}{" "}
              <Link
                href="/login"
                className="text-emerald-700 hover:text-emerald-800 font-semibold"
                data-testid="link-sign-in"
              >
                {t("auth.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </main>

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
