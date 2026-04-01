import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Leaf, Mail, RefreshCw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyEmail() {
  const { currentUser, logout, resendVerificationEmail } = useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for the resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      setCooldown(60);
    } catch {
      // toast is shown inside resendVerificationEmail
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerified = async () => {
    setChecking(true);
    try {
      // Reload the Firebase user to pick up the updated emailVerified flag
      await currentUser?.reload();
      // Force a page refresh so AuthenticatedRouter re-evaluates
      window.location.reload();
    } catch {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card className="shadow-xl border-0">
          <CardContent className="p-8 text-center space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <Mail className="w-10 h-10 text-green-600" />
              </div>
            </div>

            {/* Logo */}
            <div className="flex items-center justify-center gap-2">
              <Leaf className="w-5 h-5 text-green-600" />
              <span className="font-bold text-gray-900">Receiptify</span>
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">Check your inbox</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                We sent a verification link to
              </p>
              <p className="font-semibold text-gray-800 text-sm break-all">
                {currentUser?.email}
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                Click the link in that email to verify your account and continue.
              </p>
            </div>

            {/* Primary action */}
            <Button
              onClick={handleCheckVerified}
              disabled={checking}
              className="w-full h-12 bg-green-600 hover:bg-green-700"
            >
              {checking ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Checking…</>
              ) : (
                "I've verified my email"
              )}
            </Button>

            {/* Resend */}
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Didn't receive it?</p>
              <Button
                variant="ghost"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="text-green-600 hover:text-green-700 h-auto py-1"
              >
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : resending
                  ? "Sending…"
                  : "Resend verification email"}
              </Button>
            </div>

            {/* Tips */}
            <div className="bg-amber-50 rounded-xl p-4 text-left space-y-1">
              <p className="text-xs font-semibold text-amber-800">Not seeing it?</p>
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                <li>Check your spam or junk folder</li>
                <li>Make sure you entered the right email</li>
                <li>Wait a minute and try resending</li>
              </ul>
            </div>

            {/* Sign out */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mx-auto transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Sign out and use a different account
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
