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
import { Loader2, Plus, Trash2, Tag, Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface PromoCode {
  id: string; code: string; description: string;
  discount_type: "percent" | "fixed"; discount_value: number;
  max_uses: number | null; used_count: number;
  expires_at: string | null; active: boolean;
  stripe_promotion_code_id: string | null;
  min_order_cents: number;
}

interface Campaign {
  id: string; name: string; description: string;
  start_date: string | null; end_date: string | null; active: boolean;
  promo_codes?: { code: string; discount_type: string; discount_value: number } | null;
}

async function adminFetch(path: string, method = "GET", body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

const Promos = () => {
  const { toast } = useToast();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [codesRes, campaignsRes] = await Promise.all([
        adminFetch("/api/admin/promos/codes"),
        adminFetch("/api/admin/promos/campaigns"),
      ]);
      setCodes(codesRes.codes || []);
      setCampaigns(campaignsRes.campaigns || []);
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleCode = async (code: PromoCode) => {
    try {
      const res = await adminFetch(`/api/admin/promos/codes/${code.id}`, "PATCH", { active: !code.active });
      setCodes((c) => c.map((x) => x.id === code.id ? res.code : x));
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const deleteCode = async (id: string) => {
    try {
      await adminFetch(`/api/admin/promos/codes/${id}`, "DELETE");
      setCodes((c) => c.map((x) => x.id === id ? { ...x, active: false } : x));
      toast({ title: "Promo code deactivated" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const toggleCampaign = async (campaign: Campaign) => {
    try {
      const res = await adminFetch(`/api/admin/promos/campaigns/${campaign.id}`, "PATCH", { active: !campaign.active });
      setCampaigns((c) => c.map((x) => x.id === campaign.id ? res.campaign : x));
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  const discountLabel = (code: PromoCode) =>
    code.discount_type === "percent"
      ? `${code.discount_value}% off`
      : `$${Number(code.discount_value).toFixed(2)} off`;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Marketing"
        title="Promos & Campaigns"
        description="Create discount codes and marketing campaigns. Codes sync to Stripe automatically."
      />

      <Tabs defaultValue="codes">
        <TabsList>
          <TabsTrigger value="codes"><Tag className="mr-2 h-4 w-4" />Promo Codes</TabsTrigger>
          <TabsTrigger value="campaigns"><Megaphone className="mr-2 h-4 w-4" />Campaigns</TabsTrigger>
        </TabsList>

        {/* ── Promo Codes ── */}
        <TabsContent value="codes" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <NewPromoCodeDialog onCreated={(code) => { setCodes((c) => [code, ...c]); toast({ title: "Promo code created", description: `Code: ${code.code}` }); }} />
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Stripe</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No promo codes yet. Run the Phase 6 SQL in Supabase first.</TableCell></TableRow>
                ) : codes.map((code) => (
                  <TableRow key={code.id} className={!code.active ? "opacity-50" : ""}>
                    <TableCell className="font-mono font-bold">{code.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{discountLabel(code)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {code.used_count}{code.max_uses ? ` / ${code.max_uses}` : ""} uses
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      {code.stripe_promotion_code_id
                        ? <Badge variant="outline" className="bg-green-500/10 text-green-700 text-xs">Synced</Badge>
                        : <Badge variant="outline" className="text-xs">Local only</Badge>}
                    </TableCell>
                    <TableCell><Switch checked={code.active} onCheckedChange={() => toggleCode(code)} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCode(code.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Campaigns ── */}
        <TabsContent value="campaigns" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <NewCampaignDialog
              codes={codes.filter((c) => c.active)}
              onCreated={(campaign) => { setCampaigns((c) => [campaign, ...c]); toast({ title: "Campaign created" }); }}
            />
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/95">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Promo Code</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No campaigns yet.</TableCell></TableRow>
                ) : campaigns.map((campaign) => (
                  <TableRow key={campaign.id} className={!campaign.active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      {campaign.promo_codes
                        ? <Badge variant="outline" className="font-mono">{campaign.promo_codes.code}</Badge>
                        : <span className="text-muted-foreground text-sm">None</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : "—"}
                      {" → "}
                      {campaign.end_date ? new Date(campaign.end_date).toLocaleDateString() : "Ongoing"}
                    </TableCell>
                    <TableCell><Switch checked={campaign.active} onCheckedChange={() => toggleCampaign(campaign)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Dialogs ───────────────────────────────────────────────────────────────────

const NewPromoCodeDialog = ({ onCreated }: { onCreated: (code: PromoCode) => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [minOrder, setMinOrder] = useState("");

  const handleSubmit = async () => {
    if (!code.trim() || !discountValue) { toast({ title: "Fill required fields", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/promos/codes", "POST", {
        code: code.trim().toUpperCase(),
        description,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        expires_at: expiresAt || null,
        min_order_cents: minOrder ? Math.round(parseFloat(minOrder) * 100) : 0,
      });
      onCreated(res.code);
      setOpen(false);
      setCode(""); setDescription(""); setDiscountValue(""); setMaxUses(""); setExpiresAt(""); setMinOrder("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-brand"><Plus className="mr-2 h-4 w-4" />New Promo Code</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Promo Code</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Code * (e.g. SUMMER20)</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER20" /></div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Discount Type</Label>
              <select className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}>
                <option value="percent">Percent off (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </div>
            <div><Label>Value *</Label>
              <Input type="number" min="0" step={discountType === "percent" ? "1" : "0.01"} placeholder={discountType === "percent" ? "20" : "10.00"} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max Uses</Label><Input type="number" min="1" placeholder="Unlimited" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
            <div><Label>Expires</Label><input type="date" className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} /></div>
          </div>
          <div><Label>Min Order Amount ($)</Label><Input type="number" min="0" step="0.01" placeholder="0.00 (no minimum)" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!code.trim() || !discountValue || saving}>{saving ? "Creating…" : "Create Code"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NewCampaignDialog = ({ codes, onCreated }: { codes: PromoCode[]; onCreated: (c: Campaign) => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promoCodeId, setPromoCodeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/promos/campaigns", "POST", {
        name: name.trim(), description,
        promo_code_id: promoCodeId || null,
        start_date: startDate || null, end_date: endDate || null,
      });
      onCreated(res.campaign);
      setOpen(false); setName(""); setDescription(""); setPromoCodeId(""); setStartDate(""); setEndDate("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-brand"><Plus className="mr-2 h-4 w-4" />New Campaign</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Campaign Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Sale 2026" /></div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Linked Promo Code</Label>
            <select className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={promoCodeId} onChange={(e) => setPromoCodeId(e.target.value)}>
              <option value="">None</option>
              {codes.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.discount_type === "percent" ? `${c.discount_value}%` : `$${c.discount_value}`} off</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date</Label><input type="date" className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>End Date</Label><input type="date" className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || saving}>{saving ? "Creating…" : "Create Campaign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Promos;
