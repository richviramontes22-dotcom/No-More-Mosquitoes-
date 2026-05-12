import { useEffect } from "react";

const ensureMetaTag = (selector: string, attributes: Record<string, string>, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const ensureLinkTag = (rel: string, href: string) => {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
};

const formatTitle = (title: string) => {
  const suffix = "No More Mosquitoes";
  return title.includes(suffix) ? title : `${title} | ${suffix}`;
};

type SeoProps = {
  title: string;
  description: string;
  canonicalUrl: string;
  jsonLd?: Record<string, unknown>[];
};

const Seo = ({ title, description, canonicalUrl, jsonLd = [] }: SeoProps) => {
  useEffect(() => {
    const formattedTitle = formatTitle(title);
    document.title = formattedTitle;

    ensureMetaTag("meta[name='description']", { name: "description" }, description);
    ensureMetaTag("meta[property='og:title']", { property: "og:title" }, formattedTitle);
    ensureMetaTag("meta[property='og:description']", { property: "og:description" }, description);
    ensureMetaTag("meta[property='og:type']", { property: "og:type" }, "website");
    ensureMetaTag("meta[property='og:url']", { property: "og:url" }, canonicalUrl);
    ensureMetaTag("meta[name='twitter:card']", { name: "twitter:card" }, "summary_large_image");
    ensureMetaTag("meta[name='twitter:title']", { name: "twitter:title" }, formattedTitle);
    ensureMetaTag("meta[name='twitter:description']", { name: "twitter:description" }, description);
    ensureLinkTag("canonical", canonicalUrl);
  }, [title, description, canonicalUrl]);

  return (
    <>
      {jsonLd.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
};

export default Seo;
