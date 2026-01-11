import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { useLocation } from "wouter";
import { useAdmin } from "@/contexts/AdminContext";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

interface LoginForm {
  email: string;
  password: string;
}

interface SetupForm {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
}

export default function AdminLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [, navigate] = useLocation();
  const { login, setupAdmin, checkSetup, isAuthenticated } = useAdmin();
  const { toast } = useToast();

  const loginForm = useForm<LoginForm>();
  const setupForm = useForm<SetupForm>();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/admin/dashboard");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const checkAdminSetup = async () => {
      const needs = await checkSetup();
      setNeedsSetup(needs);
    };
    checkAdminSetup();
  }, [checkSetup]);

  const onLoginSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast({
        title: "Welcome back!",
        description: "Successfully logged in to admin panel.",
      });
      navigate("/admin/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSetupSubmit = async (data: SetupForm) => {
    if (data.password !== data.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (data.password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await setupAdmin(data.email, data.password, data.name);
      toast({
        title: "Admin created!",
        description: "Your admin account has been set up successfully.",
      });
      navigate("/admin/dashboard");
    } catch (error: any) {
      toast({
        title: "Setup failed",
        description: error.message || "Failed to create admin account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (needsSetup === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-10 h-10 text-blue-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {needsSetup ? "Set Up Admin Account" : "Admin Login"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {needsSetup 
              ? "Create the first admin account to manage Receiptify"
              : "Sign in to access the admin dashboard"
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {needsSetup ? (
            <form onSubmit={setupForm.handleSubmit(onSetupSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-200">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    className="pl-10 h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    {...setupForm.register("name", { required: "Name is required" })}
                  />
                </div>
                {setupForm.formState.errors.name && (
                  <p className="text-sm text-red-400">{setupForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@receiptify.com"
                    className="pl-10 h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    {...setupForm.register("email", { required: "Email is required" })}
                  />
                </div>
                {setupForm.formState.errors.email && (
                  <p className="text-sm text-red-400">{setupForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    className="pl-10 pr-10 h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    {...setupForm.register("password", { required: "Password is required" })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 h-4 w-4 text-slate-400 hover:text-slate-200"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-200">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    className="pl-10 h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    {...setupForm.register("confirmPassword", { required: "Please confirm password" })}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Admin Account"}
              </Button>
            </form>
          ) : (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@receiptify.com"
                    className="pl-10 h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    {...loginForm.register("email", { required: "Email is required" })}
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-red-400">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    {...loginForm.register("password", { required: "Password is required" })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3 h-4 w-4 text-slate-400 hover:text-slate-200"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-400">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
