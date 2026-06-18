import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Gift, Users2, Sparkles, Settings2, Check, X } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

interface ReferralCode {
  id: string;
  code: string;
  owner_type: "customer" | "partner";
  partner_name: string | null;
  partner_type: string | null;
  active: boolean;
  created_at: string;
}

interface Referral {
  id: string;
  referral_code_id: string;
  lead_id: string | null;
  status: "pending" | "conversion_candidate" | "converted" | "rewarded" | "invalid";
  conversion_value_cents: number | null;
  created_at: string;
}

interface RewardSettings {
  enabled: boolean;
  customer_reward_type: string;
  customer_reward_amount_cents: number | null;
  partner_reward_type: string;
  partner_reward_amount_cents: number | null;
  auto_create_rewards: boolean;
  require_admin_approval: boolean;
}

const PARTNER_TYPES = ["hoa", "property_manager", "landscaper", "realtor", "pest_control", "other"];
const REFERRAL_STATUSES = ["pending", "conversion_candidate", "converted", "rewarded", "invalid"] as const;
const REWARD_TYPES = ["account_credit", "service_credit", "free_service", "manual_reward"];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  conversion_candidate: "bg-violet-100 text-violet-800",
  converted: "bg-blue-100 text-blue-800",
  rewarded: "bg-green-100 text-green-800",
  invalid: "bg-gray-100 text-gray-600",
};

