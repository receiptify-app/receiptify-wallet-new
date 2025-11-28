import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, QrCode, Smartphone, TrendingUp, Users, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="px-6 py-4 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Digital Receipts</h1>
              <p className="text-sm text-gray-600">Your receipt wallet - store, track, return stress-free</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-green-600 hover:bg-green-700">
                Get Started
              </Button>
            </Link>
            <Link href="/test-auth">
              <Button variant="outline" size="sm" className="text-xs">
                Test Auth
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Go Paperless with <span className="text-green-600">Smart Receipts</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Capture, organize, and track your receipts effortlessly. Save the environment while managing your expenses with our eco-friendly digital receipt platform.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/signup">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 px-8 py-4 text-lg">
                Start Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-8 py-4 text-lg">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section - Commented out per user request
      <section className="px-6 py-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Everything you need to go paperless
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <QrCode className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Instant QR Scanning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Scan any receipt QR code with your camera. Instantly capture transaction details from Square, Tesco, and more.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <Smartphone className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Smart Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Automatic categorization, expense tracking, and receipt splitting. Your receipts organized intelligently.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <Leaf className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Eco Impact Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  See your environmental impact. Track papers saved, CO₂ reduced, and trees protected by going digital.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Expense Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Detailed spending insights, subscription tracking, and budget management tools to control your finances.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <Users className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Bill Splitting</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Split receipts with friends instantly. Generate payment links and track who owes what with ease.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center">
                <ShieldCheck className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <CardTitle className="text-xl">Warranty Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">
                  Never lose a warranty again. Track expiry dates, get reminders, and manage all your product warranties.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      */}

      {/* Stats Section */}
      <section className="px-6 py-16 bg-green-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-12">Join thousands saving the planet</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-4xl font-bold mb-2">50K+</div>
              <div className="text-green-100">Papers Saved</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">2.5K</div>
              <div className="text-green-100">Trees Protected</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">15K</div>
              <div className="text-green-100">Happy Users</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-900 mb-6">
            Ready to go paperless?
          </h3>
          <p className="text-xl text-gray-600 mb-8">
            Join our digital receipt platform today and start making a positive environmental impact while organizing your receipts effortlessly.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-green-600 hover:bg-green-700 px-12 py-4 text-lg">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Leaf className="w-6 h-6 text-green-400" />
            <span className="text-xl font-bold">Digital Receipts</span>
          </div>
          <p className="text-gray-400">OneTap Receipts. Zero Paper. © 2025</p>
        </div>
      </footer>
    </div>
  );
}