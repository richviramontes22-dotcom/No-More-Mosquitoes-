import { Outlet } from "react-router-dom";
import { Link } from "react-router-dom";
import LogoBranding from "@/components/branding/LogoBranding";
import { useLogo } from "@/contexts/LogoContext";
import { siteConfig } from "@/data/site";
import { Phone } from "lucide-react";

/**
 * Stripped layout for checkout / onboarding flows.
 * No site navigation, no footer — just logo + a help line.
 * Industry standard: reduce off-ramps during critical funnel steps.
 */
const CheckoutLayout = () => {
  const { logoStyle } = useLogo();
  return (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    {/* Minimal header */}
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border/40 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="No More Mosquitoes home">
          <LogoBranding style={logoStyle} iconClassName="h-12 w-12 sm:h-12 sm:w-12 md:h-12 md:w-12" />
        </Link>
        <a
          href={siteConfig.phone.link}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Phone className="h-4 w-4" />
          <span className="hidden sm:inline">Need help?</span>
          <span>{siteConfig.phone.display}</span>
        </a>
      </div>
    </header>

    {/* Content — padded below fixed header */}
    <main className="flex-1 pt-16">
      <Outlet />
    </main>
  </div>
  );
};

export default CheckoutLayout;
