import { useMemo } from "react";
import { Link } from "react-router-dom";
import LogoCutout from "@/components/branding/LogoCutout";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";

const CONTACT_EMAIL = "richard@nomoremosquitoes.us";
const CONTACT_PHONE_DISPLAY = "(949) 763-0492";
const CONTACT_PHONE_LINK = "tel:+19497630492";

export const SiteFooter = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const footerLinks = t("footer.links");
  const serviceAreas = t("footer.serviceAreas");
  
  const primaryLinks = useMemo(() => {
    const baseLinks = [
      { label: footerLinks.home, path: "/" },
      { label: footerLinks.pricing, path: "/pricing" },
      { label: footerLinks.services, path: "/services" },
      { label: footerLinks.ourStory, path: "/our-story" },
      { label: footerLinks.reviews, path: "/reviews" },
      { label: footerLinks.serviceArea, path: "/service-area" },
      { label: footerLinks.faq, path: "/faq" },
      { label: footerLinks.blog, path: "/blog" },
      { label: footerLinks.schedule, path: "/schedule" },
      { label: footerLinks.customerLogin, path: "/login" },
      { label: footerLinks.contact, path: "/contact" },
    ];
    
    if (!user) return baseLinks;
    return baseLinks.map((link) =>
      link.path === "/login"
        ? { label: footerLinks.dashboard, path: "/dashboard" }
        : link,
    );
  }, [user, footerLinks]);

  const legalLinks = [
    { label: footerLinks.privacy, path: "/privacy" },
    { label: footerLinks.terms, path: "/terms" },
    { label: footerLinks.guarantee, path: "/guarantee" },
    { label: footerLinks.licenses, path: "/licenses" },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/70 bg-gradient-to-b from-background via-background/95 to-muted/40" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        {t("nav.contact")}
      </h2>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-3">
                <LogoCutout size={110} className="shrink-0" alt="No More Mosquitoes icon" />
                <div className="leading-tight">
                  <p className="font-display text-2xl font-semibold text-foreground">
                    No More Mosquitoes
                  </p>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {t("footer.tagline")}
                  </p>
                </div>
              </div>
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
                {serviceAreas.map((area: string) => (
                  <li key={area} className="text-muted-foreground">
                    {area}
                  </li>
                ))}
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
              <div className="mt-6 rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">{t("footer.compliance")}</p>
                <p className="mt-2">
                  {t("footer.complianceDesc")}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright").replace("{year}", String(currentYear))}</p>
          <p className="flex flex-wrap gap-3">
            <span>{t("footer.licenses")}</span>
            <span>{t("footer.attributes")}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
