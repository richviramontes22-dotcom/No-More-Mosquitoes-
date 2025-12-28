import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, Phone, X } from "lucide-react";
import LogoCutout from "@/components/branding/LogoCutout";

const NAV_LINKS = [
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

const CONTACT_PHONE_DISPLAY = "(949) 763-0492";
const CONTACT_PHONE_LINK = "tel:+19497630492";

export const SiteHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="relative z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-primary focus:px-5 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-4" aria-label="No More Mosquitoes">
            <LogoCutout size={48} className="shrink-0" alt="No More Mosquitoes logo icon" />
            <div className="leading-tight">
              <p className="font-display text-xl font-semibold text-foreground">
                No More Mosquitoes
              </p>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Orange County, CA
              </p>
            </div>
          </Link>
          <div className="hidden items-center gap-3 lg:flex">
            <nav aria-label="Primary" className="flex items-center gap-1 text-sm font-medium">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring focus-visible:ring-offset-background ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                  end={link.path === "/"}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <Link
              to="/schedule"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:translate-y-px hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Schedule Service
            </Link>
            <a
              href={CONTACT_PHONE_LINK}
              className="group flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Phone className="h-4 w-4" aria-hidden />
              </span>
              Call or Text {CONTACT_PHONE_DISPLAY}
            </a>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span className="sr-only">Toggle navigation</span>
            {isMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
        <div className="flex items-center gap-3 lg:hidden">
          <a
            href={CONTACT_PHONE_LINK}
            className="group flex flex-1 items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <Phone className="h-4 w-4" aria-hidden />
            </span>
            Call or Text {CONTACT_PHONE_DISPLAY}
          </a>
          <Link
            to="/schedule"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Schedule
          </Link>
        </div>
      </div>
      <div
        id="mobile-navigation"
        className={`lg:hidden ${
          isMenuOpen ? "max-h-[80vh] border-t border-border/70" : "max-h-0 overflow-hidden"
        } transition-[max-height] duration-300 ease-in-out`}
      >
        <div className="space-y-2 px-4 pb-6 pt-2 sm:px-6">
          <nav aria-label="Mobile primary" className="grid gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3 py-2 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`
                }
                end={link.path === "/"}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
