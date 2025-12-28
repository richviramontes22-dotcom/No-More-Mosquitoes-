import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import SectionHeading from "@/components/common/SectionHeading";
import { CtaBand, PageHero } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/use-translation";
import { useAuth } from "@/contexts/AuthContext";

const upcomingVisits = [
  {
    id: "OC-1280",
    date: "2024-12-14",
    timeWindow: "9:00–11:00 a.m.",
    program: "Mosquito subscription",
    technician: "Alicia P.",
    status: "Confirmed",
  },
  {
    id: "OC-1312",
    date: "2025-01-04",
    timeWindow: "2:00–4:00 p.m.",
    program: "Tick add-on",
    technician: "Michael R.",
    status: "Tentative",
  },
];

const recentVideos = [
  {
    id: "OC-1244",
    recordedAt: "2024-11-30",
    summary: "Perimeter barrier + drain treatment",
    url: "https://example.com/videos/oc-1244",
  },
  {
    id: "OC-1201",
    recordedAt: "2024-11-09",
    summary: "Larvicide treatment in planters",
    url: "https://example.com/videos/oc-1201",
  },
];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

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
        title={t("dashboard.welcome").replace("{name}", firstName || "there")}
        description={t("dashboard.trackDesc")}
        primaryCta={{ label: t("dashboard.scheduleVisit"), href: "/schedule" }}
        secondaryCta={{ label: t("dashboard.updateContact"), href: "/contact" }}
        aside={
          <div className="space-y-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">{t("dashboard.accountDetails")}</p>
            <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">{t("dashboard.nameLabel")}</dt>
                  <dd className="text-sm text-foreground">{user?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">{t("dashboard.emailLabel")}</dt>
                  <dd className="text-sm text-foreground">{user?.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">{t("dashboard.subscriptionLabel")}</dt>
                  <dd className="text-sm text-foreground">Mosquito + pest bundle (21-day cadence)</dd>
                </div>
              </dl>
              <Button variant="outline" className="mt-4 w-full" onClick={handleLogout}>
                {t("dashboard.signOut")}
              </Button>
            </div>
          </div>
        }
      />
      <section className="bg-background py-24">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.4fr_0.9fr] lg:px-8">
          <div className="space-y-8">
            <SectionHeading
              eyebrow={t("dashboard.upcomingVisits")}
              title={t("dashboard.upcomingDesc")}
              description={t("dashboard.upcomingHint")}
            />
            <div className="grid gap-6">
              {upcomingVisits.map((visit) => (
                <Card key={visit.id} className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl font-semibold text-foreground">#{visit.id}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground/90">
                        {new Date(visit.date).toLocaleDateString(undefined, {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {" • "}
                        {visit.timeWindow}
                      </CardDescription>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {visit.status}
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="rounded-full bg-muted/60 px-3 py-1">{visit.program}</span>
                      <span className="rounded-full bg-muted/60 px-3 py-1">Technician: {visit.technician}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <Button asChild variant="secondary" className="rounded-full">
                        <Link to="/contact">{t("dashboard.requestAdjustment")}</Link>
                      </Button>
                      <Button asChild className="rounded-full">
                        <Link to="/schedule">{t("dashboard.addAddOn")}</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div className="space-y-8">
            <SectionHeading
              eyebrow={t("dashboard.visitDocs")}
              title={t("dashboard.completionVideos")}
              description={t("dashboard.videosDesc")}
            />
            <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
              <CardHeader>
                <CardTitle className="text-lg">{t("dashboard.latestUploads")}</CardTitle>
                <CardDescription>Tap a video to view the HD completion recap.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentVideos.map((video, index) => (
                  <div key={video.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Job {video.id}</p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(video.recordedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{video.summary}</p>
                    <Button asChild variant="outline" className="rounded-full">
                      <a href={video.url} target="_blank" rel="noreferrer">
                        {t("dashboard.watchVideo")}
                      </a>
                    </Button>
                    {index < recentVideos.length - 1 ? <Separator className="my-2" /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
              <CardHeader>
                <CardTitle className="text-lg">{t("dashboard.billingAndComm")}</CardTitle>
                <CardDescription>{t("dashboard.billingDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>• {t("dashboard.bulletUpdateCards")}</p>
                <p>• {t("dashboard.bulletNotifications")}</p>
                <p>• {t("dashboard.bulletInvoices")}</p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="rounded-full">
                    <Link to="/contact">{t("dashboard.talkWithBilling")}</Link>
                  </Button>
                  <Button asChild variant="secondary" className="rounded-full">
                    <Link to="/pricing">{t("dashboard.reviewPlan")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <CtaBand title={t("dashboard.pauseVisit")} href="/contact" ctaLabel={t("dashboard.messageTeam")} />
    </div>
  );
};

export default Dashboard;
