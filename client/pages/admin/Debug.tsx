import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { adminApi } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Shield, RefreshCw, Activity } from "lucide-react";

interface SystemStatus {
  requestId: string;
  generated_at: string;
  environment: string;
  app_version: string;
  providers: {
    supabase: Record<string, boolean>;
    stripe: Record<string, unknown>;
    resend: Record<string, unknown>;
    twilio: Record<string, boolean>;
  };
  feature_flags: Record<string, boolean>;
  operational: Record<string, boolean>;
  counts: Record<string, number | string>;
  checkpoint_persistence: string;
}

const Bool = ({ value, label }: { value: boolean; label: string }) => (
  <div className="flex items-center gap-2 text-sm">
    {value
      ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
      : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
    <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
  </div>
);

interface HealthResult { ok?: boolean; latencyMs?: number; [key: string]: any; }

const Debug = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [health, setHealth] = useState<Record<string, HealthResult | null>>({});
  const [healthLoading, setHealthLoading] = useState(false);

  const loadStatus = () => {
    setIsLoading(true);
    setError(null);
    adminApi("/api/admin/debug/system-status")
      .then((d: any) => setStatus(d.status))
      .catch((e: any) => setError(e.message || "Failed to load system status"))
      .finally(() => setIsLoading(false));
  };

  const loadHealth = async () => {
    setHealthLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const fetchHealth = async (path: string) => {
      try {
        const r = await fetch(path, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
        return await r.json();
      } catch { return { ok: false, error: "Request failed" }; }
    };
    const [db, stripe, email, parcel, workforce] = await Promise.all([
      fetchHealth("/api/health/database"),
      fetchHealth("/api/health/stripe"),
      fetchHealth("/api/health/email"),
      fetchHealth("/api/health/parcel"),
      fetchHealth("/api/health/workforce"),
    ]);
    setHealth({ db, stripe, email, parcel, workforce });
    setHealthLoading(false);
  };

  useEffect(() => { loadStatus(); loadHealth(); }, []);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />Loading system status…
    </div>
  );

  if (error) return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-600 mx-auto mb-2" />
      <p className="font-semibold text-amber-800">{error}</p>
      <p className="text-xs text-amber-700 mt-1">The debug panel may be disabled. Set ENABLE_ADMIN_DEBUG_PANEL=true in your environment.</p>
    </div>
  );

  if (!status) return null;

  const stripeMode = (status.providers.stripe as any)?.stripe_mode;
  const stripeMismatch = (status.providers.stripe as any)?.mode_mismatch;

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="System"
        title="Debug Dashboard"
        description="Safe system configuration status. No secrets are shown here."
      />

      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
        <Shield className="h-5 w-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Admin-only — No secrets are exposed on this page</p>
          <p className="text-xs text-amber-700">Generated: {new Date(status.generated_at).toLocaleString()} · Request ID: <code className="font-mono">{status.requestId}</code></p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Environment */}
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Environment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge className={status.environment === "production" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                {status.environment}
              </Badge>
              <span className="text-muted-foreground">NODE_ENV</span>
            </div>
            <p className="text-xs text-muted-foreground">Version: {status.app_version}</p>
          </CardContent>
        </Card>

        {/* Stripe */}
        <Card className={`rounded-2xl border-border/60 bg-card/95 ${stripeMismatch ? "border-red-300 bg-red-50/30" : ""}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Stripe
              <Badge className={stripeMode === "live" ? "bg-green-100 text-green-800" : stripeMode === "test" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}>
                {stripeMode}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Bool value={!!(status.providers.stripe as any)?.secret_key_configured} label="Secret key set" />
            <Bool value={!!(status.providers.stripe as any)?.webhook_secret_configured} label="Webhook secret set" />
            <Bool value={!!(status.providers.stripe as any)?.publishable_key_configured} label="Publishable key set" />
            {stripeMismatch && (
              <p className="text-xs text-red-700 mt-1 font-semibold">⚠ Mode mismatch — test key in production</p>
            )}
          </CardContent>
        </Card>

        {/* Supabase */}
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader className="pb-3"><CardTitle className="text-base">Supabase</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            <Bool value={status.providers.supabase.url_configured} label="URL configured" />
            <Bool value={status.providers.supabase.anon_key_configured} label="Anon key set" />
            <Bool value={status.providers.supabase.service_role_configured} label="Service role set" />
          </CardContent>
        </Card>

        {/* Resend */}
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader className="pb-3"><CardTitle className="text-base">Resend (Email)</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            <Bool value={!!(status.providers.resend as any)?.api_key_configured} label="API key set" />
            <Bool value={!!(status.providers.resend as any)?.from_email_configured} label="From email set" />
            {(status.providers.resend as any)?.from_email && (
              <p className="text-xs text-muted-foreground">From: {(status.providers.resend as any).from_email}</p>
            )}
          </CardContent>
        </Card>

        {/* Twilio */}
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader className="pb-3"><CardTitle className="text-base">Twilio (SMS)</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            <Bool value={status.providers.twilio.account_sid_configured} label="Account SID set" />
            <Bool value={status.providers.twilio.auth_token_configured} label="Auth token set" />
            <Bool value={status.providers.twilio.from_number_configured} label="From number set" />
          </CardContent>
        </Card>

        {/* Counts */}
        <Card className="rounded-2xl border-border/60 bg-card/95">
          <CardHeader className="pb-3"><CardTitle className="text-base">Live Counts</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {Object.entries(status.counts).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                <span className="font-semibold">{String(v)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Feature Flags */}
      <Card className="rounded-2xl border-border/60 bg-card/95">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Feature Flags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(status.feature_flags).map(([flag, enabled]) => (
              <Bool key={flag} value={enabled} label={flag} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Operational */}
      <Card className="rounded-2xl border-border/60 bg-card/95">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operational Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(status.operational).map(([k, v]) => (
              <Bool key={k} value={v} label={k.replace(/_/g, " ")} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Checkpoint persistence: <span className="font-medium">{status.checkpoint_persistence}</span>
          </p>
        </CardContent>
      </Card>

      {/* Live Health Checks */}
      <Card className="rounded-2xl border-border/60 bg-card/95">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Live Health Checks
            </CardTitle>
            <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={loadHealth} disabled={healthLoading}>
              {healthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {healthLoading && Object.keys(health).length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />Checking providers…
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { key: "db", label: "Database", latency: health.db?.latencyMs },
                { key: "stripe", label: "Stripe", extra: health.stripe?.mode },
                { key: "email", label: "Email (Resend)", extra: health.email?.reminderDryRun ? "dry-run" : undefined },
                { key: "parcel", label: "Parcel Service", extra: health.parcel?.countyLookupEnabled ? "county on" : "county off" },
                { key: "workforce", label: "Workforce", extra: health.workforce ? `${health.workforce.activeTechnicians ?? "?"} techs` : undefined },
              ].map(({ key, label, latency, extra }) => {
                const h = health[key];
                const isOk = h?.ok === true;
                return (
                  <div key={key} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isOk ? "border-green-200 bg-green-50" : h ? "border-red-200 bg-red-50" : "border-border/40 bg-muted/20"}`}>
                    {!h ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
                      : isOk ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {latency != null ? `${latency}ms` : extra ?? (isOk ? "OK" : h?.error ?? "error")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Debug;
