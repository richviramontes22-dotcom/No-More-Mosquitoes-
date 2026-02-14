# No More Mosquitoes – Checkpoint (pre-secondary routes)

## Summary
- Global shell, homepage experience, pricing logic, and SEO scaffolding are live against the NMM brand system.
- Secondary routes still render the shared PlaceholderPage; bespoke content and integrations remain to be implemented.
- Data files, styling tokens, and interactive homepage sections provide the baseline for completing the sitemap.

## Outstanding Work
1. Replace each placeholder route with dedicated page modules and SEO metadata.
2. Wire address autocomplete, schedule request submission to /api/schedule-requests, consent-mode analytics, and portal/login flows.
3. Run responsive and accessibility QA (Lighthouse ≥90, axe clean) and extend automated tests once new pages land.

## Reference Code
### client/App.tsx
```tsx
import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PlaceholderPage from "./pages/Placeholder";

const queryClient = new QueryClient();

const PLACEHOLDER_ROUTES = [
  {
    path: "/pricing",
    title: "Pricing & Plans",
    description:
      "Dive into acreage-based tiers, visit frequencies, and transparent billing so you know exactly what every program includes before you book.",
  },
  {
    path: "/services",
    title: "Services",
    description:
      "Explore how we tackle mosquitoes, ticks, ants, spiders, and more with eco-conscious treatments and detailed completion videos after every visit.",
  },
  {
    path: "/our-story",
    title: "Our Story",
    description:
      "Meet the family behind No More Mosquitoes and learn how Grandma’s backyard sparked a mission to protect every gathering in Orange County.",
  },
  {
    path: "/reviews",
    title: "Reviews",
    description:
      "Hear from OC neighbors about their experience with our friendly technicians, responsive communication, and mosquito-free backyards.",
  },
  {
    path: "/service-area",
    title: "Service Area",
    description:
      "See the cities and neighborhoods we currently serve. Outside the map? Join the waitlist so we can alert you when routes open.",
  },
  {
    path: "/faq",
    title: "FAQ",
    description:
      "Find answers about safety, product ingredients, visit timing, weather adjustments, and what to expect on service day.",
  },
  {
    path: "/blog",
    title: "Blog",
    description:
      "Stay ahead of seasonal pest trends and get prevention tips straight from our licensed Orange County technicians.",
  },
  {
    path: "/schedule",
    title: "Schedule Service",
    description:
      "We’re finalizing the automated scheduling flow. In the meantime, share your address, preferred frequency, and we’ll confirm your route within one business day.",
    callToActionLabel: "Request My First Visit",
  },
  {
    path: "/login",
    title: "Customer Login",
    description:
      "Access visit videos, technician notes, ETA updates, invoices, and auto-pay settings in our secure customer portal.",
    callToActionLabel: "Email Me Portal Access",
    callToActionPath: "/contact",
  },
  {
    path: "/contact",
    title: "Contact",
    description:
      "Reach our local office for quotes, billing, or technician dispatch. We reply to calls, texts, and emails Monday–Saturday 7a–7p.",
    callToActionLabel: "Call or Text Now",
    callToActionPath: "tel:+19497630492",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "Review how we handle your contact details, property data, and consent preferences across analytics, call tracking, and service reminders.",
    callToActionLabel: "Request Data Report",
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description:
      "Understand scheduling expectations, safety commitments, guarantees, and how we handle weather-related adjustments.",
  },
  {
    path: "/guarantee",
    title: "Satisfaction Guarantee",
    description:
      "If mosquitoes return between scheduled visits, we re-service at no charge. Learn exactly how our 100% guarantee protects your home.",
  },
  {
    path: "/licenses",
    title: "Licenses & Insurance",
    description:
      "View current California structural pest control licensing, insurance certificates, and safety documentation.",
  },
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<Index />} />
            {PLACEHOLDER_ROUTES.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <PlaceholderPage
                    title={route.title}
                    description={route.description}
                    callToActionLabel={route.callToActionLabel}
                    callToActionPath={route.callToActionPath}
                  />
                }
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
```

### client/components/layout/MainLayout.tsx
```tsx
import { Outlet } from "react-router-dom";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

const MainLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
};

export default MainLayout;
```

### client/components/layout/SiteHeader.tsx
```tsx
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
```

### client/components/layout/SiteFooter.tsx
```tsx
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
```
test

### client/components/branding/LogoCutout.tsx
~~~tsx
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type LogoCutoutProps = {
  className?: string;
  size?: number;
  alt?: string;
};

