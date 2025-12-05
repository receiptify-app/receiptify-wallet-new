import { useState } from "react";
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
import { Leaf, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { useTranslation } from 'react-i18next';

interface SignupForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [, navigate] = useLocation();
  const { signup, signInWithGoogle, signInWithFacebook, signInWithApple } = useAuth();
  const { t } = useTranslation();
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignupForm>();
  const password = watch("password");

  const onSubmit = async (data: SignupForm) => {
    if (data.password !== data.confirmPassword) {
      return;
    }
    
    setIsLoading(true);
    try {
      await signup(data.email, data.password, data.name);
      navigate("/");
    } catch (error) {
      console.error("Signup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'facebook' | 'apple') => {
    setIsLoading(true);
    try {
      switch (provider) {
        case 'google':
          await signInWithGoogle();
          break;
        case 'facebook':
          await signInWithFacebook();
          break;
        case 'apple':
          await signInWithApple();
          break;
      }
      navigate("/");
    } catch (error) {
      console.error(`${provider} signup error:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Leaf className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('app.title')}</h1>
              <p className="text-sm text-gray-600">{t('landing.footerTagline')}</p>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {t('auth.createAccountTitle')}
          </CardTitle>
          <p className="text-gray-600">
            {t('auth.createAccountDesc')}
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

            <Button
              variant="outline"
              className="w-full h-12 text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => handleSocialLogin('facebook')}
              disabled={isLoading}
            >
              <FaFacebook className="w-5 h-5 mr-3 text-blue-600" />
              {t('auth.continueWithFacebook')}
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => handleSocialLogin('apple')}
              disabled={isLoading}
            >
              <FaApple className="w-5 h-5 mr-3 text-gray-900" />
              {t('auth.continueWithApple')}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">{t('auth.createWithEmail')}</span>
            </div>
          </div>

          {/* Email Signup Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    minLength: {
                      value: 2,
                      message: t('auth.nameMinLength')
                    }
                  })}
                />
              </div>
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

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
                  placeholder={t('auth.createPassword')}
                  className="pl-10 pr-10 h-12"
                  {...register("password", {
                    required: t('auth.passwordRequired'),
                    minLength: {
                      value: 6,
                      message: t('auth.passwordMinLength')
                    }
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
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                {...register("terms", {
                  required: t('auth.termsRequired')
                })}
              />
              <Label htmlFor="terms" className="text-sm text-gray-600">
                {t('auth.agreeToTerms')}{" "}
                <button
                  type="button"
                  onClick={() => setShowTermsDialog(true)}
                  className="text-green-600 hover:text-green-700 underline cursor-pointer"
                  data-testid="link-terms-of-service"
                >
                  {t('auth.termsOfService')}
                </button>
                {" "}{t('auth.and')}{" "}
                <button
                  type="button"
                  onClick={() => setShowPrivacyDialog(true)}
                  className="text-green-600 hover:text-green-700 underline cursor-pointer"
                  data-testid="link-privacy-policy"
                >
                  {t('auth.privacyPolicy')}
                </button>
              </Label>
            </div>
            {errors.terms && (
              <p className="text-sm text-red-500">{errors.terms.message}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-green-600 hover:bg-green-700"
              disabled={isLoading}
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

      {/* Terms of Service Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('legal.termsTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('legal.termsTitle')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm text-gray-700">
              <p className="text-xs text-gray-500">{t('legal.termsLastUpdated')}</p>
              
              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsAcceptanceTitle')}</h3>
                <p>{t('legal.termsAcceptanceContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsServiceTitle')}</h3>
                <p>{t('legal.termsServiceContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsAccountTitle')}</h3>
                <p>{t('legal.termsAccountContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsUsageTitle')}</h3>
                <p>{t('legal.termsUsageContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsIntellectualTitle')}</h3>
                <p>{t('legal.termsIntellectualContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsLiabilityTitle')}</h3>
                <p>{t('legal.termsLiabilityContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsChangesTitle')}</h3>
                <p>{t('legal.termsChangesContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.termsContactTitle')}</h3>
                <p>{t('legal.termsContactContent')}</p>
              </section>
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowTermsDialog(false)} data-testid="button-close-terms">
              {t('common.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('legal.privacyTitle')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('legal.privacyTitle')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4 text-sm text-gray-700">
              <p className="text-xs text-gray-500">{t('legal.privacyLastUpdated')}</p>
              
              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyIntroTitle')}</h3>
                <p>{t('legal.privacyIntroContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyCollectionTitle')}</h3>
                <p>{t('legal.privacyCollectionContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyUseTitle')}</h3>
                <p>{t('legal.privacyUseContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyStorageTitle')}</h3>
                <p>{t('legal.privacyStorageContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacySharingTitle')}</h3>
                <p>{t('legal.privacySharingContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyRightsTitle')}</h3>
                <p>{t('legal.privacyRightsContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyCookiesTitle')}</h3>
                <p>{t('legal.privacyCookiesContent')}</p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.privacyContactTitle')}</h3>
                <p>{t('legal.privacyContactContent')}</p>
              </section>
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowPrivacyDialog(false)} data-testid="button-close-privacy">
              {t('common.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
