import { Link } from "wouter";
import { Seo } from "@/components/seo";
import logoPath from "@assets/R_logo_1777038726271.png";

interface Section {
  heading: string;
  description: string;
  links: { href: string; label: string; description: string }[];
}

const sections: Section[] = [
  {
    heading: "Get started",
    description:
      "Create an account or sign in to your existing Receiptify wallet.",
    links: [
      {
        href: "/",
        label: "Home",
        description:
          "Product overview, features, FAQ and how Receiptify works.",
      },
      {
        href: "/signup",
        label: "Sign up",
        description: "Create a free Receiptify account.",
      },
      {
        href: "/login",
        label: "Sign in",
        description:
          "Sign in with Google or with your email address and password.",
      },
      {
        href: "/forgot-password",
        label: "Forgot password",
        description: "Recover access to your account by email.",
      },
    ],
  },
  {
    heading: "What you can do inside Receiptify",
    description:
      "These features are available to signed-in users. Sign in or sign up first to access them.",
    links: [
      {
        href: "/signup",
        label: "Snap a receipt",
        description:
          "Capture any paper receipt with the camera; AI reads merchant, date, total, currency and category automatically.",
      },
      {
        href: "/signup",
        label: "Email forwarding inbox",
        description:
          "Forward any email receipt to your personal Receiptify inbox; it is parsed and added to your wallet.",
      },
      {
        href: "/signup",
        label: "Spending insights",
        description:
          "See monthly totals, category breakdowns and month-over-month comparisons in your local currency.",
      },
      {
        href: "/signup",
        label: "Loyalty cards",
        description:
          "Store loyalty cards from major UK retailers alongside their receipts.",
      },
      {
        href: "/signup",
        label: "Warranty tracker",
        description:
          "Add a warranty length to any receipt; expiry dates are calculated automatically.",
      },
      {
        href: "/signup",
        label: "Subscription detection",
        description:
          "Recurring purchases are detected from your receipts so you can pause or cancel them.",
      },
      {
        href: "/signup",
        label: "Receipt splitting",
        description:
          "Pick line items per person, send a payment link and track who has paid.",
      },
      {
        href: "/signup",
        label: "Map view",
        description:
          "See where each receipt was issued on an interactive map.",
      },
      {
        href: "/signup",
        label: "CSV / PDF exports",
        description:
          "Download your full receipt history for accounting or HMRC submission.",
      },
    ],
  },
];

export default function SitemapPage() {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.receiptify.co.uk/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Site map",
        item: "https://www.receiptify.co.uk/sitemap",
      },
    ],
  };

  return (
    <>
      <Seo
        title="Site map — Receiptify"
        description="Browse every public page on Receiptify, the UK's digital receipt wallet. Find sign-up, sign-in and an overview of every feature available inside the app."
        path="/sitemap"
        jsonLd={breadcrumb}
      />
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-green-50/40 to-white font-sans antialiased">
        <header className="sticky top-3 z-50 px-3 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-full bg-white/95 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center"
              aria-label="Receiptify"
              data-testid="brand-link"
            >
              <img
                src={logoPath}
                alt="Receiptify"
                className="h-12 sm:h-14 w-auto select-none -my-2"
                draggable={false}
              />
            </Link>
            <Link
              href="/"
              className="text-sm text-emerald-700 hover:underline"
              data-testid="back-home"
            >
              ← Back to home
            </Link>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto max-w-4xl px-6 pt-12 pb-20"
        >
          <nav aria-label="Breadcrumb" className="text-xs text-gray-500 mb-4">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-emerald-700">
                  Home
                </Link>
              </li>
              <li aria-hidden>›</li>
              <li className="text-gray-700">Site map</li>
            </ol>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Receiptify site map
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl">
            Every public page on Receiptify, the UK's digital receipt wallet.
            Use this map to jump straight to the area you need, or to discover
            what is available before you sign up.
          </p>

          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
                  {section.heading}
                </h2>
                <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                  {section.description}
                </p>
                <ul className="mt-5 grid sm:grid-cols-2 gap-4">
                  {section.links.map((link) => (
                    <li
                      key={`${section.heading}-${link.label}`}
                      className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5"
                    >
                      <Link
                        href={link.href}
                        className="text-emerald-700 font-semibold hover:underline"
                        data-testid={`sitemap-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {link.label}
                      </Link>
                      <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                        {link.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <footer className="mt-16 pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
            Looking for the machine-readable sitemap? It's at{" "}
            <a
              href="/sitemap.xml"
              className="text-emerald-700 hover:underline"
            >
              /sitemap.xml
            </a>
            .
          </footer>
        </main>
      </div>
    </>
  );
}
