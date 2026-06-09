import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscriptions } from "@/hooks/dashboard/useSubscriptions";
import { useProfile } from "@/hooks/useProfile";
import { useProperties } from "@/hooks/dashboard/useProperties";
import {
  ArrowRight,
  Clock,
  UserCircle,
  PlayCircle,
  Video,
  CalendarX2,
  VideoOff,
  Sparkles,
  MapPin,
  CheckCircle2,
  Shield,
  Calendar,
  CreditCard,
  ShoppingBag,
} from "lucide-react";
import { useScheduleDialog } from "@/components/schedule/ScheduleDialogProvider";
import { clearPendingOnboarding } from "@/lib/pendingOnboarding";
import { useCart } from "@/contexts/CartContext";

import SectionHeading from "@/components/common/SectionHeading";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/dashboard/useDashboardData";
import { cn } from "@/lib/utils";
import { WeatherStatusModule } from "@/components/dashboard/WeatherStatusModule";
import { supabase } from "@/lib/supabase";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { open: openScheduleDialog } = useScheduleDialog();

  const { data: dashboardData } = useDashboardData(user?.id);
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useSubscriptions(user?.id);
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: properties = [] } = useProperties(user?.id);
  const { itemCount: cartItemCount } = useCart();

  const activeSubscription = (subscriptions as any[]).find((s) => s.status === "active");
  const hasActiveSubscription = !!activeSubscription;
  const isPreCustomer =
    !subscriptionsLoading &&
    !profileLoading &&
    (profile as any)?.is_onboarded === true &&
    !hasActiveSubscription;

  const upcomingVisits = dashboardData?.upcomingVisits ?? [];
  const recentVideos   = dashboardData?.recentVideos ?? [];

  const savedProperty = properties[0];
  const savedAddress = savedProperty
    ? [savedProperty.address, savedProperty.city, savedProperty.state].filter(Boolean).join(", ")
    : null;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }, []);

  const firstName = useMemo(() => {
    if (!user?.name) return "";
    return user.name.split(" ")[0] ?? user.name;
  }, [user?.name]);

  // ── Onboarding redirect ───────────────────────────────────────────────────
  useEffect(() => {
    if (subscriptionsLoading || profileLoading) return;
    if (activeSubscription) return;
    if ((profile as any)?.is_onboarded !== false) return;
    navigate("/onboarding", { replace: true });
  }, [subscriptionsLoading, profileLoading, activeSubscription, profile, navigate]);

  // ── Mark is_onboarded on subscription acquisition ─────────────────────────
  useEffect(() => {
    if (activeSubscription && (profile as any)?.is_onboarded === false && user?.id) {
      supabase
        .from("profiles")
        .update({ is_onboarded: true })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.warn("[Dashboard] Failed to mark is_onboarded:", error.message);
        });
    }
  }, [activeSubscription, profile, user?.id]);

  const handleLogout = () => {
    logout();
    toast({ title: t("dashboard.signedOut"), description: t("dashboard.signedOutDesc") });
    navigate("/login", { replace: true });
  };

  // ── Pre-customer view ─────────────────────────────────────────────────────
  if (isPreCustomer) {
    return (
      <div className="flex flex-col gap-0">
        <Seo
          title="Complete Your Setup — No More Mosquitoes"
          description="Finish setting up your mosquito protection service."
          canonicalUrl="https://nomoremosquitoes.us/dashboard"
        />

        <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border/40 px-4 sm:px-6 lg:px-8 py-10">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Setup in progress</p>
              <h1 className="font-display text-3xl font-bold sm:text-4xl">
                Welcome back, {firstName || "there"}.
              </h1>
            </div>
            <Button variant="ghost" size="sm" className="rounded-xl shrink-0 text-muted-foreground" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>

        <section className="bg-background py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="rounded-[32px] border-2 border-primary/20 bg-primary/5 p-8 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="space-y-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">
                    {savedAddress ? "Pick up where you left off" : "Get started"}
                  </p>
                  <h2 className="font-display text-2xl font-bold sm:text-3xl">
                    {savedAddress ? "Your property is saved — one step left." : "Set up your mosquito protection."}
                  </h2>
                  {savedAddress && (
                    <div className="flex items-center gap-2 text-sm text-foreground/70">
                      <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{savedAddress}</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground max-w-md">
                    {savedAddress
                      ? "Choose your service plan, pick an arrival window, and complete your payment. Takes about 2 minutes."
                      : "Tell us about your property, pick a service plan, and schedule your first visit."}
                  </p>
                  <ul className="space-y-2">
                    {[
                      "No charges until you confirm your plan",
                      "We verify availability before your service day",
                      "100% satisfaction guarantee — free re-service if needed",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-foreground/80">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-3 min-w-[200px]">
                  <Button size="lg" className="rounded-full px-10 h-14 shadow-brand text-base font-bold" asChild>
                    <Link to="/onboarding">
                      {savedAddress ? "Activate service" : "Get started"}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" asChild>
                    <Link to="/dashboard/profile">Update contact info</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { icon: <Sparkles className="h-5 w-5 text-primary" />, title: "Barrier treatments", desc: "Our technicians treat your yard's perimeter, shrubs, and standing water areas with EPA-registered products." },
                { icon: <Shield className="h-5 w-5 text-primary" />, title: "Recurring protection", desc: "Subscription plans keep mosquitoes away all season. One-time visits are available for events." },
                { icon: <Video className="h-5 w-5 text-primary" />, title: "HD visit recaps", desc: "Every visit is documented with an HD video walkthrough uploaded to your dashboard after completion." },
              ].map(({ icon, title, desc }) => (
                <Card key={title} className="rounded-[24px] border-border/60 shadow-soft">
                  <CardContent className="p-6 space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">{icon}</div>
                    <p className="font-bold text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ── Full customer dashboard ───────────────────────────────────────────────
  const nextVisit   = upcomingVisits[0] ?? null;
  const lastVideo   = recentVideos[0] ?? null;

  return (
    <div className="grid gap-8">
      <Seo
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        canonicalUrl="https://nomoremosquitoes.us/dashboard"
      />

      {/* ── Compact status header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-1">
            {greeting}
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h1>
          {activeSubscription && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Mosquito protection is active
              {activeSubscription.plan ? ` · ${activeSubscription.plan}` : ""}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="rounded-xl shrink-0 text-muted-foreground"
        >
          Sign out
        </Button>
      </div>

      {/* ── Weather ───────────────────────────────────────────────────────── */}
      <WeatherStatusModule />

      {/* ── Quick-stat widgets ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Next Visit */}
        <Link to="/dashboard/appointments" className="group">
          <div className="rounded-[20px] border border-border/60 bg-card p-5 shadow-soft hover:shadow-md hover:border-primary/30 transition-all h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Next Visit</span>
              <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            {nextVisit ? (
              <>
                <p className="text-xl font-display font-bold text-foreground">
                  {new Date(nextVisit.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{nextVisit.timeWindow}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-muted-foreground">Not scheduled</p>
                <p className="text-xs text-primary mt-1">Schedule now →</p>
              </>
            )}
          </div>
        </Link>

        {/* Active Plan */}
        <Link to="/dashboard/billing" className="group">
          <div className="rounded-[20px] border border-border/60 bg-card p-5 shadow-soft hover:shadow-md hover:border-primary/30 transition-all h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Plan</span>
              <CreditCard className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            {activeSubscription ? (
              <>
                <p className="text-xl font-display font-bold text-foreground">
                  {activeSubscription.plan || "Active"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeSubscription.cadence || 30}-day cadence
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-muted-foreground">No active plan</p>
                <p className="text-xs text-primary mt-1">Set up service →</p>
              </>
            )}
          </div>
        </Link>

        {/* Last Recap */}
        <Link to="/dashboard/appointments" className="group">
          <div className="rounded-[20px] border border-border/60 bg-card p-5 shadow-soft hover:shadow-md hover:border-primary/30 transition-all h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Last Recap</span>
              <Video className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            {lastVideo ? (
              <>
                <p className="text-xl font-display font-bold text-foreground">
                  {new Date((lastVideo as any).recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
                <p className="text-xs text-primary mt-1">Watch recap →</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-muted-foreground">No recaps yet</p>
                <p className="text-xs text-muted-foreground mt-1">Available after first visit</p>
              </>
            )}
          </div>
        </Link>

        {/* Shop / Cart */}
        <Link to="/dashboard/marketplace" className="group">
          <div className="rounded-[20px] border border-border/60 bg-card p-5 shadow-soft hover:shadow-md hover:border-primary/30 transition-all h-full">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shop</span>
              <ShoppingBag className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            {cartItemCount > 0 ? (
              <>
                <p className="text-xl font-display font-bold text-foreground">
                  {cartItemCount} item{cartItemCount !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-primary mt-1">Complete checkout →</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-muted-foreground">No items in cart</p>
                <p className="text-xs text-primary mt-1">Browse add-ons →</p>
              </>
            )}
          </div>
        </Link>
      </div>

      {/* ── Upcoming Visits ───────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <SectionHeading
            eyebrow={t("dashboard.upcomingVisits")}
            title={t("dashboard.upcomingDesc")}
            description={t("dashboard.upcomingHint")}
          />
          <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80 self-start md:self-auto">
            <Link to="/dashboard/appointments" className="flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {upcomingVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-border/60 bg-muted/20 px-8 py-12 text-center">
              <CalendarX2 className="h-10 w-10 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">No upcoming visits scheduled</p>
                <p className="text-sm text-muted-foreground">Book your next service and we'll take care of the rest.</p>
              </div>
              <Button asChild className="rounded-full px-6 shadow-brand">
                <Link to="/dashboard/appointments">Schedule a Visit</Link>
              </Button>
            </div>
          ) : (
            upcomingVisits.slice(0, 3).map((visit: any) => (
              <Card key={visit.id} className="group overflow-hidden rounded-[24px] border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex flex-col sm:flex-row">
                  <div className="flex flex-col items-center justify-center bg-primary/5 px-6 py-5 text-center sm:w-28 sm:border-r border-border/40">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                      {new Date(visit.date).toLocaleDateString(undefined, { month: "short" })}
                    </span>
                    <span className="text-3xl font-display font-bold text-primary">
                      {new Date(visit.date).toLocaleDateString(undefined, { day: "numeric" })}
                    </span>
                  </div>
                  <div className="flex-1 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job #{visit.id}</span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            visit.status === "Scheduled" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {visit.status}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-foreground">{visit.program}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{visit.timeWindow}</span>
                          <span className="flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" />{visit.technician}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild className="rounded-full h-8 px-3 text-xs">
                          <Link to="/dashboard/appointments">Reschedule</Link>
                        </Button>
                        <Button size="sm" asChild className="rounded-full h-8 px-3 text-xs shadow-brand">
                          <Link to="/dashboard/marketplace">+ Add-on</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* ── Recent Recaps ─────────────────────────────────────────────────── */}
      {recentVideos.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <SectionHeading
              eyebrow={t("dashboard.visitDocs")}
              title={t("dashboard.completionVideos") || "Latest Recaps"}
              description={t("dashboard.videosDesc")}
            />
            <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80 self-start md:self-auto">
              <Link to="/dashboard/appointments" className="flex items-center gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recentVideos.map((video: any) => (
              <Card key={video.id} className="group overflow-hidden rounded-[24px] border-border/50 bg-card hover:border-primary/30 transition-all shadow-soft">
                <div className="relative aspect-video bg-muted/30 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center bg-black/5 group-hover:bg-black/10 transition-colors">
                    <PlayCircle className="h-12 w-12 text-white/80 drop-shadow-md group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1 text-[10px] font-bold uppercase text-white backdrop-blur-md">
                    <Video className="h-3 w-3" />
                    Job recap
                  </div>
                </div>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">#{video.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(video.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground line-clamp-1">{video.summary}</h4>
                  <Button asChild variant="secondary" className="w-full rounded-xl h-9 text-xs">
                    <a href={video.url} target="_blank" rel="noopener noreferrer">Watch Recap</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no videos yet */}
      {recentVideos.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-border/60 bg-muted/20 px-8 py-12 text-center">
          <VideoOff className="h-10 w-10 text-muted-foreground/40" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">No visit recaps yet</p>
            <p className="text-sm text-muted-foreground">HD recap videos appear here after your technician completes each visit.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
