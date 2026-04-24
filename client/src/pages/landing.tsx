import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Leaf, Check } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

function PhoneMockup({ variant }: { variant: 1 | 2 | 3 }) {
  return (
    <div className="relative mt-5 h-40 flex items-end justify-center overflow-hidden">
      {/* Leaf decorations */}
      <Leaf className="absolute left-2 bottom-2 w-7 h-7 text-emerald-100" />
      <Leaf
        className="absolute right-2 bottom-2 w-7 h-7 text-emerald-100"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Phone frame */}
      <div className="relative w-28 h-40 rounded-[1.4rem] bg-gray-900 p-1 shadow-md">
        <div className="w-full h-full rounded-[1.1rem] bg-white overflow-hidden p-2 flex flex-col gap-1.5">
          {/* status bar dot */}
          <div className="flex justify-center mb-0.5">
            <div className="w-6 h-1 bg-gray-200 rounded-full" />
          </div>
          {variant === 1 && (
            <>
              <div className="h-1.5 w-3/4 bg-gray-300 rounded" />
              <div className="h-1.5 w-1/2 bg-gray-200 rounded" />
              <div className="mt-1 space-y-1">
                <div className="h-1 w-full bg-gray-100 rounded" />
                <div className="h-1 w-5/6 bg-gray-100 rounded" />
                <div className="h-1 w-full bg-gray-100 rounded" />
                <div className="h-1 w-2/3 bg-gray-100 rounded" />
              </div>
            </>
          )}
          {variant === 2 && (
            <>
              <div className="h-1.5 w-2/3 bg-gray-300 rounded" />
              <div className="mt-1 space-y-1.5">
                <div className="h-3 w-full bg-emerald-50 rounded border border-emerald-100" />
                <div className="h-3 w-full bg-gray-50 rounded border border-gray-100" />
                <div className="h-3 w-full bg-emerald-50 rounded border border-emerald-100" />
              </div>
            </>
          )}
          {variant === 3 && (
            <>
              <div className="h-2 w-full bg-gray-100 rounded-full flex items-center px-1">
                <div className="w-1 h-1 rounded-full bg-gray-400" />
              </div>
              <div className="mt-1 space-y-1">
                <div className="h-1 w-full bg-gray-100 rounded" />
                <div className="h-1 w-3/4 bg-gray-100 rounded" />
                <div className="h-1 w-5/6 bg-gray-100 rounded" />
                <div className="h-1 w-2/3 bg-gray-100 rounded" />
                <div className="h-1 w-full bg-gray-100 rounded" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    (i18n?.language || "en").split("-")[0],
  );

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem("language", lang);
    } catch {}
  };

  const benefits = [
    t("landing.whyBenefit1"),
    t("landing.whyBenefit2"),
    t("landing.whyBenefit3"),
    t("landing.whyBenefit4"),
  ];

  const steps = [
    t("landing.howStep1"),
    t("landing.howStep2"),
    t("landing.howStep3"),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-green-50/40 to-white font-sans antialiased">
      <div className="mx-auto max-w-md px-6 pt-10 pb-16">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-16">
          <Leaf className="w-6 h-6 text-emerald-600" />
          <span
            className="text-2xl font-semibold text-gray-900 tracking-tight"
            data-testid="brand-name"
          >
            {t("app.title")}
          </span>
        </div>

        {/* Hero */}
        <section className="text-center">
          <h1 className="text-[2.75rem] leading-[1.05] font-bold tracking-tight text-gray-900">
            <span className="block">{t("landing.heroTitlePart1")}</span>
            <span
              className="block text-emerald-600 mt-1"
              data-testid="hero-highlight"
            >
              {t("landing.heroTitlePart2")}
            </span>
          </h1>

          <p className="mt-7 text-base text-gray-600 leading-relaxed max-w-xs mx-auto">
            {t("landing.heroSubtitle")}
          </p>

          <div className="mt-9 flex items-center justify-center gap-3">
            <Link href="/signup">
              <Button
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-12 text-base font-medium shadow-sm"
                data-testid="button-get-started"
              >
                {t("landing.getStarted")}
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                className="rounded-full bg-white border-gray-200 text-gray-900 hover:bg-gray-50 px-8 h-12 text-base font-medium shadow-sm"
                data-testid="button-sign-in"
              >
                {t("landing.signIn")}
              </Button>
            </Link>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            {t("landing.heroCaption")}
          </p>
        </section>

        {/* Why people use Receiptify */}
        <section className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 leading-tight tracking-tight">
            {t("landing.whyTitle")}
          </h2>
          <div className="mt-7 bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 p-7 space-y-5">
            {benefits.map((benefit, i) => (
              <div
                key={i}
                className="flex items-start gap-3"
                data-testid={`benefit-${i + 1}`}
              >
                <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center mt-0.5">
                  <Check
                    className="w-4 h-4 text-emerald-600"
                    strokeWidth={3}
                  />
                </div>
                <span className="text-[15px] text-gray-800 leading-snug pt-0.5">
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 tracking-tight">
            {t("landing.howTitle")}
          </h2>

          <div className="mt-7 space-y-4">
            {steps.map((step, i) => (
              <div
                key={i}
                className="bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 p-6"
                data-testid={`step-${i + 1}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-emerald-200 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                    {step}
                  </h3>
                </div>
                <PhoneMockup variant={(i + 1) as 1 | 2 | 3} />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Link href="/signup">
              <Button
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-14 h-14 text-base font-medium shadow-md"
                data-testid="button-get-started-bottom"
              >
                {t("landing.getStarted")}
              </Button>
            </Link>
          </div>
        </section>

        {/* Language selector + footer */}
        <footer className="mt-16 flex flex-col items-center gap-3">
          <select
            id="lang-select"
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            aria-label="Select language"
            data-testid="language-selector"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="es">Español</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="pt">Português</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="ar">العربية</option>
            <option value="hi">हिन्दी</option>
          </select>
          <p className="text-xs text-gray-400">
            © 2026 {t("app.title")}
          </p>
        </footer>
      </div>
    </div>
  );
}
