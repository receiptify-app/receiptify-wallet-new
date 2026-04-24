import { useEffect } from "react";

const SITE_URL = "https://www.receiptify.co.uk";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

type StructuredData = Record<string, unknown> | Record<string, unknown>[];

export interface SeoProps {
  title: string;
  description: string;
  /** Path-only canonical (e.g. "/login"). Defaults to current pathname. */
  path?: string;
  ogImage?: string;
  /** Robots directive. Defaults to "index,follow,max-image-preview:large,max-snippet:-1". */
  robots?: string;
  /** One or more JSON-LD blocks to inject. */
  jsonLd?: StructuredData;
  /** Open Graph type. Defaults to "website". */
  ogType?: string;
}

const MANAGED_ATTR = "data-receiptify-seo";

function setMeta(
  selector: string,
  attrs: Record<string, string>,
  content: string,
) {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    el.setAttribute(MANAGED_ATTR, "1");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string, extra: Record<string, string> = {}) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute(MANAGED_ATTR, "1");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
}

/**
 * Per-page SEO/GEO head manager.
 *
 * Sets <title>, meta description, canonical, Open Graph, Twitter cards
 * and any supplied JSON-LD structured data. Cleans up its own
 * dynamically-injected JSON-LD blocks on unmount so route changes don't
 * stack stale schema.
 */
export function Seo({
  title,
  description,
  path,
  ogImage = DEFAULT_OG_IMAGE,
  robots = "index,follow,max-image-preview:large,max-snippet:-1",
  jsonLd,
  ogType = "website",
}: SeoProps) {
  useEffect(() => {
    const url =
      SITE_URL +
      (path ?? (typeof window !== "undefined" ? window.location.pathname : "/"));

    document.title = title;

    setMeta('meta[name="description"]', { name: "description" }, description);
    setMeta('meta[name="robots"]', { name: "robots" }, robots);
    // Keep bot-specific tags in sync so noindex/follow on auth pages isn't
    // contradicted by hard-coded defaults from index.html.
    setMeta('meta[name="googlebot"]', { name: "googlebot" }, robots);
    setMeta('meta[name="bingbot"]', { name: "bingbot" }, robots);

    setLink("canonical", url);

    setMeta('meta[property="og:type"]', { property: "og:type" }, ogType);
    setMeta('meta[property="og:title"]', { property: "og:title" }, title);
    setMeta(
      'meta[property="og:description"]',
      { property: "og:description" },
      description,
    );
    setMeta('meta[property="og:url"]', { property: "og:url" }, url);
    setMeta('meta[property="og:image"]', { property: "og:image" }, ogImage);
    setMeta(
      'meta[property="og:site_name"]',
      { property: "og:site_name" },
      "Receiptify",
    );

    setMeta(
      'meta[name="twitter:card"]',
      { name: "twitter:card" },
      "summary_large_image",
    );
    setMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    setMeta(
      'meta[name="twitter:description"]',
      { name: "twitter:description" },
      description,
    );
    setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, ogImage);

    // JSON-LD: tag with a unique attribute so we can clean it up on unmount.
    const injected: HTMLScriptElement[] = [];
    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const block of blocks) {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute(MANAGED_ATTR, "ld");
        script.text = JSON.stringify(block);
        document.head.appendChild(script);
        injected.push(script);
      }
    }

    return () => {
      injected.forEach((s) => s.parentNode?.removeChild(s));
    };
  }, [title, description, path, ogImage, robots, ogType, JSON.stringify(jsonLd)]);

  return null;
}

export const SITE_ORIGIN = SITE_URL;
