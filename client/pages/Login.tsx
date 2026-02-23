import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import SectionHeading from "@/components/common/SectionHeading";
import { CtaBand, PageHero } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthTabs from "@/components/auth/AuthTabs";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/use-translation";
import { supabase } from "@/lib/supabase";

type LocationState = {
  from?: string;
};

const Login = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const { from } = (location.state as LocationState) ?? {};

  const isSupabaseConfigured = Boolean(supabase);
  const hasUrl = Boolean(import.meta.env.VITE_SUPABASE_URL);
  const hasKey = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  const [testResult, setTestResult] = useState<string | null>(null);

  const runConnectionTest = async () => {
    setTestResult("Testing...");
    try {
      const start = Date.now();
      const { data, error } = await supabase.from("profiles").select("count", { count: "exact", head: true });
      const duration = Date.now() - start;
      if (error) {
        setTestResult(`Error: ${error.message} (${duration}ms)`);
      } else {
        setTestResult(`Success! Connected in ${duration}ms`);
      }
    } catch (err) {
      setTestResult(`Failed: ${(err as Error).message}`);
    }
  };

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
        <div className="flex flex-col items-center gap-4">
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("auth.newToPortal")}
          </p>
          <div className="flex flex-col items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${isSupabaseConfigured ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isSupabaseConfigured ? "bg-green-500" : "bg-red-500"}`} />
              {isSupabaseConfigured ? "Database Connected" : "Database Offline"}
            </div>
            {!isSupabaseConfigured && (
              <div className="text-[9px] text-muted-foreground">
                URL: {hasUrl ? "Found" : "Missing"} | Key: {hasKey ? "Found" : "Missing"}
              </div>
            )}
            <button
              onClick={runConnectionTest}
              className="mt-1 text-[8px] font-bold uppercase text-primary/60 hover:text-primary underline"
            >
              Run Connection Test
            </button>
            {testResult && (
              <div className="text-[8px] text-muted-foreground animate-in fade-in slide-in-from-top-1">
                {testResult}
              </div>
            )}
          </div>
        </div>
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
