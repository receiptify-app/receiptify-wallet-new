import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Leaf, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { FaGoogle, FaFacebook, FaApple } from "react-icons/fa";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";

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
  const [, navigate] = useLocation();
  const { signup, signInWithGoogle, signInWithFacebook, signInWithApple } = useAuth();
  
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
              <h1 className="text-2xl font-bold text-gray-900">Receiptify</h1>
              <p className="text-sm text-gray-600">OneTap Receipts. Zero Paper.</p>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Create your account
          </CardTitle>
          <p className="text-gray-600">
            Join thousands saving the planet with digital receipts
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
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => handleSocialLogin('facebook')}
              disabled={isLoading}
            >
              <FaFacebook className="w-5 h-5 mr-3 text-blue-600" />
              Continue with Facebook
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-gray-700 border-gray-200 hover:bg-gray-50"
              onClick={() => handleSocialLogin('apple')}
              disabled={isLoading}
            >
              <FaApple className="w-5 h-5 mr-3 text-gray-900" />
              Continue with Apple
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or create with email</span>
            </div>
          </div>

          {/* Email Signup Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  className="pl-10 h-12"
                  {...register("name", {
                    required: "Name is required",
                    minLength: {
                      value: 2,
                      message: "Name must be at least 2 characters"
                    }
                  })}
                />
              </div>
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10 h-12"
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^\S+@\S+$/i,
                      message: "Invalid email address"
                    }
                  })}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="pl-10 pr-10 h-12"
                  {...register("password", {
                    required: "Password is required",
                    minLength: {
                      value: 6,
                      message: "Password must be at least 6 characters"
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  className="pl-10 pr-10 h-12"
                  {...register("confirmPassword", {
                    required: "Please confirm your password",
                    validate: value => value === password || "Passwords do not match"
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
                  required: "You must agree to the terms and conditions"
                })}
              />
              <Label htmlFor="terms" className="text-sm text-gray-600">
                I agree to the{" "}
                <Link href="/terms">
                  <span className="text-green-600 hover:text-green-700">Terms of Service</span>
                </Link>
                {" "}and{" "}
                <Link href="/privacy">
                  <span className="text-green-600 hover:text-green-700">Privacy Policy</span>
                </Link>
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
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="text-center">
            <span className="text-gray-600">Already have an account? </span>
            <Link href="/login">
              <Button variant="link" className="p-0 h-auto text-green-600 hover:text-green-700">
                Sign in
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}