const LOGO_SRC =
  "https://cdn.builder.io/api/v1/image/assets%2F3f65886cb3984feeb522bf6a7d2292f8%2F637d887b9fb2441e96a15f40c8df1eca?format=webp&width=800";

export const LogoCutout = forwardRef<HTMLDivElement, LogoCutoutProps>(
  ({ className, size = 48, alt = "No More Mosquitoes icon" }, ref) => {
    const dimension = typeof size === "number" ? `${size}px` : size;

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 shadow-soft",
          className,
        )}
        style={{ width: dimension, height: dimension }}
      >
        <img
          src={LOGO_SRC}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover object-top"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-0 rounded-full border border-white/20" aria-hidden />
      </div>
    );
  },
);

LogoCutout.displayName = "LogoCutout";

export default LogoCutout;
~~~

### client/components/common/SectionHeading.tsx
~~~tsx
type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
  highlight?: string;
};

const SectionHeading = ({ eyebrow, title, description, centered, highlight }: SectionHeadingProps) => {
  return (
    <div className={`flex flex-col gap-4 ${centered ? "text-center" : "text-left"}`}>
      {eyebrow ? (
        <span className="self-start rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
          {eyebrow}
        </span>
      ) : null}
      <h2 className={`font-display text-3xl font-semibold text-foreground sm:text-4xl lg:text-5xl ${centered ? "mx-auto max-w-3xl" : "max-w-2xl"}`}>
        {highlight ? (
          <>
            {title.split(highlight)[0]}
            <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              {highlight}
            </span>
            {title.split(highlight)[1] ?? ""}
          </>
        ) : (
          title
        )}
      </h2>
      {description ? (
        <p className={`${centered ? "mx-auto max-w-3xl" : "max-w-2xl"} text-lg text-muted-foreground`}>{description}</p>
      ) : null}
    </div>
  );
};

export default SectionHeading;
~~~

### client/components/sections/HeroSection.tsx
~~~tsx
import { Link } from "react-router-dom";
import { heroHighlights } from "@/data/site";
import { heroImage } from "@/data/media";
import { ArrowRight, CheckCircle2, Phone } from "lucide-react";

const CONTACT_PHONE_DISPLAY = "(949) 763-0492";
const CONTACT_PHONE_LINK = "tel:+19497630492";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-hero-radial">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/8 via-background to-secondary/10" aria-hidden />
      <div className="absolute inset-y-0 right-0 -z-10 hidden lg:block">
        <div className="h-full w-[520px] bg-mesh-overlay opacity-80" />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pb-20 pt-24 sm:px-6 lg:flex-row lg:items-center lg:gap-20 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="flex-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
            Premium Mosquito & Pest Control
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold text-foreground sm:text-5xl lg:text-6xl">
            Bugs Don’t Belong in Your Home.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Safe, fast, reliable mosquito and pest control in Orange County—backed by our 100% satisfaction guarantee. We combine precise formulations with HD completion videos so you see exactly what we treat on every visit.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/schedule"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Schedule Service
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
            </Link>
            <a
              href="#address-checker"
              className="inline-flex items-center gap-2 rounded-full border border-border/80 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Check Pricing by Address
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href={CONTACT_PHONE_LINK}
              className="inline-flex items-center gap-2 rounded-full border border-transparent bg-secondary/80 px-6 py-3 text-sm font-semibold text-secondary-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Call or Text {CONTACT_PHONE_DISPLAY}
            </a>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {heroHighlights.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/80 bg-card/80 p-5 shadow-soft backdrop-blur"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {item.value}
                </p>
                <p className="mt-2 text-sm font-semibold text-muted-foreground">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex-1">
          <div className="relative z-10 overflow-hidden rounded-[36px] border border-primary/20 bg-white/90 shadow-[0_30px_80px_-40px_rgba(10,45,66,0.6)] backdrop-blur">
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              loading="lazy"
              className="h-full w-full object-cover opacity-95"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/20 to-transparent" aria-hidden />
            <div className="absolute inset-x-0 bottom-0 space-y-4 p-6 text-primary-foreground">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-primary-foreground">
                  <CheckCircle2 className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em]">Every visit includes</p>
                  <p className="text-lg font-semibold">HD completion video + technician notes</p>
                </div>
              </div>
              <ul className="grid gap-3 text-sm">
                <li className="rounded-2xl bg-white/15 p-4">
                  <p className="font-semibold">Smart weather adjustments</p>
                  <p>We reroute automatically around wind and rain so treatments stay effective.</p>
                </li>
                <li className="rounded-2xl bg-white/15 p-4">
                  <p className="font-semibold">Customer portal access</p>
                  <p>Track ETA, pay invoices, review technician notes, and reschedule in one place.</p>
                </li>
                <li className="rounded-2xl bg-white/15 p-4">
                  <p className="font-semibold">Re-service promise</p>
                  <p>If mosquitoes return between visits, we treat again at no charge.</p>
                </li>
              </ul>
              <p className="text-xs text-white/80">
                Licensed • Insured • Employee-based technicians • Serving Orange County since 2016
              </p>
            </div>
          </div>
          <div className="absolute -bottom-10 -left-6 -z-10 h-[360px] w-[360px] rounded-full bg-primary/15 blur-3xl" aria-hidden />
          <div className="absolute -top-16 right-0 -z-10 h-[320px] w-[320px] rounded-full bg-secondary/20 blur-3xl" aria-hidden />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
