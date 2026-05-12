import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSubscriptions } from "@/hooks/dashboard/useSubscriptions";
import {
  ArrowRight,
  Clock,
  UserCircle,
  PlayCircle,
  Video,
  CalendarX2,
  VideoOff,
} from "lucide-react";

import SectionHeading from "@/components/common/SectionHeading";
import { CtaBand, PageHero } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/dashboard/useDashboardData";
import { cn } from "@/lib/utils";
import { WeatherStatusModule } from "@/components/dashboard/WeatherStatusModule";


const Dashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Use React Query hook for caching and automatic data management
  const { data: dashboardData } = useDashboardData(user?.id);
  const { data: subscriptions = [] } = useSubscriptions(user?.id);
  const activeSubscription = (subscriptions as any[]).find((s) => s.status === "active") ?? subscriptions[0];

  const upcomingVisits = dashboardData?.upcomingVisits ?? [];
  const recentVideos = dashboardData?.recentVideos ?? [];

  const firstName = useMemo(() => {
    if (!user?.name) return "";
    return user.name.split(" ")[0] ?? user.name;
  }, [user?.name]);

  const handleLogout = () => {
    logout();
    toast({ title: t("dashboard.signedOut"), description: t("dashboard.signedOutDesc") });
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col gap-0">
      <Seo
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        canonicalUrl="https://nomoremosquitoes.us/dashboard"
      />
      <PageHero
        variant="split"
        title={(t("dashboard.welcome") || "Welcome back, {name}.").replace("{name}", firstName || "there")}
        description={t("dashboard.trackDesc")}
        primaryCta={{ label: t("dashboard.scheduleVisit"), href: "/dashboard/appointments" }}
        secondaryCta={{ label: t("dashboard.updateContact"), href: "/dashboard/profile" }}
        aside={
          <div className="space-y-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{t("dashboard.accountDetails")}</p>
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">{t("dashboard.nameLabel")}</dt>
                  <dd className="text-sm font-medium text-foreground">{user?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">{t("dashboard.emailLabel")}</dt>
                  <dd className="text-sm font-medium text-foreground">{user?.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">{t("dashboard.subscriptionLabel")}</dt>
                  {activeSubscription ? (
                    <>
                      <dd className="text-sm font-medium text-foreground">{activeSubscription.plan || "Mosquito Service"}</dd>
                      <dd className="text-[10px] text-muted-foreground mt-0.5">{activeSubscription.cadence || 30}-day recurring cadence</dd>
                    </>
                  ) : (
                    <dd className="text-sm text-muted-foreground italic">No active plan</dd>
                  )}
                </div>
              </dl>
              <Button variant="outline" size="sm" className="mt-4 w-full rounded-xl" onClick={handleLogout}>
                {t("dashboard.signOut")}
              </Button>
            </div>
          </div>
        }
      />
      <section className="bg-background py-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 space-y-24">

          {/* Weather and Service Status Module - Non-blocking */}
          <WeatherStatusModule />

          {/* Upcoming Visits Section */}
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <SectionHeading
                eyebrow={t("dashboard.upcomingVisits")}
                title={t("dashboard.upcomingDesc")}
                description={t("dashboard.upcomingHint")}
              />
              <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80 self-start md:self-auto">
                <Link to="/dashboard/appointments" className="flex items-center gap-1">
                  View all appointments <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6">
              {upcomingVisits.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-border/60 bg-muted/20 px-8 py-14 text-center">
                  <CalendarX2 className="h-10 w-10 text-muted-foreground/40" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">No upcoming visits scheduled</p>
                    <p className="text-sm text-muted-foreground">Book your first service and we'll take care of the rest.</p>
                  </div>
                  <Button asChild className="rounded-full px-6 shadow-brand">
                    <Link to="/dashboard/appointments">Schedule a Visit</Link>
                  </Button>
                </div>
              ) : (
                upcomingVisits.map((visit: any) => (
                  <Card key={visit.id} className="group overflow-hidden rounded-[28px] border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-md">
                    <div className="flex flex-col sm:flex-row">
                      <div className="flex flex-col items-center justify-center bg-primary/5 px-6 py-6 text-center sm:w-32 sm:border-r border-border/40">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                          {new Date(visit.date).toLocaleDateString(undefined, { month: "short" })}
                        </span>
                        <span className="text-3xl font-display font-bold text-primary">
                          {new Date(visit.date).toLocaleDateString(undefined, { day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex-1 p-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Job #{visit.id}</span>
                              <span className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                visit.status === "Scheduled" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {visit.status}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-foreground">{visit.program}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{visit.timeWindow}</span>
                              <span className="flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" />{visit.technician}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild className="rounded-full h-9 px-4 text-xs">
                              <Link to="/dashboard/appointments">{t("dashboard.requestAdjustment") || "Reschedule"}</Link>
                            </Button>
                            <Button size="sm" asChild className="rounded-full h-9 px-4 text-xs shadow-brand">
                              <Link to="/dashboard/marketplace">{t("dashboard.addAddOn") || "+ Add-on"}</Link>
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

          {/* Visit Documentation Section */}
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <SectionHeading
                eyebrow={t("dashboard.visitDocs")}
                title={t("dashboard.completionVideos") || "Latest Uploads"}
                description={t("dashboard.videosDesc")}
              />
              <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80 self-start md:self-auto">
                <Link to="/dashboard/videos" className="flex items-center gap-1">
                  View archive <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recentVideos.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-border/60 bg-muted/20 px-8 py-14 text-center">
                  <VideoOff className="h-10 w-10 text-muted-foreground/40" />
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">No visit videos yet</p>
                    <p className="text-sm text-muted-foreground">HD recap videos appear here after your technician completes each visit.</p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full px-6">
                    <Link to="/dashboard/videos">View video archive</Link>
                  </Button>
                </div>
              ) : (
                recentVideos.map((video: any) => (
                  <Card key={video.id} className="group overflow-hidden rounded-[28px] border-border/50 bg-card hover:border-primary/30 transition-all shadow-soft">
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
                ))
              )}
            </div>
          </div>

        </div>
      </section>
      <CtaBand title={t("dashboard.pauseVisit")} href="/dashboard/support" ctaLabel={t("dashboard.messageTeam")} />
    </div>
  );
};

export default Dashboard;
