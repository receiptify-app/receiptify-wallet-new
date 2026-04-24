import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Check,
  Camera,
  Wallet,
  Search,
  Sparkles,
  ShieldCheck,
  Globe2,
  Layers,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import logoPath from "@assets/R_logo_1777038726271.png";

/* ----------------------------- Helper components --------------------------- */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100/80 text-emerald-800 px-3 py-1 text-[11px] font-semibold tracking-wider">
      {children}
    </span>
  );
}

/** Hero phone mockup — a clean app-screen showing receipt list with Receiptify styling */
function HeroPhone() {
  const items = [
    { name: "Tesco Express", cat: "Groceries", amount: "£24.80" },
    { name: "Shell", cat: "Fuel", amount: "£52.10" },
    { name: "Pret A Manger", cat: "Dining", amount: "£8.45" },
    { name: "Amazon", cat: "Shopping", amount: "£36.99" },
  ];
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px]">
      {/* Soft halo */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[3rem] bg-emerald-200/40 blur-2xl"
      />
      {/* Phone */}
      <div className="rounded-[2.4rem] bg-gray-900 p-2 shadow-[0_30px_60px_-20px_rgba(16,185,129,0.35)]">
        <div className="rounded-[2rem] bg-white overflow-hidden">
          {/* Notch */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1.5 w-16 rounded-full bg-gray-200" />
          </div>
          {/* App header */}
          <div className="px-4 pt-3 pb-4 bg-gradient-to-b from-emerald-50 to-white">
            <div className="mb-3">
              <img
                src={logoPath}
                alt="Receiptify"
                className="h-7 w-auto select-none -my-1"
                draggable={false}
              />
            </div>
            <p className="text-[10px] text-gray-500">This month</p>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">
              £342.18
            </p>
            <div className="mt-2 flex items-center gap-1">
              <span className="inline-flex items-center rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-semibold">
                28 receipts
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[9px] font-semibold">
                ↑ saved 28 papers
              </span>
            </div>
          </div>
          {/* Receipts list */}
          <div className="px-3 pb-4 space-y-2">
            {items.map((it) => (
              <div
                key={it.name}
                className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-[11px] font-semibold text-gray-900">
                      {it.name}
                    </p>
                    <p className="text-[9px] text-gray-500">{it.cat}</p>
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-gray-800">
                  {it.amount}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Annotated receipt — a paper receipt mockup with floating callout pills */
function AnnotatedReceipt({ t }: { t: (k: string) => string }) {
  return (
    <div className="relative mx-auto w-full max-w-[420px] aspect-square">
      {/* Receipt paper */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] sm:w-[200px] rounded-xl bg-white shadow-[0_30px_60px_-20px_rgba(16,185,129,0.35)] border border-gray-100 overflow-hidden">
        <div className="px-4 pt-4 pb-3 text-center border-b border-dashed border-gray-200">
          <p className="text-[11px] font-bold tracking-wider text-gray-900">
            TESCO EXPRESS
          </p>
          <p className="text-[8px] text-gray-500 mt-0.5">
            12 High St, London
          </p>
        </div>
        <div className="px-4 py-3 space-y-1.5">
          {[
            ["Whole milk 2L", "£2.20"],
            ["Sourdough loaf", "£3.50"],
            ["Bananas 1kg", "£1.40"],
            ["Olive oil 500ml", "£6.99"],
            ["Espresso beans", "£10.71"],
          ].map(([n, v]) => (
            <div
              key={n}
              className="flex items-center justify-between text-[9px] text-gray-700"
            >
              <span>{n}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-dashed border-gray-200 flex items-center justify-between text-[10px] font-bold">
          <span>TOTAL</span>
          <span>£24.80</span>
        </div>
        <div className="px-4 py-2 text-center text-[8px] text-gray-400">
          THANK YOU
        </div>
      </div>

      {/* Callout pills */}
      <Callout
        label={t("landing.captureField1")}
        className="left-2 top-12"
        align="right"
      />
      <Callout
        label={t("landing.captureField2")}
        className="right-2 top-6"
        align="left"
      />
      <Callout
        label={t("landing.captureField4")}
        className="left-0 top-1/2"
        align="right"
      />
      <Callout
        label={t("landing.captureField3")}
        className="right-0 bottom-16"
        align="left"
      />
      <Callout
        label={t("landing.captureField5")}
        className="left-4 bottom-6"
        align="right"
      />
    </div>
  );
}

function Callout({
  label,
  className = "",
  align = "left",
}: {
  label: string;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`absolute inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-100 px-2.5 py-1 text-[10px] font-bold tracking-wider text-emerald-700 shadow-md ${className}`}
    >
      {align === "right" && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      )}
      <span>{label}</span>
      {align === "left" && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      )}
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */

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
    {
      label: t("landing.howStep1"),
      icon: Camera,
    },
    {
      label: t("landing.howStep2"),
      icon: Wallet,
    },
    {
      label: t("landing.howStep3"),
      icon: Search,
    },
  ];

  const differentiators = [
    {
      icon: Sparkles,
      title: t("landing.diff1Title"),
      body: t("landing.diff1Body"),
    },
    {
      icon: ShieldCheck,
      title: t("landing.diff2Title"),
      body: t("landing.diff2Body"),
    },
    {
      icon: Layers,
      title: t("landing.diff3Title"),
      body: t("landing.diff3Body"),
    },
    {
      icon: Globe2,
      title: t("landing.diff4Title"),
      body: t("landing.diff4Body"),
    },
  ];

  const walletBullets = [
    t("landing.walletBullet1"),
    t("landing.walletBullet2"),
    t("landing.walletBullet3"),
  ];

  const insightsBullets = [
    t("landing.insightsBullet1"),
    t("landing.insightsBullet2"),
    t("landing.insightsBullet3"),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-green-50/40 to-white font-sans antialiased">
      {/* Sticky pill nav */}
      <nav className="sticky top-3 z-50 px-3 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-full bg-white/95 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center"
            aria-label={t("app.title")}
            data-testid="brand-link"
          >
            <img
              src={logoPath}
              alt={t("app.title")}
              className="h-12 sm:h-14 w-auto select-none -my-2"
              draggable={false}
            />
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-gray-700">
            <a
              href="#product"
              className="hover:text-emerald-700 transition-colors"
            >
              {t("landing.navProduct")}
            </a>
            <a
              href="#how"
              className="hover:text-emerald-700 transition-colors"
            >
              {t("landing.navHowItWorks")}
            </a>
            <a
              href="#why"
              className="hover:text-emerald-700 transition-colors"
            >
              {t("landing.navWhy")}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button
                variant="ghost"
                className="rounded-full text-gray-800 hover:bg-gray-100 h-9 px-4 text-sm hidden sm:inline-flex"
                data-testid="nav-button-sign-in"
              >
                {t("landing.signIn")}
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-5 text-sm font-medium shadow-sm"
                data-testid="nav-button-get-started"
              >
                {t("landing.getStarted")}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6">
        {/* HERO */}
        <section className="pt-12 sm:pt-20 pb-16 sm:pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <Pill>{t("landing.heroBadge")}</Pill>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.05] font-bold tracking-tight text-gray-900">
              <span className="block">{t("landing.heroTitlePart1")}</span>
              <span
                className="block text-emerald-600 mt-1"
                data-testid="hero-highlight"
              >
                {t("landing.heroTitlePart2")}
              </span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-md mx-auto md:mx-0">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-8 flex items-center justify-center md:justify-start gap-3">
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
            <p className="mt-6 text-sm text-gray-500 text-center md:text-left">
              {t("landing.heroCaption")}
            </p>
          </div>

          <div className="flex justify-center md:justify-end">
            <HeroPhone />
          </div>
        </section>

        {/* VALUE PROP BAND */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className="text-2xl sm:text-3xl md:text-[2.25rem] font-bold tracking-tight text-gray-900 leading-tight"
              data-testid="value-prop-title"
            >
              {t("landing.valuePropTitle")}
            </h2>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed">
              {t("landing.valuePropBody")}
            </p>
          </div>
        </section>

        {/* SMART CAPTURE — annotated receipt */}
        <section
          id="product"
          className="py-14 sm:py-20 grid md:grid-cols-2 gap-12 items-center"
        >
          <div className="order-2 md:order-1">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-8 sm:p-10">
              <AnnotatedReceipt t={t} />
            </div>
          </div>
          <div className="order-1 md:order-2 text-center md:text-left">
            <Pill>{t("landing.captureBadge")}</Pill>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">
              {t("landing.captureTitle")}
            </h2>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-md mx-auto md:mx-0">
              {t("landing.captureBody")}
            </p>
          </div>
        </section>

        {/* ONE WALLET — alternating */}
        <section className="py-14 sm:py-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="text-center md:text-left">
            <Pill>{t("landing.walletBadge")}</Pill>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">
              {t("landing.walletTitle")}
            </h2>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-md mx-auto md:mx-0">
              {t("landing.walletBody")}
            </p>
            <ul className="mt-6 space-y-3 max-w-md mx-auto md:mx-0">
              {walletBullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-left"
                  data-testid="wallet-bullet"
                >
                  <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center mt-0.5">
                    <Check
                      className="w-3.5 h-3.5 text-emerald-600"
                      strokeWidth={3}
                    />
                  </span>
                  <span className="text-[15px] text-gray-800 leading-snug">
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-8 sm:p-10">
              <HeroPhone />
            </div>
          </div>
        </section>

        {/* CLEAR INSIGHTS — alternating with a dashboard chip */}
        <section className="py-14 sm:py-20 grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-8 sm:p-10">
              <InsightsCard />
            </div>
          </div>
          <div className="order-1 md:order-2 text-center md:text-left">
            <Pill>{t("landing.insightsBadge")}</Pill>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight">
              {t("landing.insightsTitle")}
            </h2>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-md mx-auto md:mx-0">
              {t("landing.insightsBody")}
            </p>
            <ul className="mt-6 space-y-3 max-w-md mx-auto md:mx-0">
              {insightsBullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-left">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center mt-0.5">
                    <Check
                      className="w-3.5 h-3.5 text-emerald-600"
                      strokeWidth={3}
                    />
                  </span>
                  <span className="text-[15px] text-gray-800 leading-snug">
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* DIFFERENTIATORS */}
        <section id="why" className="py-14 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              {t("landing.diffTitle")}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600">
              {t("landing.diffSubtitle")}
            </p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {differentiators.map((d, i) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.title}
                  className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-7"
                  data-testid={`diff-${i + 1}`}
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900 tracking-tight">
                    {d.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    {d.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* HOW IT WORKS — refined 3 step row */}
        <section id="how" className="py-14 sm:py-20">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center text-gray-900">
            {t("landing.howTitle")}
          </h2>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="relative bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-7"
                  data-testid={`step-${i + 1}`}
                >
                  <span className="absolute -top-3 left-7 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white text-sm font-semibold shadow-sm">
                    {i + 1}
                  </span>
                  <div className="mt-3 w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-gray-900 tracking-tight leading-tight">
                    {step.label}
                  </h3>
                </div>
              );
            })}
          </div>
        </section>

        {/* WHY PEOPLE USE — keep existing benefits card */}
        <section className="py-14 sm:py-20">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 leading-tight tracking-tight">
            {t("landing.whyTitle")}
          </h2>
          <div className="mt-8 mx-auto max-w-xl bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 p-7 sm:p-9 space-y-5">
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

        {/* FINAL CTA */}
        <section className="py-14 sm:py-20">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-500 to-emerald-700 px-8 py-14 sm:px-14 sm:py-20 text-center text-white shadow-[0_30px_60px_-20px_rgba(16,185,129,0.55)]">
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-15"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4) 0, transparent 40%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.35) 0, transparent 45%)",
              }}
            />
            <h2 className="relative text-3xl sm:text-4xl font-bold tracking-tight max-w-xl mx-auto leading-tight">
              {t("landing.finalCtaTitle")}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-emerald-50 max-w-md mx-auto">
              {t("landing.finalCtaBody")}
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/signup">
                <Button
                  className="rounded-full bg-white text-emerald-700 hover:bg-emerald-50 px-10 h-12 text-base font-semibold shadow-md"
                  data-testid="button-final-cta"
                >
                  {t("landing.getStarted")}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 flex flex-col items-center gap-4">
          <img
            src={logoPath}
            alt={t("app.title")}
            className="h-8 w-auto select-none opacity-90"
            draggable={false}
          />
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
            © 2026 {t("app.title")} · {t("landing.footerTagline")}
          </p>
        </footer>
      </main>
    </div>
  );
}

/* --------------------------- Insights mock card --------------------------- */

function InsightsCard() {
  const cats = [
    { name: "Groceries", value: 342, color: "bg-emerald-500", w: "w-full" },
    { name: "Transport", value: 89, color: "bg-emerald-400", w: "w-1/3" },
    { name: "Dining", value: 156, color: "bg-emerald-300", w: "w-1/2" },
    { name: "Shopping", value: 203, color: "bg-emerald-600", w: "w-2/3" },
  ];
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">This month</p>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">
            £790.00
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[11px] font-semibold">
          ↓ 12% vs last
        </span>
      </div>
      <div className="mt-6 space-y-3">
        {cats.map((c) => (
          <div key={c.name}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-700 font-medium">{c.name}</span>
              <span className="text-gray-900 font-semibold">£{c.value}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full ${c.w} ${c.color} rounded-full`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
