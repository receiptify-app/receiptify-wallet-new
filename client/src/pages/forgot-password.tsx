import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft } from "lucide-react";
import logoPath from "@assets/R_logo_1777038726271.png";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { useTranslation } from 'react-i18next';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword } = useAuth();
  const { t } = useTranslation();
  
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>();

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      await resetPassword(data.email);
      setEmailSent(true);
    } catch (error) {
      console.error("Password reset error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
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
              <div className="hidden">
                <h1 className="text-2xl font-bold text-gray-900">{t('app.title')}</h1>
                <p className="text-sm text-gray-600">{t('landing.footerTagline')}</p>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {t('auth.checkEmail')}
            </CardTitle>
            <p className="text-gray-600">
              {t('auth.checkEmailDesc')}
            </p>
          </CardHeader>

          <CardContent>
            <Link href="/login">
              <Button className="w-full h-12 bg-green-600 hover:bg-green-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('auth.backToSignIn')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
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
            <div className="hidden">
              <h1 className="text-2xl font-bold text-gray-900">{t('app.title')}</h1>
              <p className="text-sm text-gray-600">{t('landing.footerTagline')}</p>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            {t('auth.resetPasswordTitle')}
          </CardTitle>
          <p className="text-gray-600">
            {t('auth.resetPasswordDesc')}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
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

            <Button
              type="submit"
              className="w-full h-12 bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              {isLoading ? t('auth.sendingLink') : t('auth.sendResetLink')}
            </Button>
          </form>

          <div className="text-center">
            <Link href="/login">
              <Button variant="link" className="p-0 h-auto text-green-600 hover:text-green-700">
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t('auth.backToSignIn')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