~~~

### client/components/sections/AddressCheckerSection.tsx
~~~tsx
import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, MapPin, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { pricingTiers, serviceAreaZipCodes } from "@/data/site";

const convertSqftToAcres = (squareFeet: number) => {
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) {
    return null;
  }
  return Math.round((squareFeet / 43560) * 100) / 100;
};

const findTierByAcreage = (acreage: number | null) => {
  if (acreage === null) {
    return null;
  }
  return pricingTiers.find((tier) => acreage >= tier.min && acreage <= tier.max) ?? null;
};

type ResultState =
  | { status: "idle" }
  | { status: "in_area"; acreage: number | null; tierLabel: string | null }
  | { status: "out_of_area" }
  | { status: "custom"; acreage: number };

const AddressCheckerSection = () => {
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const acreage = useMemo(() => {
    const parsedSqft = parseFloat(squareFeet);
    if (Number.isNaN(parsedSqft)) {
      return null;
    }
    return convertSqftToAcres(parsedSqft);
  }, [squareFeet]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedZip = zip.trim();
    const inArea = serviceAreaZipCodes.includes(normalizedZip);

    if (!normalizedZip) {
      setResult({ status: "idle" });
      return;
    }

    if (!inArea) {
      setResult({ status: "out_of_area" });
      return;
    }

    if (acreage === null) {
      setResult({ status: "in_area", acreage: null, tierLabel: null });
      return;
    }

    const tier = findTierByAcreage(acreage);
    if (!tier || tier.subscription === "custom" || acreage > 2) {
      setResult({ status: "custom", acreage });
      return;
    }

    setResult({ status: "in_area", acreage, tierLabel: tier.label });
  };

  const handleWaitlistSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!waitlistEmail || waitlistSubmitted) return;
    setWaitlistSubmitted(true);
  };

  return (
    <section id="address-checker" className="relative overflow-hidden bg-gradient-to-b from-muted/40 via-background to-background py-24">
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-60" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-primary/10 bg-card/80 p-8 shadow-soft backdrop-blur lg:p-12">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-primary">
                    Address checker
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
                    See if we’re servicing your block and estimate your acreage.
                  </h2>
                </div>
              </div>
              <p className="mt-6 max-w-2xl text-base text-muted-foreground">
                Connects to Google Places or Mapbox for autocomplete and parcel data, then estimates lot size. Don’t have the exact square footage? Enter your best estimate—our team fine-tunes it during onboarding.
              </p>
              <form className="mt-8 grid gap-6" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-[1.4fr_0.6fr]">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    Property address
                    <input
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="123 Coastal View, Newport Beach"
                      autoComplete="street-address"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                    ZIP code
                    <input
                      value={zip}
                      onChange={(event) => setZip(event.target.value)}
                      placeholder="92663"
                      autoComplete="postal-code"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                      required
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                  Lot size in square feet (optional)
                  <div className="relative">
                    <input
                      value={squareFeet}
                      onChange={(event) => setSquareFeet(event.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="4350"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      sqft
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Don’t know the square footage? We’ll estimate automatically using lot-size APIs keyed to your address.
                  </p>
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Check service & estimate pricing
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  <Link
                    to="/schedule"
                    className="inline-flex items-center gap-2 rounded-full border border-border/80 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Skip to scheduling
                  </Link>
                </div>
              </form>
              <div className="mt-8 space-y-4 rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-6 text-sm text-muted-foreground">
                <p className="flex items-start gap-2 text-foreground">
                  <Sparkles className="mt-1 h-4 w-4 text-primary" aria-hidden />
                  <span>
                    We’re integrating parcel lookups from Mapbox Tilesets + county assessor data. Until then, technicians confirm acreage during first-visit walk-through.
                  </span>
                </p>
                <p>
                  <strong className="font-semibold text-foreground">ZIPs we currently service:</strong> {serviceAreaZipCodes.join(", ")}
                </p>
              </div>
            </div>
            <div className="rounded-[28px] border border-border/70 bg-white/90 p-6 shadow-soft backdrop-blur">
              {result.status === "idle" && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-muted-foreground">
                  <MapPin className="h-12 w-12 text-primary/50" aria-hidden />
                  <p className="max-w-xs">
                    Enter your address and ZIP code to confirm service availability and get pricing tailored to your acreage.
                  </p>
                </div>
              )}

              {result.status === "in_area" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                        We service your address
                      </p>
                      <p className="text-lg font-semibold text-foreground">Let’s build a custom plan.</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-muted/60 p-5">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Estimated acreage
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">
                      {result.acreage ? `${result.acreage} acres` : "We’ll confirm on-site"}
                    </p>
                    {result.tierLabel ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        You’re in tier <span className="font-semibold text-foreground">{result.tierLabel}</span>. Choose a 21-day cadence for premium coverage or adjust in the quote widget below.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Share your square footage for instant pricing, or continue below to calculate manually.
                      </p>
                    )}
                  </div>
                  <Link
                    to="/schedule"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Reserve a route time
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              )}

              {result.status === "custom" && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-secondary/30 p-5 text-secondary-foreground">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em]">Large property</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      Acreage over 2.0 requires a custom site walk.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {`Your estimate: ${result.acreage.toFixed(2)} acres.`} Our licensed specialist will craft a treatment blueprint and pricing proposal within one business day.
                    </p>
                  </div>
                  <Link
                    to="/contact"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Book a custom inspection
                  </Link>
                </div>
              )}

              {result.status === "out_of_area" && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-muted/60 p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      Outside current routes
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      Join the waitlist. We’ll alert you when service opens.
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Expansion to southern Los Angeles County and Inland Empire is underway. Share your email for early access.
                    </p>
                  </div>
                  {waitlistSubmitted ? (
                    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                      Thanks! You’re on the list. We’ll update you within 48 hours with availability and prevention tips you can use now.
                    </div>
                  ) : (
                    <form className="grid gap-3" onSubmit={handleWaitlistSubmit}>
                      <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                        Email address
                        <input
                          value={waitlistEmail}
                          onChange={(event) => setWaitlistEmail(event.target.value)}
                          placeholder="you@example.com"
                          type="email"
                          className="w-full rounded-2xl border border-border/70 bg-white px-4 py-3 text-sm font-normal text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Join the waitlist
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AddressCheckerSection;
~~~

### client/components/sections/QuoteWidgetSection.tsx
~~~tsx
import { FormEvent, useMemo, useState } from "react";
import { calculatePricing, formatCurrency, ProgramType } from "@/lib/pricing";
import { frequencyOptions } from "@/data/site";
import { Check, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const programLabels: Record<ProgramType, string> = {
  subscription: "Subscription",
  annual: "Annual (prepay)",
  one_time: "One-time application",
};

const QuoteWidgetSection = () => {
  const [acreage, setAcreage] = useState(0.2);
  const [program, setProgram] = useState<ProgramType>("subscription");
  const [frequency, setFrequency] = useState<(typeof frequencyOptions)[number]>(21);
  const [submitted, setSubmitted] = useState(false);

  const pricing = useMemo(
    () => calculatePricing({ acreage, program, frequencyDays: frequency }),
    [acreage, program, frequency],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5 py-24">
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-40" aria-hidden />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
              Instant quote
            </span>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              Calculate pricing with acreage, cadence, and visit program.
            </h2>
            <p className="text-base text-muted-foreground">
              Adjust acreage and frequency to see the total investment. Pricing updates instantly. Ready to schedule? Use the quote summary to lock in your first visit and secure customer portal access.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                14/21/30/42-day cadences tuned for Orange County climate.
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                Frequency automatically updates monthly and annual totals.
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" aria-hidden />
                Acreage over 2.0 routes to a custom proposal with on-site measurements.
              </li>
            </ul>
          </div>
          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-primary/10 bg-card/90 p-6 shadow-soft backdrop-blur lg:p-8"
          >
            <div className="grid gap-6">
              <label className="flex flex-col gap-2 text-sm font-semibold text-foreground">
                Acreage
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0.05}
                    max={2.0}
                    step={0.01}
                    value={acreage}
                    onChange={(event) => setAcreage(Number(event.target.value))}
                    className="flex-1 accent-primary"
                    aria-label="Property acreage slider"
                  />
                  <input
                    type="number"
                    min={0.05}
                    max={5}
                    step={0.01}
                    value={Number.isNaN(acreage) ? "" : acreage}
                    onChange={(event) => setAcreage(Number(event.target.value))}
                    className="w-28 rounded-2xl border border-border/70 bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/80"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Need help measuring? Address checker above can estimate using parcel data, or we confirm during the initial site walk.
                </p>
              </label>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-foreground">Program</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(Object.keys(programLabels) as ProgramType[]).map((value) => {
                    const isActive = program === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setProgram(value)}
                        className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          isActive
                            ? "border-primary bg-primary text-primary-foreground shadow-brand"
                            : "border-border/70 bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {programLabels[value]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-semibold text-foreground">Frequency (days)</legend>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  {frequencyOptions.map((option) => {
                    const isActive = frequency === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFrequency(option)}
                        className={`rounded-2xl border px-4 py-3 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          isActive
                            ? "border-primary bg-primary/90 text-primary-foreground shadow-brand"
                            : "border-border/70 bg-white text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                        aria-pressed={isActive}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-3 rounded-3xl bg-muted/50 p-6">
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>Per visit</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.perVisit)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>Monthly equivalent</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.perMonth)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>Annual total</span>
                  <span className="text-xl font-semibold text-foreground">{formatCurrency(pricing.annualTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Visits per year: {pricing.visitsPerYear ?? "—"}
                </p>
                {pricing.message ? (
                  <p className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-primary">
                    {pricing.message}
                  </p>
                ) : null}
              </div>

              {pricing.isCustom ? (
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Book custom walkthrough
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : (
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Save quote & continue
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              )}

              {submitted && !pricing.isCustom ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                  Quote saved! We’ll pre-fill your scheduling flow with these selections and email a PDF summary shortly.
                </div>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};

export default QuoteWidgetSection;
~~~

### client/components/sections/PlanCardsSection.tsx
~~~tsx
import { Link } from "react-router-dom";
import { CheckCircle2, Waves } from "lucide-react";

const plans = [
  {
    name: "One-Time Application",
    price: "$179",
    cadence: "Knockdown + barrier",
    features: [
      "Full-property mosquito treatment",
      "Completion video & technician notes",
      "Follow-up prevention checklist",
    ],
    ctaLabel: "Book one-time",
    ctaHref: "/schedule",
    accent: "bg-secondary/30 text-secondary-foreground",
  },
  {
    name: "Subscription",
    price: "Tiered by acreage",
    cadence: "14/21/30/42-day",
    features: [
      "Dedicated route technician",
      "Re-service promise between visits",
      "Portal access with ETA tracking",
    ],
    ctaLabel: "Start subscription",
    ctaHref: "/schedule",
    accent: "bg-primary text-primary-foreground",
  },
  {
    name: "Annual (Prepay)",
    price: "Best value",
    cadence: "Full-season coverage",
    features: [
      "Priority scheduling for peak weeks",
      "Seasonal tick, ant, and spider defense",
      "Complimentary event fogging add-on",
    ],
    ctaLabel: "Go annual",
    ctaHref: "/contact",
    accent: "bg-accent text-accent-foreground",
  },
];

const PlanCardsSection = () => {
  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-6 text-left lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-primary">
              Plans & programs
            </span>
            <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              Flexible programs built around your yard, cadence, and comfort.
            </h2>
            <p className="text-base text-muted-foreground">
              Pick the program that fits your lifestyle. Every option includes mosquito knockdown, barrier treatments, and pest prevention insights in your customer portal.
            </p>
          </div>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Compare full pricing
          </Link>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="relative overflow-hidden rounded-[32px] border border-border/80 bg-card/80 p-6 shadow-soft backdrop-blur"
            >
              <div className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${plan.accent}`}>
                {plan.cadence}
              </div>
              <h3 className="mt-6 font-display text-2xl font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{plan.price}</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={plan.ctaHref}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-brand transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {plan.ctaLabel}
                <Waves className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PlanCardsSection;
~~~

### client/components/sections/BenefitsSection.tsx
~~~tsx
import SectionHeading from "@/components/common/SectionHeading";
import { benefits } from "@/data/site";
import { CheckCircle2 } from "lucide-react";

const BenefitsSection = () => {
  return (
    <section className="bg-background py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why choose us"
          title="Premium-friendly pest control built on safety, transparency, and neighborly service."
          description="Every visit is performed by employee-based technicians with high-touch communication and meticulous reporting."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="flex gap-4 rounded-[28px] border border-border/70 bg-card/90 p-6 shadow-soft"
            >
              <span className="mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{benefit.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
~~~
