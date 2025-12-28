import { Link } from "react-router-dom";
import LogoCutout from "@/components/branding/LogoCutout";

const primaryLinks = [
  { label: "Home", path: "/" },
  { label: "Pricing & Plans", path: "/pricing" },
  { label: "Services", path: "/services" },
  { label: "Our Story", path: "/our-story" },
  { label: "Reviews", path: "/reviews" },
  { label: "Service Area", path: "/service-area" },
  { label: "FAQ", path: "/faq" },
  { label: "Blog", path: "/blog" },
  { label: "Schedule", path: "/schedule" },
  { label: "Customer Login", path: "/login" },
  { label: "Contact", path: "/contact" },
];

const legalLinks = [
  { label: "Privacy", path: "/privacy" },
  { label: "Terms", path: "/terms" },
  { label: "Guarantee", path: "/guarantee" },
  { label: "Licenses", path: "/licenses" },
];

const serviceAreas = [
  "Orange County",
  "Newport Beach",
  "Irvine",
  "Costa Mesa",
  "Mission Viejo",
  "Laguna Niguel",
  "Huntington Beach",
];

const CONTACT_EMAIL = "richard@nomoremosquitoes.us";
const CONTACT_PHONE_DISPLAY = "(949) 763-0492";
const CONTACT_PHONE_LINK = "tel:+19497630492";

export const SiteFooter = () => {
  return (
    <footer className="border-t border-border/70 bg-gradient-to-b from-background via-background/95 to-muted/40" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex flex-col items-start gap-4">
              <div className="flex items-center gap-3">
                <LogoCutout size={52} className="shrink-0" alt="No More Mosquitoes icon" />
                <div className="leading-tight">
                  <p className="font-display text-2xl font-semibold text-foreground">
                    No More Mosquitoes
                  </p>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Premium Mosquito & Pest Control
                  </p>
                </div>
              </div>
              <p className="max-w-md text-sm text-muted-foreground">
                We treat mosquitoes, ticks, ants, spiders, and the pests that keep your family indoors. Every visit comes with a completion video, proactive prevention notes, and weather-adjusted scheduling.
              </p>
              <div className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                <a className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" href={CONTACT_PHONE_LINK}>
                  Call or Text {CONTACT_PHONE_DISPLAY}
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
                Explore
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
                Service Area
              </p>
              <ul className="mt-4 space-y-2">
                {serviceAreas.map((area) => (
                  <li key={area} className="text-muted-foreground">
                    {area}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground/80">
                Outside our map? Join the waitlist in the address checker.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-secondary-foreground/70">
                Legal
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
                <p className="font-semibold text-foreground">Compliance & Tracking</p>
                <p className="mt-2">
                  GA4 (Consent Mode), GSC, and call tracking placeholders are configured for deployment. Confirm DNS + SSL before launch.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} No More Mosquitoes. All rights reserved.</p>
          <p className="flex flex-wrap gap-3">
            <span>California Structural Pest Control License pending publication.</span>
            <span>Insured • Employee-based technicians • 100% satisfaction guarantee.</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
