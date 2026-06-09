import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, RotateCcw, Sparkles, Shield, Clock, MapPin, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Seo from "@/components/seo/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscriptions } from "@/hooks/dashboard/useSubscriptions";
import { ScheduleFlow } from "@/components/schedule/ScheduleFlow";
import {
  loadPendingOnboarding,
  clearPendingOnboarding,
} from "@/lib/pendingOnboarding";
import { loadFlowProgress, STEP_LABELS, type FlowProgressState } from "@/lib/flowProgress";
import { supabase } from "@/lib/supabase";

/**
 * Onboarding — full-page first-time setup for new customers.
 *
 * Architecture: ScheduleFlow is rendered directly in the page shell (no modal).
 * This is a presentation-layer migration: ScheduleFlow internals, Stripe flow,
 * and backend contracts are fully preserved.
 *
 * Two paths:
 *   Path A: Quote widget → signup → login → here (pending data pre-fills cadence/program)
 *   Path B: Direct signup → login → here (blank ScheduleFlow)
 *
 * Annual plan detection: if pending.program === "annual", redirect to /contact.
 * Existing customers (is_onboarded || activeSubscription) are redirected to /dashboard.
 */

type OnboardingView = "intro" | "flow";

const Onboarding = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useSubscriptions(user?.id);
  const [view, setView] = useState<OnboardingView>("intro");

  const activeSubscription = (subscriptions as any[]).find(
    (s) => s.status === "active",
  );

  // Load pending onboarding once — used to pass cadence/program to ScheduleFlow
  const pending = loadPendingOnboarding();

  // Load saved flow progress — start from localStorage, then check Supabase
  // for a newer cross-device save (resolved asynchronously below).
  const [savedProgress, setSavedProgress] = useState<FlowProgressState | null>(
    () => (user?.id ? loadFlowProgress(user.id) : null),
  );
  const savedStepLabel = savedProgress ? STEP_LABELS[savedProgress.step] : null;
  const initialCadenceDays = pending?.cadenceDays;
  const initialProgram =
    pending?.program === "annual" || pending?.program === undefined
      ? undefined
      : (pending.program as "subscription" | "one_time");

  // Derived display strings for pending context banner
  const pendingAddress = pending?.address
    ? [pending.address, pending.city, pending.state].filter(Boolean).join(", ")
    : null;
  const pendingCadenceLabel = pending?.cadenceDays
    ? `Every ${pending.cadenceDays} days`
    : null;
  const pendingProgramLabel =
    pending?.program === "subscription" ? "Subscription"
    : pending?.program === "one_time"   ? "One-time visit"
    : pending?.program === "annual"     ? "Annual plan"
    : null;

  // Redirect away from onboarding only if user has a confirmed active subscription.
  // Do NOT redirect on is_onboarded alone — skip users (is_onboarded=true, no subscription)
  // need to re-enter here to complete payment.
  useEffect(() => {
    if (profileLoading || subscriptionsLoading) return;
    if (activeSubscription) {
      navigate("/dashboard", { replace: true });
    }
  }, [profileLoading, subscriptionsLoading, activeSubscription, navigate]);

  // Check Supabase for cross-device flow progress. If the cloud version is newer
  // than what's in localStorage, promote it so the resume banner and ScheduleFlow
  // both see the most up-to-date state.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("onboarding_progress")
          .eq("id", user.id)
          .limit(1);
        const cloud = (data?.[0] as any)?.onboarding_progress as FlowProgressState | null | undefined;
        if (!cloud?.step || !cloud?.userId || cloud.userId !== user.id) return;
        const localTs = savedProgress?.savedAt ? new Date(savedProgress.savedAt).getTime() : 0;
        const cloudTs = cloud.savedAt ? new Date(cloud.savedAt).getTime() : 0;
        if (cloudTs > localTs) setSavedProgress(cloud);
      } catch {
        // localStorage remains the fallback on any error
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleBeginSetup = () => {
    // Annual plans need a custom quote — never enter ScheduleFlow
    if (pending?.program === "annual") {
      clearPendingOnboarding();
      navigate("/contact");
      return;
    }
    setView("flow");
  };

  const handleSkip = async () => {
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ is_onboarded: true })
        .eq("id", user.id);
      // Invalidate the cached profile so RequireCustomer sees is_onboarded=true
      // immediately and doesn't redirect back to /onboarding.
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    }
    navigate("/dashboard", { replace: true });
  };

  const handleFlowCancel = () => {
    setView("intro");
  };

  if (profileLoading || subscriptionsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Getting things ready…
        </span>
      </div>
    );
  }

  // ── Flow view: ScheduleFlow embedded directly in page ─────────────────────────
  if (view === "flow") {
    return (
      <div className="w-full bg-background">
        <Seo
          title="Schedule Your First Visit — No More Mosquitoes"
          description="Pick your preferred timing and set up your mosquito protection service."
          canonicalUrl="https://nomoremosquitoes.us/onboarding"
        />
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
          <ScheduleFlow
            fullPage
            initialCadenceDays={initialCadenceDays}
            initialProgram={initialProgram}
            savedProgress={savedProgress}
            onCancel={handleFlowCancel}
            onSuccess={() => {}}
          />
        </div>
      </div>
    );
  }

  // ── Intro view: welcome screen with "Begin Setup" CTA ─────────────────────────
  return (
    <div className="w-full bg-background">
      <Seo
        title="Set Up Your Service — No More Mosquitoes"
        description="Get started with mosquito protection. Set your preferences and schedule your first visit."
        canonicalUrl="https://nomoremosquitoes.us/onboarding"
      />

      <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24 space-y-10">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mb-2">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Let's set up your mosquito protection.
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            You're just a few steps away from a bite-free yard. We'll walk you through setting your service preferences and scheduling your first visit.
          </p>
        </div>

        {/* Pending data context banner — shown when user came from quote widget */}
        {(pendingAddress || pendingCadenceLabel || pending?.program === "annual") && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Your quote details are saved
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-foreground/80">
              {pendingAddress && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  {pendingAddress}
                </span>
              )}
              {pendingCadenceLabel && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  {pendingCadenceLabel}
                  {pendingProgramLabel && ` · ${pendingProgramLabel}`}
                </span>
              )}
              {!pendingCadenceLabel && pendingProgramLabel && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  {pendingProgramLabel}
                </span>
              )}
            </div>
            {pending?.program === "annual" && (
              <p className="text-xs text-muted-foreground">
                Annual plans require a custom property review — we'll connect you with our team.
              </p>
            )}
          </div>
        )}

        {/* Resume banner — shown when user has an interrupted flow session */}
        {savedStepLabel && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-50/60 dark:bg-amber-500/10 px-5 py-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 flex-shrink-0">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Pick up where you left off
                </p>
                <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5">
                  Your progress was saved up to the <strong>{savedStepLabel}</strong> step.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full rounded-xl h-9 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white border-none shadow-none"
              onClick={() => setView("flow")}
            >
              Resume from {savedStepLabel}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Feature cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Clock className="h-5 w-5 text-primary" />,
              title: "Takes 2 minutes",
              desc: "Tell us about your yard and pick a window that works for you.",
            },
            {
              icon: <Shield className="h-5 w-5 text-primary" />,
              title: "No surprise charges",
              desc: "You review your price before any payment is collected.",
            },
            {
              icon: <Sparkles className="h-5 w-5 text-primary" />,
              title: "We confirm first",
              desc: "Our team verifies availability and confirms your visit before the service day.",
            },
          ].map(({ icon, title, desc }) => (
            <Card key={title} className="rounded-[24px] border-border/60 shadow-soft">
              <CardContent className="p-6 space-y-2">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  {icon}
                </div>
                <p className="font-bold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            className="rounded-full px-10 h-14 shadow-brand text-base font-bold min-w-[260px]"
            onClick={handleBeginSetup}
          >
            Schedule My First Visit
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Skip for now — take me to my dashboard
          </button>
        </div>

      </div>
    </div>
  );
};

export default Onboarding;
