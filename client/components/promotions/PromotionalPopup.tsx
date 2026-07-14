import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

interface PopupData {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  secondary_label: string | null;
  secondary_url: string | null;
  audience: string;
  frequency: string;
}

// LocalStorage key helpers for dismissal
function dismissKey(id: string): string {
  return `promo_popup_dismissed_${id}`;
}
function isDismissed(popup: PopupData): boolean {
  if (popup.frequency === "always") return false;
  const stored = localStorage.getItem(dismissKey(popup.id));
  if (!stored) return false;
  if (popup.frequency === "once_per_session") {
    return stored === "session";
  }
  if (popup.frequency === "once_per_day") {
    return stored === new Date().toISOString().slice(0, 10);
  }
  return false;
}
function markDismissed(popup: PopupData): void {
  if (popup.frequency === "once_per_session") {
    sessionStorage.setItem(dismissKey(popup.id), "dismissed");
    localStorage.setItem(dismissKey(popup.id), "session");
  } else if (popup.frequency === "once_per_day") {
    localStorage.setItem(dismissKey(popup.id), new Date().toISOString().slice(0, 10));
  }
}

// Sensitive paths where popups should never auto-appear
const BLOCKED_PATHS = ["/onboarding", "/legal-acceptance", "/legal", "/reset-password"];

export const PromotionalPopup = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [visible, setVisible] = useState(false);

  const isBlocked = BLOCKED_PATHS.some(p => pathname.startsWith(p));
  const isCheckout = pathname.includes("/dashboard/billing") || pathname.includes("/dashboard/marketplace");

  useEffect(() => {
    if (isBlocked || isCheckout) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/promotional-popups/active?path=${encodeURIComponent(pathname)}`);
        if (!res.ok || cancelled) return;
        const { popup: p } = await res.json();
        if (!p || cancelled) return;

        // Audience check
        const role = (profile as any)?.role ?? null;
        const isLoggedIn = !!user;
        const isCustomer = isLoggedIn && role === "customer";
        if (p.audience === "public" && isLoggedIn) return;
        if (p.audience === "logged_in" && !isLoggedIn) return;
        if (p.audience === "customers" && !isCustomer) return;

        if (isDismissed(p)) return;

        setPopup(p);
        // Small delay so page loads before popup appears
        setTimeout(() => { if (!cancelled) setVisible(true); }, 800);
      } catch {
        // Silently fail — popup is non-critical
      }
    };

    load();
    return () => { cancelled = true; };
  }, [pathname, user, profile, isBlocked, isCheckout]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (popup) markDismissed(popup);
    setTimeout(() => setPopup(null), 300);
  }, [popup]);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible, dismiss]);

  const handleCta = (url: string | null) => {
    if (!url) return;
    dismiss();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      navigate(url);
    }
  };

  if (!popup || !visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={dismiss}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-popup-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="relative w-full max-w-md bg-background rounded-[24px] shadow-2xl border border-border/60 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
          {/* Dismiss button */}
          <button
            onClick={dismiss}
            aria-label="Dismiss promotion"
            className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Image */}
          {popup.image_url && (
            <img
              src={popup.image_url}
              alt=""
              aria-hidden="true"
              className="w-full h-44 object-cover"
            />
          )}

          {/* Content */}
          <div className="p-6 space-y-3">
            <div>
              <h2 id="promo-popup-title" className="text-xl font-bold font-display leading-tight">
                {popup.title}
              </h2>
              {popup.subtitle && (
                <p className="text-sm font-semibold text-primary mt-1">{popup.subtitle}</p>
              )}
            </div>

            {popup.body && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {popup.body}
              </p>
            )}

            {/* CTAs */}
            {(popup.cta_label || popup.secondary_label) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {popup.cta_label && (
                  <Button
                    onClick={() => handleCta(popup.cta_url)}
                    className="rounded-full flex-1 sm:flex-none"
                  >
                    {popup.cta_label}
                  </Button>
                )}
                {popup.secondary_label && (
                  <Button
                    variant="outline"
                    onClick={() => handleCta(popup.secondary_url)}
                    className="rounded-full flex-1 sm:flex-none"
                  >
                    {popup.secondary_label}
                  </Button>
                )}
              </div>
            )}

            {/* Dismiss text link */}
            <p className="text-center">
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                No thanks, dismiss
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PromotionalPopup;
