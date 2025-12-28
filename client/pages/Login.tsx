import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import SectionHeading from "@/components/common/SectionHeading";
import { CtaBand, PageHero } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthTabs from "@/components/auth/AuthTabs";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";

type LocationState = {
  from?: string;
};

const Login = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const { from } = (location.state as LocationState) ?? {};

  if (isAuthenticated) {
    return <Navigate to={from ?? "/dashboard"} replace />;
  }

  return (
    <div className="flex flex-col gap-0">
      <Seo
        title={t("auth.customerPortal")}
        description={t("auth.portalDesc")}
        canonicalUrl="https://nomoremosquitoes.us/login"
      />
      <PageHero
        variant="centered"
        title={t("auth.customerPortal")}
        description={t("auth.portalDesc")}
        primaryCta={{ label: t("auth.viewDashboard"), href: "/dashboard" }}
        secondaryCta={{ label: t("auth.callSupport"), href: "tel:+19497630492", external: true }}
      >
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("auth.newToPortal")}
        </p>
      </PageHero>
      <section className="bg-background py-24">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-3xl">{t("auth.manageService")}</CardTitle>
              <CardDescription>{t("auth.signInDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <AuthTabs />
            </CardContent>
          </Card>
          <div className="space-y-10">
            <div className="rounded-[32px] border border-border/60 bg-muted/40 p-10 shadow-soft">
              <SectionHeading
                eyebrow={t("auth.whatYouGet")}
                title={t("auth.dedicatedDashboard")}
                description={t("auth.dashboardDesc")}
              />
              <ul className="mt-8 space-y-4 text-sm text-muted-foreground">
                <li>• {t("auth.completionVideos")}</li>
                <li>• {t("auth.invoiceHistory")}</li>
                <li>• {t("auth.paymentSettings")}</li>
              </ul>
            </div>
            <CtaBand
              title={t("auth.needHelp")}
              href="tel:+19497630492"
              ctaLabel={t("auth.callOrTextSupport")}
              external
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;
