import { useMemo } from "react";
import { Link } from "react-router-dom";
import LogoBranding from "@/components/branding/LogoBranding";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import { useSiteContent } from "@/hooks/useSiteContent";
import { img_dpr_logo_state_of_ca_dpr, img_anaheim_seal, img_state_of_ca_bear_logo } from "@/data/media";
import { siteConfig } from "@/data/site";
import { Instagram, Youtube, Twitter, Facebook } from "lucide-react";

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
  </svg>
);

export const SiteFooter = () => {
  const { user, isHydrated } = useAuth();
  const { t } = useTranslation();
  const cmsFooterTagline = useSiteContent("footer_tagline");
  
  const footerLinks = t("footer.links");
  const serviceAreas = t("footer.serviceAreas");
  const activeUser = isHydrated ? user : null;

  const primaryLinks = useMemo(() => {
    const baseLinks = [
      { label: footerLinks?.home || "Home", path: "/" },
      { label: footerLinks?.pricing || "Pricing & Plans", path: "/pricing" },
      { label: footerLinks?.services || "Services", path: "/services" },
      { label: footerLinks?.ourStory || "Our Story", path: "/our-story" },
      { label: footerLinks?.reviews || "Reviews", path: "/reviews" },
      { label: footerLinks?.faq || "FAQ", path: "/faq" },
      { label: footerLinks?.blog || "Blog", path: "/blog" },
      { label: footerLinks?.schedule || "Schedule", path: "/schedule" },
      { label: footerLinks?.customerLogin || "Customer Login", path: "/login" },
      { label: footerLinks?.contact || "Contact", path: "/contact" },
    ];

    if (!activeUser) return baseLinks;
    return baseLinks.map((link) =>
      link.path === "/login"
        ? { label: footerLinks?.dashboard || "Dashboard", path: "/dashboard" }
        : link,
    );
  }, [activeUser, footerLinks]);

  const legalLinks = [
    { label: footerLinks?.privacy || "Privacy", path: "/privacy" },
    { label: footerLinks?.terms || "Terms", path: "/terms" },
    { label: footerLinks?.guarantee || "Guarantee", path: "/guarantee" },
    { label: footerLinks?.licenses || "Licenses", path: "/licenses" },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/70 bg-gradient-to-b from-background via-background/95 to-muted/40" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        {t("nav.contact")}
      </h2>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex flex-col items-start gap-4">
              <LogoBranding
                style="banner"
                iconClassName="h-16 w-16 sm:h-20 sm:w-20 md:h-[110px] md:w-[110px]"
                textClassName="text-xl sm:text-2xl"
                taglineClassName="text-sm"
              />
              <p className="max-w-md text-sm text-muted-foreground">
                {cmsFooterTagline || t("footer.description")}
              </p>
              <div className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                <a className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href={siteConfig.phone.link}>
                  {t("footer.callOrText")} {siteConfig.phone.display}
                </a>
                <a className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href={`mailto:${siteConfig.email}`}>
                  {siteConfig.email}
                </a>
                <p className="text-sm font-semibold text-foreground">
                  {t("footer.address")}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-8 text-sm font-semibold text-muted-foreground sm:grid-cols-3 sm:gap-6 lg:col-span-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary-foreground/70">
                {t("footer.explore")}
              </p>
              <ul className="mt-4 space-y-2">
                {primaryLinks.map((link) => (
                  <li key={link.path}>
                    <Link className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" to={link.path}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary-foreground/70">
                {t("footer.serviceArea")}
              </p>
              <ul className="mt-4 space-y-2">
                {Array.isArray(serviceAreas) ? serviceAreas.map((area: string) => (
                  <li key={area} className="text-muted-foreground">
                    {area}
                  </li>
                )) : null}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground/80">
                {t("footer.outsideMap")}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary-foreground/70">
                {t("footer.legal")}
              </p>
              <ul className="mt-4 space-y-2">
                {legalLinks.map((link) => (
                  <li key={link.path}>
                    <Link className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" to={link.path}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Social Media Section */}
        <div className="flex flex-wrap items-center justify-center gap-6 border-t border-border/40 pt-8">
          <a
            href="https://www.instagram.com/no.more.mosquitoes"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Follow us on Instagram"
          >
            <Instagram className="h-6 w-6 text-muted-foreground hover:text-primary" />
          </a>
          <a
            href="https://youtube.com/@nomoremosquitoesandbugs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Subscribe on YouTube"
          >
            <Youtube className="h-6 w-6 text-muted-foreground hover:text-primary" />
          </a>
          <a
            href="https://www.tiktok.com/@no.more.mosquitoes"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Follow us on TikTok"
          >
            <span className="text-muted-foreground hover:text-primary transition"><TikTokIcon /></span>
          </a>
          <a
            href="https://x.com/nmmosquitoes"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Follow us on X (Twitter)"
          >
            <Twitter className="h-6 w-6 text-muted-foreground hover:text-primary" />
          </a>
          <a
            href="https://www.facebook.com/profile.php?id=61566525091563"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Follow us on Facebook"
          >
            <Facebook className="h-6 w-6 text-muted-foreground hover:text-primary" />
          </a>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border/40 pt-8">
          {[
            "Licensed",
            "Insured",
            "100% Satisfaction Guarantee",
            "Employee/Community Based Company",
          ].map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary"
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3 flex-shrink-0 fill-primary" aria-hidden>
                <path d="M10.28 2.28L4 8.56 1.72 6.28a1 1 0 0 0-1.44 1.44l3 3a1 1 0 0 0 1.44 0l7-7a1 1 0 0 0-1.44-1.44z" />
              </svg>
              {badge}
            </span>
          ))}
        </div>

        {/* Compliance Section - Simple logos */}
        <div className="flex flex-wrap items-center justify-center gap-8 border-t border-border/40 pt-10">
          <a
            href="https://www.cdpr.ca.gov/wp-content/uploads/2024/08/what_we_do_at_dpr.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:opacity-80 inline-block"
            aria-label="Visit California Department of Pesticide Regulation Licensing"
          >
            <img
              src={img_dpr_logo_state_of_ca_dpr.src}
              alt={img_dpr_logo_state_of_ca_dpr.alt}
              className="h-16 sm:h-20 w-auto grayscale-0"
            />
          </a>

          <a
            href="https://www.ca.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:opacity-80 inline-block"
            aria-label="Visit State of California"
          >
            <img
              src={img_state_of_ca_bear_logo.src}
              alt={img_state_of_ca_bear_logo.alt}
              className="h-16 sm:h-20 w-auto grayscale-0"
            />
          </a>

          <a
            href="https://www.anaheim.net/830/Business-License"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:opacity-80 inline-block"
            aria-label="Visit City of Anaheim Business License"
          >
            <img
              src={img_anaheim_seal.src}
              alt={img_anaheim_seal.alt}
              className="h-32 sm:h-44 w-auto grayscale-0"
            />
          </a>

          <a
            href="https://www.ca.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:opacity-80 inline-block"
            aria-label="State of California Seal"
          >
            <img
              src="/ca-state-seal.jpg"
              alt="State of California Seal"
              className="h-32 sm:h-44 w-auto grayscale-0 object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </a>
        </div>

        <div className="flex flex-col gap-4 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>{(t("footer.copyright") || "© {year} No More Mosquitoes. All rights reserved.").replace("{year}", String(currentYear))}</p>
            <p className="font-medium text-muted-foreground/80 tracking-wide uppercase text-[10px]">
              Pest Control Business-Main License: 57621
            </p>
          </div>
          <p className="flex flex-wrap gap-3">
            <span>{t("footer.attributes")}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
