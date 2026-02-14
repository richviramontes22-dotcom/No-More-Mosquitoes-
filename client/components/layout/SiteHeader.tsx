import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, Phone } from "lucide-react";

import LogoCutout from "@/components/branding/LogoCutout";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useTranslation } from "@/hooks/use-translation";
import { FlagUS, FlagMX, FlagJP, FlagCN } from "@/components/common/FlagIcon";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuthDialog } from "@/components/auth/AuthDialogProvider";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

const CONTACT_PHONE_DISPLAY = "(949) 297-6225";
const CONTACT_PHONE_LINK = "tel:+19492976225";

export const SiteHeader = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [fontScheme, setFontScheme] = useState<string>("6");
  const { open: openAuthDialog } = useAuthDialog();
  const { open: openScheduleDialog } = useScheduleDialog();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  const firstName = useMemo(() => {
    if (!user?.name) return user?.email ?? "";
    return user.name.split(" ")[0] ?? user.name;
  }, [user?.email, user?.name]);

  const navLinks = useMemo(() => {
    if (!user) return NAV_LINKS.filter((l) => l.path !== "/login");
    return NAV_LINKS.map((link) => (link.path === "/login" ? { label: "Dashboard", path: "/dashboard" } : link));
  }, [user]);

  const primaryPaths = new Set(["/pricing", "/services", "/reviews", "/contact", "/schedule"]);
  const primaryLinks = useMemo(() => navLinks.filter((l) => primaryPaths.has(l.path) || l.path === "/"), [navLinks]);
  const moreLinks = useMemo(() => navLinks.filter((l) => !primaryPaths.has(l.path) && l.path !== "/"), [navLinks]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const setVarsForScheme = (scheme: string) => {
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

  useEffect(() => {
    try {
      const saved = (typeof window !== "undefined" && localStorage.getItem("fontScheme")) || "6";
      setFontScheme(saved);
      setVarsForScheme(saved);
      const root = document.documentElement;
      const body = document.body;
      for (let i = 1; i <= 10; i++) {
        root.classList.remove(`font-scheme-${i}`);
        body.classList.remove(`font-scheme-${i}`);
      }
      root.classList.add(`font-scheme-${saved}`);
      body.classList.add(`font-scheme-${saved}`);
    } catch {}
  }, []);

  const applyFontScheme = (value: string) => {
    setFontScheme(value);
    try {
      localStorage.setItem("fontScheme", value);
    } catch {}
    setVarsForScheme(value);
    const root = document.documentElement;
    const body = document.body;
    for (let i = 1; i <= 10; i++) {
      root.classList.remove(`font-scheme-${i}`);
      body.classList.remove(`font-scheme-${i}`);
    }
    root.classList.add(`font-scheme-${value}`);
    body.classList.add(`font-scheme-${value}`);
  };

  const handleSignOut = () => {
    logout();
    toast({ title: "Signed out", description: "You’ve been signed out of your account." });
    navigate("/login", { replace: true });
  };

  const handleScheduleOpen = useCallback(
    (source: string) => {
      openScheduleDialog({ source });
    },
    [openScheduleDialog],
  );

  const handleAuthOpen = useCallback(
    (source: string, defaultMode: "login" | "signup" = "login") => {
      openAuthDialog({ source, defaultMode, redirectTo: "/dashboard" });
    },
    [openAuthDialog],
  );

  return (
    <header className="relative z-40 border-b border-border/60 bg-hero-radial bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-3">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex min-w-0 flex-1 items-center gap-6">
            <Link to="/" className="flex items-center gap-3" aria-label="No More Mosquitoes">
              <LogoCutout size={72} className="shrink-0" alt="No More Mosquitoes logo icon" />
              <div className="hidden">
                <p className="font-display text-lg font-semibold text-foreground">No More Mosquitoes</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Orange County, CA</p>
              </div>
            </Link>
            <nav aria-label="Primary" className="hidden">
              {primaryLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                  end={link.path === "/"}
                >
                  {link.label}
                </NavLink>
              ))}
              {moreLinks.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="rounded-full px-3 py-2 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                    More <ChevronDown className="ml-1 inline h-4 w-4 align-middle" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[12rem]">
                    {moreLinks.map((link) => (
                      <DropdownMenuItem key={link.path} asChild>
                        <Link to={link.path}>{link.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </nav>
          </div>

          {/* Right: Actions (Desktop) */}
          <div className="hidden">
            <a
              href={CONTACT_PHONE_LINK}
              className="group inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <Phone className="h-4 w-4" aria-hidden />
              </span>
              Call or Text {CONTACT_PHONE_DISPLAY}
            </a>
            {!user ? (
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
            <button
              type="button"
              onClick={() => handleScheduleOpen("site-header-primary")}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand transition hover:translate-y-px hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Schedule Service
            </button>
          </div>

          {/* Mobile: Phone + Language + Hamburger (Sheet) */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                {language === "en" && <FlagUS />}
                {language === "es" && <FlagMX />}
                {language === "jp" && <FlagJP />}
                {language === "cn" && <FlagCN />}
                <span className="sr-only">Select language</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => setLanguage("en")} className={language === "en" ? "bg-primary/10" : ""}>
                  <span className="mr-2"><FlagUS /></span>
                  <span>English (ENG)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage("es")} className={language === "es" ? "bg-primary/10" : ""}>
                  <span className="mr-2"><FlagMX /></span>
                  <span>Spanish (ESP)</span>
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
            <a
              href={CONTACT_PHONE_LINK}
              className="inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Phone className="h-5 w-5" aria-hidden />
              <span className="sr-only">Call or text {CONTACT_PHONE_DISPLAY}</span>
            </a>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-border/60 p-2 text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-expanded={mobileOpen}
                >
                  <span className="sr-only">Open menu</span>
                  <Menu className="h-5 w-5" aria-hidden />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-sm">
                <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <LogoCutout size={64} alt="No More Mosquitoes logo icon" />
                  <span>No More Mosquitoes</span>
                </SheetTitle>
                <a
                  href={CONTACT_PHONE_LINK}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 px-4 py-3 text-base font-semibold text-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Phone className="h-4 w-4" aria-hidden />
                  </span>
                  <span>Call or Text {CONTACT_PHONE_DISPLAY}</span>
                </a>
              </SheetHeader>
                <div className="mt-6 grid gap-2">
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-2">
                    <button
                      onClick={() => setLanguage("en")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition ${
                        language === "en"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <FlagUS />
                      <span>ENG</span>
                    </button>
                    <button
                      onClick={() => setLanguage("es")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition ${
                        language === "es"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <FlagMX />
                      <span>ESP</span>
                    </button>
                    <button
                      onClick={() => setLanguage("jp")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition ${
                        language === "jp"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <FlagJP />
                      <span>JPN</span>
                    </button>
                    <button
                      onClick={() => setLanguage("cn")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-bold transition ${
                        language === "cn"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <FlagCN />
                      <span>CHN</span>
                    </button>
                  </div>
                  <nav aria-label="Mobile primary" className="grid gap-1">
                    {navLinks.map((link) => (
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
                        onClick={() => setMobileOpen(false)}
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </nav>
                  <div className="mt-4 grid gap-3">
                    {!user ? (
                      <Button
                        variant="outline"
                        className="w-full rounded-xl border-border/60"
                        onClick={() => {
                          setMobileOpen(false);
                          handleAuthOpen("site-header-mobile", "login");
                        }}
                      >
                        Log in / Sign up
                      </Button>
                    ) : (
                      <div className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                        <p className="font-semibold text-foreground">Signed in as {firstName}</p>
                        <Button variant="ghost" size="sm" className="mt-2 px-3" onClick={handleSignOut}>
                          Sign out
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
                      Schedule Service
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
