import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  UserCircle,
  PlayCircle,
  Video,
  Loader2,
  Calendar
} from "lucide-react";

import SectionHeading from "@/components/common/SectionHeading";
import { CtaBand, PageHero } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { stringifyError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [upcomingVisits, setUpcomingVisits] = useState<any[]>([]);
  const [recentVideos, setRecentVideos] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        // 1. Fetch upcoming appointments
        const { data: appData, error: appError } = await supabase
          .from("appointments")
          .select(`
            id,
            status,
            scheduled_at,
            notes,
            property_id,
            service_type
          `)
          .eq("user_id", user.id)
          .in("status", ["requested", "scheduled", "confirmed"])
          .order("scheduled_at", { ascending: true })
          .limit(2);

        if (appError) throw appError;

        // 2. Fetch properties for these appointments
        const propertyIds = [...new Set((appData || []).map(a => a.property_id).filter(Boolean))];
        let properties: any[] = [];
        if (propertyIds.length > 0) {
          const { data } = await supabase.from("properties").select("id, address").in("id", propertyIds);
          properties = data || [];
        }

        // 3. Fetch assignments for technician names
        const appointmentIds = (appData || []).map(a => a.id);
        let assignments: any[] = [];
        if (appointmentIds.length > 0) {
          const { data } = await supabase.from("assignments").select("id, appointment_id, status").in("appointment_id", appointmentIds);
          assignments = data || [];
        }

        setUpcomingVisits((appData || []).map(app => {
          const property = properties.find(p => p.id === app.property_id);
          const assignment = assignments.find(a => a.appointment_id === app.id);
          return {
            id: app.id.split("-")[0].toUpperCase(),
            date: app.scheduled_at,
            timeWindow: app.notes?.includes("Slot:") ? (app.notes.split("Slot:")[1] || "").split("|")[0]?.trim() || "TBD" : "TBD",
            program: app.service_type || "Mosquito Service",
            technician: assignment ? "Technician Assigned" : "Assigning...",
            status: app.status.charAt(0).toUpperCase() + app.status.slice(1),
          };
        }));

        // 4. Fetch recent videos
        const { data: videoData, error: videoError } = await supabase
          .from("appointments")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "completed");

        if (videoData && videoData.length > 0) {
          const compAppIds = videoData.map(a => a.id);
          const { data: assigns } = await supabase.from("assignments").select("id, appointment_id").in("appointment_id", compAppIds);

          if (assigns && assigns.length > 0) {
            const assignIds = assigns.map(a => a.id);
            const { data: media } = await supabase
              .from("job_media")
              .select("id, url, caption, created_at, assignment_id")
              .eq("media_type", "video")
              .in("assignment_id", assignIds)
              .order("created_at", { ascending: false })
              .limit(3);

            setRecentVideos((media || []).map(m => {
              const assign = assigns.find(a => a.id === m.assignment_id);
              return {
                id: assign?.appointment_id?.split("-")[0].toUpperCase() || "N/A",
                recordedAt: m.created_at,
                summary: m.caption || "Visit Recap",
                url: m.url
              };
            }));
          }
        }
      } catch (err: any) {
        console.error("Dashboard Overview Error:", err);
        toast({
          title: "System: Dashboard Error",
          description: stringifyError(err),
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

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
                  <dd className="text-sm font-medium text-foreground">Mosquito + Pest Bundle</dd>
                  <dd className="text-[10px] text-muted-foreground mt-0.5">30-day recurring cadence</dd>
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
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-muted/20 rounded-[28px] border border-dashed border-border">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
                  <p className="text-muted-foreground font-medium italic">Loading your schedule...</p>
                </div>
              ) : upcomingVisits.length > 0 ? (
                upcomingVisits.map((visit) => (
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
                                visit.status === "Confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {visit.status}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-foreground">{visit.program}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {visit.timeWindow}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <UserCircle className="h-3.5 w-3.5" />
                                {visit.technician}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild className="rounded-full h-9 px-4 text-xs">
                              <Link to="/dashboard/support">{t("dashboard.requestAdjustment") || "Reschedule"}</Link>
                            </Button>
                            <Button size="sm" asChild className="rounded-full h-9 px-4 text-xs shadow-brand">
                              <Link to="/dashboard/appointments">{t("dashboard.addAddOn") || "+ Add-on"}</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="p-12 text-center bg-muted/10 rounded-[28px] border border-dashed border-border/60">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/30 mb-4">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <p className="text-muted-foreground font-medium italic">No upcoming visits found.</p>
                  <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl">
                    <Link to="/dashboard/appointments">Schedule Service</Link>
                  </Button>
                </div>
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
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="aspect-video rounded-[28px] bg-muted/20 animate-pulse border border-border/40" />
                ))
              ) : recentVideos.length > 0 ? (
                recentVideos.map((video) => (
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
              ) : (
                <div className="col-span-full p-12 text-center bg-muted/10 rounded-[32px] border border-dashed border-border/60">
                  <p className="text-muted-foreground font-medium italic">No visit videos available yet.</p>
                </div>
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
