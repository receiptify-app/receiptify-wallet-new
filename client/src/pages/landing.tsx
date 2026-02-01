import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Leaf,
  QrCode,
  Smartphone,
  TrendingUp,
  Users,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import demoVideo from "@assets/generated_videos/receiptify_app_demo_explainer_video.mp4";

export default function Landing() {
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    i18n?.language || "en",
  );
  const [showDemoModal, setShowDemoModal] = useState(false);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem("language", lang);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="px-6 py-4 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="w-8 h-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t("app.title")}
              </h1>
              <p className="text-sm text-gray-600">{t("app.tagline")}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/login">
              <Button
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                {t("landing.signIn")}
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-green-600 hover:bg-green-700">
                {t("landing.getStarted")}
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

      {/* Language selector (above hero) */}
      <div className="px-6 mt-6 max-w-4xl mx-auto flex justify-center">
        <label htmlFor="lang-select" className="sr-only">
          Language
        </label>
        <select
          id="lang-select"
          value={selectedLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="rounded-md border-2 border-gray-300 px-3 py-2 text-sm bg-white"
          aria-label="Select language"
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="es">Español</option>
          <option value="de">Deutsch</option>
        </select>
      </div>

      {/* Hero Section */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            {t("landing.heroTitle")}{" "}
            <span className="text-green-600">{t("landing.heroHighlight")}</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {t("landing.heroDescription")}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 px-8 py-4 text-lg"
              >
                {t("landing.startFreeTrial")}
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-4 text-lg"
              onClick={() => setShowDemoModal(true)}
              data-testid="button-watch-demo"
            >
              {t("landing.watchDemo")}
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
          
          <div className="space-y-4 mb-8">
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
          <h3 className="text-3xl font-bold mb-3">{t("landing.statsTitle")}</h3>
          <div className="grid md:grid-cols-3 gap-8"></div>
          <div className="mt-8">
            <img 
              src="/assets/attached_assets/Screenshot_2026-02-01_at_18.17.33_1769970061396.png" 
              alt="Happy customer using Receiptify" 
              className="rounded-xl shadow-lg mx-auto max-w-md w-full"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-3xl font-bold text-gray-900 mb-6">
            {t("landing.ctaTitle")}
          </h3>
          <p className="text-xl text-gray-600 mb-8">
            {t("landing.ctaDescription")}
          </p>
          <Link href="/signup">
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 px-12 py-4 text-lg"
            >
              {t("landing.startYourFreeTrial")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Leaf className="w-6 h-6 text-green-400" />
            <span className="text-xl font-bold">{t("app.title")}</span>
          </div>
          <p className="text-gray-400">{t("landing.footerTagline")} © 2025</p>
        </div>
      </footer>

      {/* Demo Video Modal */}
      <Dialog open={showDemoModal} onOpenChange={setShowDemoModal}>
        <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-green-600" />
              {t("app.title")} - {t("landing.watchDemo")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("landing.heroDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <video
              src={demoVideo}
              controls
              autoPlay
              className="w-full rounded-lg"
              data-testid="demo-video"
            >
              Your browser does not support the video tag.
            </video>
            <div className="mt-4 text-center">
              <p className="text-gray-600 mb-4">
                {t("landing.heroDescription")}
              </p>
              <Link href="/signup">
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setShowDemoModal(false)}
                  data-testid="button-get-started-modal"
                >
                  {t("landing.getStarted")}
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
