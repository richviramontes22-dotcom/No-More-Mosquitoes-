import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Menu, Phone } from "lucide-react";

import LogoBranding from "@/components/branding/LogoBranding";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLogo } from "@/contexts/LogoContext";
import { useTranslation } from "@/hooks/use-translation";
import { FlagUS, FlagMX, FlagJP, FlagCN } from "@/components/common/FlagIcon";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { siteConfig } from "@/data/site";
import { HeaderWeatherWidget } from "@/components/common/HeaderWeatherWidget";
import {
  GUEST_NAV_LINKS,
  CUSTOMER_DASHBOARD_LINKS,
  PRE_CUSTOMER_DASHBOARD_LINKS,
  UNIVERSAL_NAV_LINKS,
  ADMIN_NAV_LINKS,
  ADMIN_UNIVERSAL_LINKS,
  EMPLOYEE_NAV_LINKS,
  type NavItem,
} from "@/data/navigation";
import { useSubscriptions } from "@/hooks/dashboard/useSubscriptions";
import { useAdminAlertCounts, useAdminAlerts, acknowledgeAlert } from "@/hooks/admin/useAdminAlerts";


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

// ─── Admin Alert Bell ─────────────────────────────────────────────────────────

interface AdminAlertBellProps {
  isAdmin: boolean;
}

