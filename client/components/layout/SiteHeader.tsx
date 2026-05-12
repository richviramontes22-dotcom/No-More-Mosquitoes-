import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, Phone } from "lucide-react";

import LogoBranding from "@/components/branding/LogoBranding";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLogo } from "@/contexts/LogoContext";
import { useTranslation } from "@/hooks/use-translation";
import { FlagUS, FlagMX, FlagJP, FlagCN } from "@/components/common/FlagIcon";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthDialog } from "@/components/auth/AuthDialogProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { siteConfig } from "@/data/site";

const NAV_LINKS = [
  { label: "Home", path: "/", key: "home" },
  { label: "Pricing", path: "/pricing", key: "pricing" },
  { label: "Services", path: "/services", key: "services" },
  { label: "Our Story", path: "/our-story", key: "ourStory" },
  { label: "Reviews", path: "/reviews", key: "reviews" },
  { label: "FAQ", path: "/faq", key: "faq" },
  { label: "Blog", path: "/blog", key: "blog" },
  { label: "Schedule", path: "/schedule", key: "schedule" },
  { label: "Customer Login", path: "/login", key: "customerLogin" },
  { label: "Contact", path: "/contact", key: "contact" },
];

const ADMIN_NAV_LINKS = [
  { label: "Overview", path: "/admin", key: "adminOverview" },
  { label: "Customers", path: "/admin/customers", key: "adminCustomers" },
  { label: "Properties", path: "/admin/properties", key: "adminProperties" },
  { label: "Appointments", path: "/admin/appointments", key: "adminAppointments" },
  { label: "Visits", path: "/admin/visits", key: "adminVisits" },
  { label: "Messages", path: "/admin/messages", key: "adminMessages" },
  { label: "Tickets", path: "/admin/tickets", key: "adminTickets" },
  { label: "Employees", path: "/admin/employees", key: "adminEmployees" },
  { label: "Route Planning", path: "/admin/route-planning", key: "adminRoutePlanning" },
  { label: "Employee Tracking", path: "/admin/employee-tracking", key: "adminEmployeeTracking" },
  { label: "Billing", path: "/admin/billing", key: "adminBilling" },
  { label: "Revenue", path: "/admin/revenue", key: "adminRevenue" },
  { label: "Content", path: "/admin/content", key: "adminContent" },
  { label: "Pricing & Plans", path: "/admin/pricing", key: "adminPricing" },
  { label: "Service Areas", path: "/admin/service-areas", key: "adminServiceAreas" },
  { label: "Reports", path: "/admin/reports", key: "adminReports" },
  { label: "Settings", path: "/admin/settings", key: "adminSettings" },
];


const setVarsForScheme = (scheme: string) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  const map: Record<string, { sans: string; display: string }> = {
    "1": { sans: '"Manrope", "Inter", system-ui, sans-serif', display: '"Playfair Display", serif' },
    "2": { sans: '"Inter", "Manrope", system-ui, sans-serif', display: '"Playfair Display", serif' },
    "3": { sans: '"Manrope", "Inter", system-ui, sans-serif', display: '"Inter", "Manrope", system-ui, sans-serif' },
    "4": { sans: '"Inter", "Manrope", system-ui, sans-serif', display: '"Inter", "Manrope", system-ui, sans-serif' },
    "5": { sans: 'system-ui, "Manrope", "Inter", sans-serif', display: '"Playfair Display", serif' },
    "6": { sans: 'system-ui, "Inter", "Manrope", sans-serif', display: '"Inter", "Manrope", system-ui, sans-serif' },
    "7": { sans: '"Manrope", "Inter", system-ui, sans-serif', display: 'serif' },
    "8": { sans: '"Inter", "Manrope", system-ui, sans-serif', display: 'serif' },
    "9": { sans: 'serif', display: '"Playfair Display", serif' },
    "10": { sans: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', display: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
  };
  const chosen = map[scheme] ?? map["1"];
  root.style.setProperty("--font-sans", chosen.sans);
  root.style.setProperty("--font-display", chosen.display);
  body.style.setProperty("--font-sans", chosen.sans);
  body.style.setProperty("--font-display", chosen.display);
};

