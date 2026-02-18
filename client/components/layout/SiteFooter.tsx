import { useMemo } from "react";
import { Link } from "react-router-dom";
import LogoBranding from "@/components/branding/LogoBranding";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import { img_dpr_logo_state_of_ca_dpr, img_anaheim_seal, img_state_of_ca_bear_logo } from "@/data/media";

const CONTACT_EMAIL = "richard@nomoremosquitoes.us";
const CONTACT_PHONE_DISPLAY = "(949) 297-6225";
const CONTACT_PHONE_LINK = "tel:+19492976225";

export const SiteFooter = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const footerLinks = t("footer.links");
  const serviceAreas = t("footer.serviceAreas");

  const primaryLinks = useMemo(() => {
    const baseLinks = [
      { label: footerLinks?.home || "Home", path: "/" },
      { label: footerLinks?.pricing || "Pricing & Plans", path: "/pricing" },
      { label: footerLinks?.services || "Services", path: "/services" },
      { label: footerLinks?.ourStory || "Our Story", path: "/our-story" },
      { label: footerLinks?.reviews || "Reviews", path: "/reviews" },
      { label: footerLinks?.serviceArea || "Service Area", path: "/service-area" },
      { label: footerLinks?.faq || "FAQ", path: "/faq" },
      { label: footerLinks?.blog || "Blog", path: "/blog" },
      { label: footerLinks?.schedule || "Schedule", path: "/schedule" },
      { label: footerLinks?.customerLogin || "Customer Login", path: "/login" },
      { label: footerLinks?.contact || "Contact", path: "/contact" },
    ];

    if (!user) return baseLinks;
    return baseLinks.map((link) =>
      link.path === "/login"
        ? { label: footerLinks?.dashboard || "Dashboard", path: "/dashboard" }
        : link,
    );
  }, [user, footerLinks]);

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
                {t("footer.description")}
              </p>
              <div className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                <a className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href={CONTACT_PHONE_LINK}>
                  {t("footer.callOrText")} {CONTACT_PHONE_DISPLAY}
                </a>
                <a className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
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

        {/* Compliance Section - Simple logos */}
        <div className="flex flex-wrap items-center justify-center gap-8 border-t border-border/40 pt-10">
          <a
            href="https://www.cdpr.ca.gov/docs/license/index.htm"
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
        </div>

        <div className="flex flex-col gap-2 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{(t("footer.copyright") || "© {year} No More Mosquitoes. All rights reserved.").replace("{year}", String(currentYear))}</p>
          <p className="flex flex-wrap gap-3">
            <span>{t("footer.attributes")}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