const AdminAlertBell = ({ isAdmin }: AdminAlertBellProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { counts, refetch: refetchCounts } = useAdminAlertCounts(isAdmin);
  const { alerts, refetch: refetchAlerts } = useAdminAlerts({ limit: 5, unresolvedOnly: true, enabled: isAdmin && dropdownOpen });

  const handleBellClick = () => {
    setDropdownOpen((prev) => !prev);
    if (!dropdownOpen) void refetchAlerts();
  };

  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await acknowledgeAlert(id);
    void refetchAlerts();
    void refetchCounts();
  };

  const total = counts?.total ?? 0;
  const hasCritical = (counts?.critical ?? 0) > 0;
  const hasWarning = (counts?.warning ?? 0) > 0;

  const badgeColor = hasCritical
    ? "bg-red-500"
    : hasWarning
    ? "bg-amber-500"
    : "bg-blue-500";

  const relativeTime = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.floor(hrs / 24)}d ago`;
    } catch {
      return "";
    }
  };

  const severityLabel: Record<string, string> = {
    info: "INFO",
    warning: "WARN",
    critical: "CRIT",
  };

  const severityBadgeClass: Record<string, string> = {
    info: "bg-blue-100 text-blue-800",
    warning: "bg-amber-100 text-amber-800",
    critical: "bg-red-100 text-red-800",
  };

  if (!isAdmin) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleBellClick}
        className="relative inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Admin alerts${total > 0 ? ` (${total} unresolved)` : ""}`}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {total > 0 && (
          <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${badgeColor}`}>
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <p className="text-sm font-semibold">Admin Alerts</p>
              <Link
                to="/admin/alerts"
                className="text-xs text-primary hover:underline"
                onClick={() => setDropdownOpen(false)}
              >
                View all
              </Link>
            </div>

            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No unresolved alerts
              </div>
            ) : (
              <div className="divide-y divide-border/40 max-h-72 overflow-auto">
                {alerts.map((alert) => (
                  <div key={alert.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0 ${severityBadgeClass[alert.severity] ?? "bg-muted text-foreground"}`}>
                        {severityLabel[alert.severity] ?? alert.severity.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">{relativeTime(alert.created_at)}</p>
                      </div>
                      {!alert.acknowledged_at && (
                        <button
                          type="button"
                          onClick={(e) => handleAcknowledge(alert.id, e)}
                          className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          ACK
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

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
  const { language, setLanguage } = useLanguage();
  const { logoStyle } = useLogo();
  const { t } = useTranslation();

  const activeUser = isHydrated ? user : null;
  const userRole = (profile as any)?.role || (activeUser as any)?.role;

  const { data: subscriptions = [] } = useSubscriptions(activeUser?.id);
  const hasActiveSubscription = subscriptions.some((s) => s.status === "active");
  // Pre-customer: any authenticated non-admin user without an active subscription.
  // Must NOT gate on is_onboarded — that flag only records form completion, not
  // payment, and would let unpaid users bypass the limited-dashboard guard.
  const isPreCustomer =
    !!activeUser &&
    userRole !== "admin" &&
    userRole !== "employee" &&
    !hasActiveSubscription;

  // App pages have their own sidebar navigation — no desktop nav needed in the header
  const isAppPage =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/employee");

  const firstName = useMemo(() => {
    if (!activeUser?.name) return activeUser?.email ?? "";
    return activeUser.name.split(" ")[0] ?? activeUser.name;
  }, [activeUser?.email, activeUser?.name]);

  // Translate a nav item — falls back to English label if key missing
  const tNav = (item: NavItem) => (item.tKey ? t(item.tKey as any) || item.label : item.label);


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

  // Navigate to the unified /login page — single auth experience for all screen sizes
  const handleAuthOpen = useCallback(
    (_source: string, defaultMode: "login" | "signup" = "login") => {
      navigate("/login", { state: { mode: defaultMode } });
    },
    [navigate],
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-hero-radial bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-full focus:bg-primary focus:px-5 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-1 md:py-1">

          {/* LEFT: Logo + tagline
               Mobile: can shrink so icon stays full-size and text wraps (LogoBranding handles this)
               Desktop: flex-shrink-0 prevents any compression from the right side */}
          <div className="min-w-0 md:flex-shrink-0">
            <Link to="/" className="flex items-center gap-3" aria-label="No More Mosquitoes">
              <LogoBranding
                style={logoStyle}
                iconClassName="h-[86px] w-[86px] sm:h-[100px] sm:w-[100px] md:h-[115px] md:w-[115px]"
                textClassName="text-xl sm:text-2xl"
                taglineClassName="text-[11px] sm:text-xs"
              />
            </Link>
          </div>

          {/* RIGHT: desktop actions + always-visible language + mobile-only phone/hamburger */}
          <div className="flex flex-shrink-0 items-center gap-2">

            {/* Admin alert bell — only on app pages for admin users */}
            {isAppPage && userRole === "admin" && (
              <div className="hidden md:block">
                <AdminAlertBell isAdmin={userRole === "admin"} />
              </div>
            )}

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

            {/* Weather widget: always visible on desktop regardless of page */}
            <HeaderWeatherWidget />

            {/* Desktop: login / sign-out (public pages only — app pages use avatar above) */}
            {!isAppPage && (
              <div className="hidden md:flex items-center gap-2">
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

            {/* Language selector (desktop only — replaced by weather on mobile) */}
            <div className="hidden md:block">
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
            </div>

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
                  {!location.pathname.startsWith("/admin") && (
                    <a
                      href={siteConfig.phone.link}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 px-4 py-3 text-base font-semibold text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Phone className="h-4 w-4" aria-hidden />
                      </span>
                      <span>{t("footer.callOrText") || "Call or Text"} {siteConfig.phone.display}</span>
                    </a>
                  )}

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
                    {!activeUser ? (
                      /* ── GUEST: public marketing links ── */
                      GUEST_NAV_LINKS.map((link) => (
                        <NavLink
                          key={link.key}
                          to={link.path}
                          end={link.end}
                          className={({ isActive }) =>
                            `flex items-center justify-between rounded-xl px-3 py-2 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`
                          }
                          onClick={() => setMobileOpen(false)}
                        >
                          {tNav(link)}
                        </NavLink>
                      ))
                    ) : userRole === "admin" ? (
                      /* ── ADMIN: dashboard CTA + admin links + admin universal links ── */
                      <>
                        <NavLink
                          to="/admin"
                          end={false}
                          className={({ isActive }) =>
                            `flex items-center justify-between rounded-xl px-4 py-3 text-base font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
                            }`
                          }
                          onClick={() => setMobileOpen(false)}
                        >
                          Admin Dashboard
                        </NavLink>
                        {ADMIN_NAV_LINKS.map((link) => (
                          <NavLink
                            key={link.key}
                            to={link.path}
                            end={link.end}
                            className={({ isActive }) =>
                              `flex items-center justify-between rounded-xl px-3 py-2 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              }`
                            }
                            onClick={() => setMobileOpen(false)}
                          >
                            {link.label}
                          </NavLink>
                        ))}
                        <div className="my-2 border-t border-border/40" />
                        {ADMIN_UNIVERSAL_LINKS.map((link) => (
                          <NavLink
                            key={link.key}
                            to={link.path}
                            end={link.end}
                            className={({ isActive }) =>
                              `flex items-center justify-between rounded-xl px-3 py-2 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              }`
                            }
                            onClick={() => setMobileOpen(false)}
                          >
                            {tNav(link)}
                          </NavLink>
                        ))}
                      </>
                    ) : userRole === "employee" ? (
                      /* ── EMPLOYEE: portal CTA + employee nav links ── */
                      <>
                        <NavLink
                          to="/employee"
                          end={false}
                          className={({ isActive }) =>
                            `flex items-center justify-between rounded-xl px-4 py-3 text-base font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
                            }`
                          }
                          onClick={() => setMobileOpen(false)}
                        >
                          Employee Portal
                        </NavLink>
                        <div className="mt-1 grid gap-0.5 pl-1">
                          {EMPLOYEE_NAV_LINKS.map((link) => (
                            <NavLink
                              key={link.key}
                              to={link.path}
                              end={link.end}
                              className={({ isActive }) =>
                                `flex items-center rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                }`
                              }
                              onClick={() => setMobileOpen(false)}
                            >
                              {link.label}
                            </NavLink>
                          ))}
                        </div>
                      </>
                    ) : (
                      /* ── CUSTOMER (+ support): dashboard CTA + dashboard links + universal links ── */
                      <>
                        <NavLink
                          to={isPreCustomer ? "/onboarding" : "/dashboard"}
                          end={false}
                          className={({ isActive }) =>
                            `flex items-center justify-between rounded-xl px-4 py-3 text-base font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                              isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
                            }`
                          }
                          onClick={() => setMobileOpen(false)}
                        >
                          {isPreCustomer ? "Complete Setup →" : (t("nav.customerDashboard" as any) || "Customer Dashboard")}
                        </NavLink>
                        <div className="mt-1 grid gap-0.5 pl-1">
                          {(isPreCustomer ? PRE_CUSTOMER_DASHBOARD_LINKS : CUSTOMER_DASHBOARD_LINKS).map((link) => (
                            <NavLink
                              key={link.key}
                              to={link.path}
                              end={link.end}
                              className={({ isActive }) =>
                                `flex items-center rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                }`
                              }
                              onClick={() => setMobileOpen(false)}
                            >
                              {tNav(link)}
                            </NavLink>
                          ))}
                        </div>
                        <div className="my-2 border-t border-border/40" />
                        {UNIVERSAL_NAV_LINKS.map((link) => (
                          <NavLink
                            key={link.key}
                            to={link.path}
                            end={link.end}
                            className={({ isActive }) =>
                              `flex items-center justify-between rounded-xl px-3 py-2 text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              }`
                            }
                            onClick={() => setMobileOpen(false)}
                          >
                            {tNav(link)}
                          </NavLink>
                        ))}
                      </>
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
