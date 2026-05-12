import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface ServicePlan {
  id: string;
  name: string;
  description?: string;
  acreage_min: number;
  acreage_max: number;
  cadence_days: number;
  price_cents: number;
  program: string;
  stripe_price_id?: string;
  active: boolean;
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

const Pricing = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/api/admin/plans");
      setPlans(res.plans || []);
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const savePrice = async (plan: ServicePlan) => {
    const cents = Math.round(parseFloat(editPrice) * 100);
    if (isNaN(cents) || cents <= 0) { toast({ title: "Invalid price", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/plans/${plan.id}`, "PATCH", { price_cents: cents });
      setPlans((p) => p.map((x) => x.id === plan.id ? res.plan : x));
      setEditingId(null);
      toast({ title: "Price updated", description: "Stripe price synced." });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deactivatePlan = async (id: string) => {
    try {
      await adminFetch(`/api/admin/plans/${id}`, "DELETE");
      setPlans((p) => p.map((x) => x.id === id ? { ...x, active: false } : x));
      toast({ title: "Plan deactivated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Pricing & Plans"
        title="Service Plans"
        description="Manage subscription plan tiers. Changes sync to Stripe automatically."
      />

      <div className="flex justify-end">
        <NewPlanDialog onCreated={(plan) => { setPlans((p) => [...p, plan]); toast({ title: "Plan created" }); }} />
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center text-muted-foreground">
          No service plans yet. Run the Phase 5 SQL in Supabase to create the <code>service_plans</code> table, then add your first plan.
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card/95">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Acreage</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Price / Visit</TableHead>
                <TableHead>Stripe Price ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id} className={!plan.active ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{plan.acreage_min}–{plan.acreage_max} ac</TableCell>
                  <TableCell>{plan.cadence_days}d</TableCell>
                  <TableCell><Badge variant="outline">{plan.program}</Badge></TableCell>
                  <TableCell>
                    {editingId === plan.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input className="w-24 h-8" type="number" min="0" step="0.01"
                          value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                        <Button size="sm" className="h-8 px-3" onClick={() => savePrice(plan)} disabled={saving}>
                          {saving ? "…" : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditingId(null)}>✕</Button>
                      </div>
                    ) : (
                      <button className="font-semibold text-foreground hover:text-primary transition"
                        onClick={() => { setEditingId(plan.id); setEditPrice((plan.price_cents / 100).toFixed(2)); }}>
                        ${(plan.price_cents / 100).toFixed(2)}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{plan.stripe_price_id || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={plan.active ? "bg-green-500/10 text-green-700" : "bg-muted"}>
                      {plan.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {plan.active && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deactivatePlan(plan.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

const NewPlanDialog = ({ onCreated }: { onCreated: (plan: ServicePlan) => void }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [acreageMin, setAcreageMin] = useState("0");
  const [acreageMax, setAcreageMax] = useState("0.5");
  const [cadence, setCadence] = useState("30");
  const [priceDollars, setPriceDollars] = useState("");
  const [program, setProgram] = useState("subscription");

  const handleSubmit = async () => {
    const price_cents = Math.round(parseFloat(priceDollars) * 100);
    if (!name.trim() || isNaN(price_cents) || price_cents <= 0) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const res = await adminFetch("/api/admin/plans", "POST", {
        name: name.trim(), acreage_min: parseFloat(acreageMin),
        acreage_max: parseFloat(acreageMax), cadence_days: parseInt(cadence, 10),
        price_cents, program,
      });
      onCreated(res.plan);
      setOpen(false);
      setName(""); setPriceDollars(""); setAcreageMin("0"); setAcreageMax("0.5");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shadow-brand"><Plus className="mr-2 h-4 w-4" />New Plan</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create Service Plan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Plan Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard — Up to ½ Acre" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Acreage Min</Label><Input type="number" min="0" step="0.25" value={acreageMin} onChange={(e) => setAcreageMin(e.target.value)} /></div>
            <div><Label>Acreage Max</Label><Input type="number" min="0" step="0.25" value={acreageMax} onChange={(e) => setAcreageMax(e.target.value)} /></div>
          </div>
          <div><Label>Cadence (days)</Label>
            <select className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={cadence} onChange={(e) => setCadence(e.target.value)}>
              <option value="14">14 days (bi-weekly)</option>
              <option value="21">21 days (3-week)</option>
              <option value="30">30 days (monthly)</option>
              <option value="42">42 days (6-week)</option>
              <option value="60">60 days (bi-monthly)</option>
              <option value="90">90 days (quarterly)</option>
              <option value="365">365 days (annual)</option>
            </select>
          </div>
          <div><Label>Program</Label>
            <select className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={program} onChange={(e) => setProgram(e.target.value)}>
              <option value="subscription">Subscription</option>
              <option value="annual">Annual</option>
              <option value="one_time">One-time</option>
            </select>
          </div>
          <div><Label>Price per Visit (USD) *</Label><Input type="number" min="0" step="0.01" placeholder="89.00" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !priceDollars || saving}>{saving ? "Creating…" : "Create Plan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Pricing;