const Referrals = () => {
  const { toast } = useToast();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardSettings, setRewardSettings] = useState<RewardSettings | null>(null);
  const [savingRewardSettings, setSavingRewardSettings] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [codesRes, referralsRes, rewardSettingsRes] = await Promise.all([
        adminApi("/api/admin/referrals/codes"),
        adminApi("/api/admin/referrals"),
        adminApi("/api/admin/referrals/reward-settings"),
      ]);
      setCodes(codesRes.codes || []);
      setReferrals(referralsRes.referrals || []);
      setRewardSettings(rewardSettingsRes.settings || null);
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runDetection = async () => {
    setDetecting(true);
    try {
      const res = await adminApi("/api/admin/referrals/detect-conversions", "POST");
      toast({ title: "Detection complete", description: `Checked ${res.checked}, flagged ${res.flagged} as conversion candidates.` });
      const referralsRes = await adminApi("/api/admin/referrals");
      setReferrals(referralsRes.referrals || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDetecting(false);
    }
  };

  const approveConversion = async (referral: Referral) => {
    try {
      const res = await adminApi(`/api/admin/referrals/${referral.id}/approve-conversion`, "POST", {});
      setReferrals((r) => r.map((x) => (x.id === referral.id ? res.referral : x)));
      toast({
        title: "Conversion approved",
        description: res.reward ? "A pending reward was created — approve/issue it from the Rewards tab." : "Referral marked converted.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const rejectConversion = async (referral: Referral) => {
    try {
      const res = await adminApi(`/api/admin/referrals/${referral.id}/reject-conversion`, "POST", {});
      setReferrals((r) => r.map((x) => (x.id === referral.id ? res.referral : x)));
      toast({ title: "Conversion rejected" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const saveRewardSettings = async () => {
    if (!rewardSettings) return;
    setSavingRewardSettings(true);
    try {
      const res = await adminApi("/api/admin/referrals/reward-settings", "PATCH", rewardSettings);
      setRewardSettings(res.settings);
      toast({ title: "Reward settings saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingRewardSettings(false);
    }
  };

  const toggleCode = async (code: ReferralCode) => {
    try {
      const res = await adminApi(`/api/admin/referrals/codes/${code.id}`, "PATCH", { active: !code.active });
      setCodes((c) => c.map((x) => (x.id === code.id ? res.code : x)));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const updateReferralStatus = async (referral: Referral, status: string) => {
    try {
      const res = await adminApi(`/api/admin/referrals/${referral.id}`, "PATCH", { status });
      setReferrals((r) => r.map((x) => (x.id === referral.id ? res.referral : x)));
      toast({ title: `Referral marked ${status}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const codeLookup: Record<string, ReferralCode> = {};
  codes.forEach((c) => { codeLookup[c.id] = c; });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Growth"
        title="Referrals"
        description="Customer and partner referral codes, attribution, and reward tracking."
      />

      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals"><Users2 className="mr-2 h-4 w-4" />Referrals</TabsTrigger>
          <TabsTrigger value="conversions"><Sparkles className="mr-2 h-4 w-4" />Conversion Review</TabsTrigger>
          <TabsTrigger value="codes"><Gift className="mr-2 h-4 w-4" />Codes</TabsTrigger>
          <TabsTrigger value="reward-settings"><Settings2 className="mr-2 h-4 w-4" />Reward Settings</TabsTrigger>
        </TabsList>

        {/* ── Referrals ── */}
        <TabsContent value="referrals" className="mt-4 space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conversion Value</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Update Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No referrals yet.</TableCell></TableRow>
                ) : referrals.map((r) => {
                  const code = codeLookup[r.referral_code_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-bold">{code?.code ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {code?.owner_type === "partner" ? code.partner_name : "Customer"}
                      </TableCell>
                      <TableCell><Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.conversion_value_cents != null ? `$${(r.conversion_value_cents / 100).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <select
                          value={r.status}
                          onChange={(e) => updateReferralStatus(r, e.target.value)}
                          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                        >
                          {REFERRAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Codes ── */}
        <TabsContent value="codes" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <NewPartnerCodeDialog onCreated={(code) => { setCodes((c) => [code, ...c]); toast({ title: "Partner code created", description: `Code: ${code.code}` }); }} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Owner Type</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No referral codes yet.</TableCell></TableRow>
                ) : codes.map((code) => (
                  <TableRow key={code.id} className={!code.active ? "opacity-50" : ""}>
                    <TableCell className="font-mono font-bold">{code.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{code.owner_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {code.owner_type === "partner" ? `${code.partner_name} (${code.partner_type})` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(code.created_at).toLocaleDateString()}</TableCell>
                    <TableCell><Switch checked={code.active} onCheckedChange={() => toggleCode(code)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Conversion Review ── */}
        <TabsContent value="conversions" className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
            <div>
              <p className="text-sm font-semibold">Detect conversion candidates</p>
              <p className="text-xs text-muted-foreground">
                Scans pending referrals for leads that now have a subscription or converted customer. Never auto-converts or rewards — flags for your review only.
              </p>
            </div>
            <Button onClick={runDetection} disabled={detecting} className="rounded-xl shadow-brand">
              {detecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Detect Now
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.filter((r) => r.status === "conversion_candidate").length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No conversion candidates pending review.</TableCell></TableRow>
                ) : referrals.filter((r) => r.status === "conversion_candidate").map((r) => {
                  const code = codeLookup[r.referral_code_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-bold">{code?.code ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {code?.owner_type === "partner" ? code.partner_name : "Customer"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" className="rounded-lg border-green-300 text-green-700" onClick={() => approveConversion(r)}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-lg border-red-300 text-red-700" onClick={() => rejectConversion(r)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Reward Settings ── */}
        <TabsContent value="reward-settings" className="mt-4 space-y-4">
          {!rewardSettings ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-5 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Reward automation enabled</Label>
                  <p className="text-xs text-muted-foreground">Master switch — off means rewards are always created manually from the Rewards tab.</p>
                </div>
                <Switch
                  checked={rewardSettings.enabled}
                  onCheckedChange={(checked) => setRewardSettings({ ...rewardSettings, enabled: checked })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer reward type</Label>
                  <select
                    className="h-9 w-full rounded-xl border border-input bg-background px-2 text-sm"
                    value={rewardSettings.customer_reward_type}
                    onChange={(e) => setRewardSettings({ ...rewardSettings, customer_reward_type: e.target.value })}
                  >
                    {REWARD_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer reward amount ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={rewardSettings.customer_reward_amount_cents != null ? rewardSettings.customer_reward_amount_cents / 100 : ""}
                    onChange={(e) => setRewardSettings({ ...rewardSettings, customer_reward_amount_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : null })}
                    className="rounded-xl h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Partner reward type</Label>
                  <select
                    className="h-9 w-full rounded-xl border border-input bg-background px-2 text-sm"
                    value={rewardSettings.partner_reward_type}
                    onChange={(e) => setRewardSettings({ ...rewardSettings, partner_reward_type: e.target.value })}
                  >
                    {REWARD_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Partner reward amount ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={rewardSettings.partner_reward_amount_cents != null ? rewardSettings.partner_reward_amount_cents / 100 : ""}
                    onChange={(e) => setRewardSettings({ ...rewardSettings, partner_reward_amount_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : null })}
                    className="rounded-xl h-9"
                  />
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto-create pending reward on approval</span>
                  <Switch
                    checked={rewardSettings.auto_create_rewards}
                    onCheckedChange={(checked) => setRewardSettings({ ...rewardSettings, auto_create_rewards: checked })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Only ever creates a PENDING reward row when you click Approve on a conversion candidate — never issues a reward, applies a credit, or touches Stripe. Issuing remains a separate manual step on the Rewards tab.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Require admin approval to issue</span>
                  <Switch
                    checked={rewardSettings.require_admin_approval}
                    onCheckedChange={(checked) => setRewardSettings({ ...rewardSettings, require_admin_approval: checked })}
                  />
                </div>
              </div>

              <Button onClick={saveRewardSettings} disabled={savingRewardSettings} className="rounded-xl shadow-brand">
                {savingRewardSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Reward Settings
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const NewPartnerCodeDialog = ({ onCreated }: { onCreated: (code: ReferralCode) => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [partnerType, setPartnerType] = useState("hoa");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [code, setCode] = useState("");

  const handleSubmit = async () => {
    if (!partnerName.trim()) { toast({ title: "Partner name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await adminApi("/api/admin/referrals/codes", "POST", {
        partnerName: partnerName.trim(),
        partnerType,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        code: code || undefined,
      });
      onCreated(res.code);
      setOpen(false);
      setPartnerName(""); setContactEmail(""); setContactPhone(""); setCode("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-brand"><Plus className="mr-2 h-4 w-4" />New Partner Code</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Partner Referral Code</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Partner Name *</Label><Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Sunvalley HOA" /></div>
          <div>
            <Label>Partner Type</Label>
            <select className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={partnerType} onChange={(e) => setPartnerType(e.target.value)}>
              {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><Label>Contact Email</Label><Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
          <div><Label>Contact Phone</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
          <div><Label>Custom Code (optional — auto-generated if blank)</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUNVALLEY-HOA" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="shadow-brand">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Referrals;