export const SiteHeader = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout, isHydrated } = useAuth();
  const { data: profile } = useProfile();
  const fontScheme = (() => {
    try {
      return (typeof window !== "undefined" && localStorage.getItem("fontScheme")) || "6";
    } catch {
      return "6";
    }
  })();
  const { open: openAuthDialog } = useAuthDialog();
  const { language, setLanguage } = useLanguage();
  const { logoStyle } = useLogo();
  const { t } = useTranslation();

  const activeUser = isHydrated ? user : null;
  const userRole = (profile as any)?.role || (activeUser as any)?.role;

  // App pages have their own sidebar navigation — no desktop nav needed in the header
  const isAppPage =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/employee");

  const firstName = useMemo(() => {
    if (!activeUser?.name) return activeUser?.email ?? "";
    return activeUser.name.split(" ")[0] ?? activeUser.name;
  }, [activeUser?.email, activeUser?.name]);

  const navLinks = useMemo(() => {
    const translatedLinks = NAV_LINKS.map(link => ({
      ...link,
      label: t(`nav.${link.key}`) || link.label
    }));

    return translatedLinks.map((link) => {
      if (link.path === "/login") {
        if (activeUser) {
          if (userRole === "admin") {
            return { ...link, label: t("nav.adminPortal") || "Admin Panel", path: "/admin" };
          }
          return { ...link, label: t("nav.dashboard") || "Dashboard", path: "/dashboard" };
        }
        return null;
      }
      if (link.path === "/admin/login") {
        if (activeUser) {
          return null; // Hide admin/login link if already logged in
        }
        return link;
      }
      if (link.path === "/schedule") {
        return { ...link, path: activeUser ? "/dashboard/appointments" : "/login" };
      }
      return link;
    }).filter((l) => l !== null) as typeof translatedLinks;
  }, [activeUser, userRole, t]);


  useEffect(() => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    try {
      setVarsForScheme(fontScheme);
      const root = document.documentElement;
      const body = document.body;
      for (let i = 1; i <= 10; i++) {
        root.classList.remove(`font-scheme-${i}`);
        body.classList.remove(`font-scheme-${i}`);
      }
      root.classList.add(`font-scheme-${fontScheme}`);
      body.classList.add(`font-scheme-${fontScheme}`);
    } catch {}
  }, [fontScheme]);

  const handleSignOut = useCallback(() => {
    logout();
    toast({ title: "Signed out", description: "You’ve been signed out of your account." });
    navigate("/login", { replace: true });
  }, [logout, navigate, toast]);

  const handleScheduleOpen = useCallback(
    (source: string) => {
      const target = activeUser ? "/dashboard/appointments" : "/schedule";
      if (location.pathname === target) {
        if (target === "/schedule") {
          const element = document.getElementById("schedule-form");
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
        return;
      }

      if (!activeUser) {
        navigate("/schedule", { state: { from: "/schedule", source } });
      } else {
        navigate("/dashboard/appointments");
      }
    },
    [activeUser, navigate, location.pathname],
  );

  const handleAuthOpen = useCallback(
    (source: string, defaultMode: "login" | "signup" = "login") => {
      openAuthDialog({ source, defaultMode, redirectTo: "/dashboard" });
    },
    [openAuthDialog],
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-hero-radial bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {location.pathname !== "/" && (
        <div className="bg-primary/5 py-1.5 border-b border-primary/10">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary/80">
              {t("header.securityNotice")}
            </p>
          </div>
        </div>
      )}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-primary focus:px-5 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-3 md:py-4">

          {/* LEFT: Logo + tagline
               Mobile: can shrink so icon stays full-size and text wraps (LogoBranding handles this)
               Desktop: flex-shrink-0 prevents any compression from the right side */}
          <div className="min-w-0 md:flex-shrink-0">
            <Link to="/" className="flex items-center gap-3" aria-label="No More Mosquitoes">
              <LogoBranding
                style={logoStyle}
                iconClassName="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16"
                textClassName="text-lg sm:text-xl"
                taglineClassName="text-[10px] sm:text-[11px] md:text-xs"
              />
            </Link>
          </div>

          {/* RIGHT: desktop actions + always-visible language + mobile-only phone/hamburger */}
          <div className="flex flex-shrink-0 items-center gap-2">

            {/* Desktop: app page avatar */}
            {isAppPage && activeUser && (
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full h-9 w-9 bg-primary text-primary-foreground text-sm font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-primary/90 transition-colors">
                    {firstName ? firstName[0] : (activeUser.email?.[0] ?? "U")}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[200px] rounded-2xl p-2">
                    <div className="px-2 py-2 mb-1 border-b border-border/40">
                      <p className="text-sm font-semibold text-foreground truncate">{activeUser.name || firstName}</p>
                      <p className="text-xs text-muted-foreground truncate">{activeUser.email}</p>
                    </div>
                    <DropdownMenuItem asChild>
                      <Link to={userRole === "admin" ? "/admin/settings" : "/dashboard/profile"} className="rounded-xl cursor-pointer">
                        Profile & Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="rounded-xl text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer mt-1"
                    >
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Desktop: login / sign-out (public pages only) */}
            {!isAppPage && (
              <div className="hidden md:flex items-center">
                {!activeUser ? (
                  <Button
                    variant="outline"
                    className="rounded-full border-border/60"
                    onClick={() => handleAuthOpen("site-header-primary", "login")}
                  >
                    Log in / Sign up
                  </Button>
                ) : (
                  <Button variant="outline" className="rounded-full border-border/60" onClick={handleSignOut}>
                    Sign out
                  </Button>
                )}
              </div>
            )}

            {/* Language selector (always visible) */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                {language === "en" && <FlagUS />}
                {language === "es" && <FlagMX />}
                {language === "jp" && <FlagJP />}
                {language === "cn" && <FlagCN />}
                <span className="sr-only">{t("header.selectLanguage") || "Select language"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => setLanguage("en")} className={language === "en" ? "bg-primary/10" : ""}>
                  <span className="mr-2"><FlagUS /></span>
                  <span>English (ENG)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage("es")} className={language === "es" ? "bg-primary/10" : ""}>
                  <span className="mr-2"><FlagMX /></span>
                  <span>Spanish (MEX)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage("jp")} className={language === "jp" ? "bg-primary/10" : ""}>
                  <span className="mr-2"><FlagJP /></span>
                  <span>Japanese (JPN)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage("cn")} className={language === "cn" ? "bg-primary/10" : ""}>
                  <span className="mr-2"><FlagCN /></span>
                  <span>Chinese (CHN)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Phone icon: mobile only */}
            <a
              href={siteConfig.phone.link}
              className="md:hidden inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Phone className="h-5 w-5" aria-hidden />
              <span className="sr-only">Call or text {siteConfig.phone.display}</span>
            </a>

            {/* Hamburger: desktop + mobile */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-expanded={mobileOpen}
                >
                  <span className="sr-only">{t("header.openMenu") || "Open menu"}</span>
                  <Menu className="h-5 w-5" aria-hidden />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full px-6 pt-6 pb-6 sm:max-w-sm overflow-y-auto">
                <div className="flex justify-start pb-6">
                  <LogoBranding
                    style={logoStyle}
                    iconClassName={logoStyle === "circular" ? "h-32 w-32" : "h-16 w-16"}
                    textClassName={logoStyle === "circular" ? "" : "text-xl"}
                    taglineClassName={logoStyle === "circular" ? "" : "text-xs"}
                  />
                </div>
                <SheetHeader className="sr-only">
                  <SheetTitle>{t("nav.brandName") || "No More Mosquitoes"}</SheetTitle>
                </SheetHeader>
                <div className="grid gap-2">
                  <a
                    href={siteConfig.phone.link}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 px-4 py-3 text-base font-semibold text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Phone className="h-4 w-4" aria-hidden />
                    </span>
                    <span>{t("footer.callOrText") || "Call or Text"} {siteConfig.phone.display}</span>
                  </a>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex w-full items-center justify-between rounded-xl border-border/60 px-4 py-6 text-base font-semibold">
                        <div className="flex items-center gap-3">
                          {language === "en" && <FlagUS />}
                          {language === "es" && <FlagMX />}
                          {language === "jp" && <FlagJP />}
                          {language === "cn" && <FlagCN />}
                          <span className="text-muted-foreground">{t("header.selectLanguage") || "Select language"}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-[calc(100vw-32px)] sm:w-[340px] rounded-xl">
                      <DropdownMenuItem onClick={() => setLanguage("en")} className={language === "en" ? "bg-primary/10" : ""}>
                        <span className="mr-3"><FlagUS /></span>
                        <span className="font-semibold">English (ENG)</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLanguage("es")} className={language === "es" ? "bg-primary/10" : ""}>
                        <span className="mr-3"><FlagMX /></span>
                        <span className="font-semibold">Spanish (MEX)</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLanguage("jp")} className={language === "jp" ? "bg-primary/10" : ""}>
                        <span className="mr-3"><FlagJP /></span>
                        <span className="font-semibold">Japanese (JPN)</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLanguage("cn")} className={language === "cn" ? "bg-primary/10" : ""}>
                        <span className="mr-3"><FlagCN /></span>
                        <span className="font-semibold">Chinese (CHN)</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <nav aria-label="Mobile primary" className="mt-2 grid gap-1">
                    {/* Role-specific navigation rendering */}
                    {activeUser && userRole === "admin" ? (
                      // Admin users: show ONLY admin navigation
                      ADMIN_NAV_LINKS.map((link) => (
                        <NavLink
                          key={link.key}
                          to={link.path}
                          className={({ isActive }) =>
                            `flex items-center justify-between rounded-xl px-3 py-2 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`
                          }
                          end={link.path === "/admin"}
                          onClick={() => setMobileOpen(false)}
                        >
                          {link.label}
                        </NavLink>
                      ))
                    ) : (
                      // Public and customer users: show public/customer navigation
                      navLinks.map((link) => (
                        <NavLink
                          key={link.key}
                          to={link.path}
                          className={({ isActive }) =>
                            `flex items-center justify-between rounded-xl px-3 py-2 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`
                          }
                          end={link.path === "/"}
                          onClick={() => setMobileOpen(false)}
                        >
                          {link.label}
                        </NavLink>
                      ))
                    )}
                  </nav>
                  <div className="mt-4 grid gap-3">
                    {!activeUser ? (
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-border/60"
                        onClick={() => {
                          setMobileOpen(false);
                          handleAuthOpen("site-header-mobile", "login");
                        }}
                      >
                        {t("nav.login") || "Log in / Sign up"}
                      </Button>
                    ) : (
                      <div className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground">
                          {t("nav.signedInAs", { name: firstName }) || `Signed in as ${firstName}`}
                        </p>
                        <Button variant="ghost" size="sm" className="mt-2 px-3" onClick={handleSignOut}>
                          {t("nav.signOut") || "Sign out"}
                        </Button>
                      </div>
                    )}
                    <Button
                      className="w-full rounded-xl"
                      onClick={() => {
                        setMobileOpen(false);
                        handleScheduleOpen("site-header-mobile");
                      }}
                    >
                      {t("hero.scheduleService") || "Schedule Service"}
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default SiteHeader;
