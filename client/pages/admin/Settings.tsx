import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Key, Shield, CreditCard, Mail, MessageSquare, Map, Activity, Globe, Zap, Database, Code, FileText } from "lucide-react";

export type TeamRole = "admin" | "support";
export type TeamMember = { id: string; name: string; email: string; role: TeamRole };

const seedTeam: TeamMember[] = [
  { id: "u_1", name: "Elijah Noble", email: "owner@example.com", role: "admin" },
  { id: "u_2", name: "Ana Ramirez", email: "support@example.com", role: "support" },
];

const Settings = () => {
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>(() => seedTeam.slice());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("support");

  const [isSaving, setIsSaving] = useState(false);

  const [flags, setFlags] = useState({
    autoAssignTickets: true,
    requireCompletionVideo: true,
    enableReserviceRequests: true,
    smsReminders: true,
  });

  const [integrations, setIntegrations] = useState({
    supabase: { enabled: true, url: "", anonKey: "" },
    stripe: {
      enabled: true,
      secretKey: import.meta.env.VITE_STRIPE_SECRET_KEY || "",
      publicKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
    },
    sendgrid: { enabled: false, apiKey: "" },
    twilio: { enabled: false, sid: "", token: "" },
    googleMaps: { enabled: false, apiKey: "" },
    sentry: { enabled: false, dsn: "" },
    netlify: { enabled: false },
    builder: { enabled: false, apiKey: "" },
    neon: { enabled: false, connectionString: "" },
    notion: { enabled: false, token: "" },
  });

  const validInvite = name.trim() && /.+@.+/.test(email);

  const removeMember = (id: string) => setTeam((prev) => prev.filter((m) => m.id !== id));
  const updateRole = (id: string, r: TeamRole) => setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, role: r } : m)));

  const updateIntegration = (key: keyof typeof integrations, field: string, value: any) => {
    setIntegrations((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    // Simulate API call delay
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
    toast({
      title: "Settings Saved",
      description: "Infrastructure configuration and team changes are now live.",
    });
  };

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Settings"
        title="Infrastructure & Team"
        description="Configure your technology stack, API keys, and manage team access levels."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          {/* API Keys & External Accounts Section */}
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-primary/5 p-8 border-b border-border/40">
              <div className="flex items-center gap-3 text-primary mb-1">
                <Key className="h-6 w-6" />
                <CardTitle className="text-2xl font-display font-bold">API Keys & External Accounts</CardTitle>
              </div>
              <CardDescription className="text-base">
                Connect your core infrastructure and third-party services.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              {/* Supabase */}
              <div className="space-y-6">
                <IntegrationHeader
                  icon={<Database className="h-5 w-5 text-emerald-500" />}
                  title="Supabase"
                  description="Database, Authentication, and Edge Functions."
                  enabled={integrations.supabase.enabled}
                  onToggle={(b) => updateIntegration('supabase', 'enabled', b)}
                />
                {integrations.supabase.enabled && (
                  <div className="grid sm:grid-cols-2 gap-4 pl-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Project URL</Label>
                      <Input
                        placeholder="https://xyz.supabase.co"
                        value={integrations.supabase.url}
                        onChange={(e) => updateIntegration('supabase', 'url', e.target.value)}
                        className="rounded-xl h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Anon Key</Label>
                      <Input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                        value={integrations.supabase.anonKey}
                        onChange={(e) => updateIntegration('supabase', 'anonKey', e.target.value)}
                        className="rounded-xl h-11"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stripe */}
              <div className="space-y-6 pt-6 border-t border-border/40">
                <IntegrationHeader
                  icon={<CreditCard className="h-5 w-5 text-indigo-500" />}
                  title="Stripe"
                  description="Payment processing, billing, and subscription management."
                  enabled={integrations.stripe.enabled}
                  onToggle={(b) => updateIntegration('stripe', 'enabled', b)}
                />
                {integrations.stripe.enabled && (
                  <div className="grid sm:grid-cols-2 gap-4 pl-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Secret Key</Label>
                      <Input
                        type="password"
                        placeholder="sk_live_..."
                        value={integrations.stripe.secretKey}
                        onChange={(e) => updateIntegration('stripe', 'secretKey', e.target.value)}
                        className="rounded-xl h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Publishable Key</Label>
                      <Input
                        placeholder="pk_live_..."
                        value={integrations.stripe.publicKey}
                        onChange={(e) => updateIntegration('stripe', 'publicKey', e.target.value)}
                        className="rounded-xl h-11"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Email & SMS */}
              <div className="grid md:grid-cols-2 gap-10 pt-6 border-t border-border/40">
                <div className="space-y-6">
                  <IntegrationHeader
                    icon={<Mail className="h-5 w-5 text-orange-500" />}
                    title="SendGrid"
                    description="Transactional emails."
                    enabled={integrations.sendgrid.enabled}
                    onToggle={(b) => updateIntegration('sendgrid', 'enabled', b)}
                  />
                  {integrations.sendgrid.enabled && (
                    <div className="pl-8 space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">API Key</Label>
                      <Input
                        type="password"
                        placeholder="SG.xyz..."
                        value={integrations.sendgrid.apiKey}
                        onChange={(e) => updateIntegration('sendgrid', 'apiKey', e.target.value)}
                        className="rounded-xl h-11"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <IntegrationHeader
                    icon={<MessageSquare className="h-5 w-5 text-blue-500" />}
                    title="Twilio"
                    description="SMS reminders & chat."
                    enabled={integrations.twilio.enabled}
                    onToggle={(b) => updateIntegration('twilio', 'enabled', b)}
                  />
                  {integrations.twilio.enabled && (
                    <div className="pl-8 grid gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account SID</Label>
                        <Input
                          placeholder="AC..."
                          value={integrations.twilio.sid}
                          onChange={(e) => updateIntegration('twilio', 'sid', e.target.value)}
                          className="rounded-xl h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Auth Token</Label>
                        <Input
                          type="password"
                          placeholder="Token"
                          value={integrations.twilio.token}
                          onChange={(e) => updateIntegration('twilio', 'token', e.target.value)}
                          className="rounded-xl h-11"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Maps & Monitoring */}
              <div className="grid md:grid-cols-2 gap-10 pt-6 border-t border-border/40">
                <div className="space-y-6">
                  <IntegrationHeader
                    icon={<Map className="h-5 w-5 text-red-500" />}
                    title="Google Maps"
                    description="Address lookup & maps."
                    enabled={integrations.googleMaps.enabled}
                    onToggle={(b) => updateIntegration('googleMaps', 'enabled', b)}
                  />
                  {integrations.googleMaps.enabled && (
                    <div className="pl-8 space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">API Key</Label>
                      <Input
                        type="password"
                        placeholder="AIza..."
                        value={integrations.googleMaps.apiKey}
                        onChange={(e) => updateIntegration('googleMaps', 'apiKey', e.target.value)}
                        className="rounded-xl h-11"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <IntegrationHeader
                    icon={<Activity className="h-5 w-5 text-purple-500" />}
                    title="Sentry"
                    description="Error tracking."
                    enabled={integrations.sentry.enabled}
                    onToggle={(b) => updateIntegration('sentry', 'enabled', b)}
                  />
                  {integrations.sentry.enabled && (
                    <div className="pl-8 space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">DSN URL</Label>
                      <Input
                        placeholder="https://...@sentry.io/..."
                        value={integrations.sentry.dsn}
                        onChange={(e) => updateIntegration('sentry', 'dsn', e.target.value)}
                        className="rounded-xl h-11"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Management */}
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft overflow-hidden">
            <CardHeader className="bg-primary/5 p-8 border-b border-border/40">
              <div className="flex items-center gap-3 text-primary mb-1">
                <Shield className="h-6 w-6" />
                <CardTitle className="text-2xl font-display font-bold">Team & Access</CardTitle>
              </div>
              <CardDescription className="text-base">
                Invite team members and manage their administrative permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</Label>
                  <Input placeholder="E.g. Ana Ramirez" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</Label>
                  <Input placeholder="ana@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2 min-w-[120px]">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Role</Label>
                  <select className="h-11 w-full rounded-xl border border-input bg-background px-4 text-sm font-medium" value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
                    <option value="support">Support</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    className="h-11 px-8 rounded-xl font-bold shadow-brand"
                    disabled={!validInvite}
                    onClick={() => {
                      setTeam((prev) => [{ id: `u_${Math.floor(Math.random() * 1e6)}`, name: name.trim(), email: email.trim(), role }, ...prev]);
                      setName("");
                      setEmail("");
                      setRole("support");
                    }}
                  >
                    Invite
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/40 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-none">
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6 py-4">Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4">Email</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest py-4">Role</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest pr-6 py-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.map((m) => (
                      <TableRow key={m.id} className="border-border/40 group hover:bg-muted/10 transition-colors">
                        <TableCell className="pl-6 py-4 font-bold text-sm">{m.name}</TableCell>
                        <TableCell className="py-4 text-sm text-muted-foreground">{m.email}</TableCell>
                        <TableCell className="py-4">
                          <select
                            className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-bold"
                            value={m.role}
                            onChange={(e) => updateRole(m.id, e.target.value as TeamRole)}
                          >
                            <option value="support">Support</option>
                            <option value="admin">Admin</option>
                          </select>
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-right">
                          <Button variant="ghost" size="sm" className="rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 font-bold" onClick={() => removeMember(m.id)}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Feature Flags Sidebar */}
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-display font-bold">Feature Flags</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <FlagRow
                label="Auto-assign Tickets"
                checked={flags.autoAssignTickets}
                onChange={(b) => setFlags((f) => ({ ...f, autoAssignTickets: b }))}
              />
              <FlagRow
                label="Require Visit Video"
                checked={flags.requireCompletionVideo}
                onChange={(b) => setFlags((f) => ({ ...f, requireCompletionVideo: b }))}
              />
              <FlagRow
                label="Re-service Requests"
                checked={flags.enableReserviceRequests}
                onChange={(b) => setFlags((f) => ({ ...f, enableReserviceRequests: b }))}
              />
              <FlagRow
                label="SMS Reminders"
                checked={flags.smsReminders}
                onChange={(b) => setFlags((f) => ({ ...f, smsReminders: b }))}
              />
            </CardContent>
          </Card>

          {/* Integration Status Sidebar */}
          <Card className="rounded-[32px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader className="p-6">
              <CardTitle className="text-xl font-display font-bold">Other Integrations</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <StatusItem label="Netlify" checked={integrations.netlify.enabled} />
              <StatusItem label="Neon DB" checked={integrations.neon.enabled} />
              <StatusItem label="Notion" checked={integrations.notion.enabled} />
            </CardContent>
          </Card>

          <div className="sticky top-8 space-y-4">
            <Button className="w-full h-14 rounded-2xl font-bold text-lg shadow-brand" onClick={handleSaveAll} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save All Changes"}
            </Button>
            <Button variant="outline" className="w-full h-12 rounded-2xl font-bold" onClick={() => window.location.reload()}>
              Discard Pending
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const IntegrationHeader = ({ icon, title, description, enabled, onToggle }: { icon: React.ReactNode; title: string; description: string; enabled: boolean; onToggle: (b: boolean) => void }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-4">
      <div className="h-10 w-10 rounded-xl bg-background border border-border/40 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={enabled} onCheckedChange={onToggle} />
  </div>
);

const StatusItem = ({ label, checked }: { label: string; checked: boolean }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
    <span className="text-sm font-medium">{label}</span>
    <div className={`h-2 w-2 rounded-full ${checked ? 'bg-green-500' : 'bg-muted'}`} />
  </div>
);

const FlagRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) => {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 p-4 text-sm group hover:border-primary/20 transition-colors cursor-pointer">
      <span className="font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
};

export default Settings;
