import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, PowerOff, Power, Eye, Megaphone, Loader2, X } from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface Popup {
  id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  secondary_label: string | null;
  secondary_url: string | null;
  audience: string;
  page_target: string;
  custom_path: string | null;
  start_at: string | null;
  end_at: string | null;
  active: boolean;
  frequency: string;
  priority: number;
  created_at: string;
}

type PopupStatus = "active" | "inactive" | "scheduled" | "expired";

interface FormState {
  title: string; subtitle: string; body: string; image_url: string;
  cta_label: string; cta_url: string; secondary_label: string; secondary_url: string;
  audience: string; page_target: string; custom_path: string;
  start_at: string; end_at: string; active: boolean; frequency: string; priority: string;
}

const EMPTY_FORM: FormState = {
  title: "", subtitle: "", body: "", image_url: "",
  cta_label: "", cta_url: "", secondary_label: "", secondary_url: "",
  audience: "all", page_target: "all", custom_path: "",
  start_at: "", end_at: "", active: true, frequency: "once_per_session", priority: "10",
};

function rowToForm(p: Popup): FormState {
  return {
    title: p.title, subtitle: p.subtitle ?? "", body: p.body ?? "", image_url: p.image_url ?? "",
    cta_label: p.cta_label ?? "", cta_url: p.cta_url ?? "",
    secondary_label: p.secondary_label ?? "", secondary_url: p.secondary_url ?? "",
    audience: p.audience, page_target: p.page_target, custom_path: p.custom_path ?? "",
    start_at: p.start_at ? p.start_at.slice(0, 16) : "",
    end_at:   p.end_at   ? p.end_at.slice(0, 16)   : "",
    active: p.active, frequency: p.frequency, priority: String(p.priority),
  };
}

function validateForm(f: FormState): string[] {
  const errs: string[] = [];
  if (!f.title.trim()) errs.push("Title is required.");
  if (!f.body.trim() && !f.image_url.trim()) errs.push("Body text or image URL is required.");
  if (f.cta_url && !/^(https?:\/\/|\/)/.test(f.cta_url)) errs.push("CTA URL must start with / or https://.");
  if (f.secondary_url && !/^(https?:\/\/|\/)/.test(f.secondary_url)) errs.push("Secondary URL must start with / or https://.");
  if (f.cta_url && !f.cta_label.trim()) errs.push("CTA label is required when CTA URL is set.");
  if (f.secondary_url && !f.secondary_label.trim()) errs.push("Secondary label is required when secondary URL is set.");
  if (f.page_target === "custom" && !f.custom_path.trim()) errs.push("Custom path is required for custom page target.");
  if (f.start_at && f.end_at && new Date(f.end_at) <= new Date(f.start_at)) errs.push("End date must be after start date.");
  const p = Number(f.priority);
  if (isNaN(p) || p < 0) errs.push("Priority must be a non-negative number.");
  return errs;
}

function getPopupStatus(p: Popup): PopupStatus {
  if (!p.active) return "inactive";
  const now = new Date();
  if (p.end_at && isBefore(parseISO(p.end_at), now)) return "expired";
  if (p.start_at && isAfter(parseISO(p.start_at), now)) return "scheduled";
  return "active";
}

function StatusBadge({ status }: { status: PopupStatus }) {
  const map: Record<PopupStatus, { label: string; class: string }> = {
    active:    { label: "Active",    class: "bg-green-100 text-green-800 border-green-200" },
    inactive:  { label: "Inactive",  class: "bg-gray-100 text-gray-600 border-gray-200" },
    scheduled: { label: "Scheduled", class: "bg-blue-100 text-blue-700 border-blue-200" },
    expired:   { label: "Expired",   class: "bg-orange-100 text-orange-700 border-orange-200" },
  };
  const { label, class: cls } = map[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

const AdminPromotionsManagement = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [previewPopup, setPreviewPopup] = useState<Popup | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ popups: Popup[] }>({
    queryKey: ["admin-promotional-popups"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/admin/promotional-popups", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load popups");
      return res.json();
    },
  });

  const popups = data?.popups ?? [];

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<FormState> & { id?: string }) => {
      const { id, ...body } = payload;
      const token = await getToken();
      const url = id ? `/api/admin/promotional-popups/${id}` : "/api/admin/promotional-popups";
      const res = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...body, priority: Number(body.priority) || 10 }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Save failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-promotional-popups"] });
      setDialogOpen(false);
      toast({ title: editingId ? "Popup updated" : "Popup created" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const handleOpen = (popup?: Popup) => {
    setErrors([]);
    if (popup) { setEditingId(popup.id); setForm(rowToForm(popup)); }
    else { setEditingId(null); setForm(EMPTY_FORM); }
    setDialogOpen(true);
  };

  const handleSave = () => {
    const errs = validateForm(form);
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    saveMutation.mutate(editingId ? { ...form, id: editingId } : form);
  };

  const handleToggle = async (popup: Popup) => {
    setToggling(popup.id);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/promotional-popups/${popup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !popup.active }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      qc.invalidateQueries({ queryKey: ["admin-promotional-popups"] });
      toast({ title: popup.active ? "Popup deactivated" : "Popup activated" });
    } catch (e: any) {
      toast({ title: "Toggle failed", description: e.message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const setField = (key: keyof FormState, value: any) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold font-display">Promotional Popups</h1>
          </div>
          <p className="text-sm text-muted-foreground">Create and manage customer-facing promotional popups.</p>
        </div>
        <Button onClick={() => handleOpen()} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> New Popup
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: popups.length },
          { label: "Active", value: popups.filter(p => getPopupStatus(p) === "active").length },
          { label: "Scheduled", value: popups.filter(p => getPopupStatus(p) === "scheduled").length },
          { label: "Inactive/Expired", value: popups.filter(p => ["inactive","expired"].includes(getPopupStatus(p))).length },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/60 p-4 text-center bg-card">
            <p className="text-2xl font-bold text-primary">{s.value}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
      ) : popups.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center gap-3">
          <Megaphone className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">No promotional popups yet.</p>
          <Button variant="outline" onClick={() => handleOpen()}>Create your first popup</Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase font-bold tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Audience / Target</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Schedule</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {popups.map(p => {
                const status = getPopupStatus(p);
                return (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold truncate max-w-[180px]">{p.title}</p>
                      {p.subtitle && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.subtitle}</p>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={status} /></td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      <span className="capitalize">{p.audience}</span> · <span className="capitalize">{p.page_target}{p.custom_path ? `: ${p.custom_path}` : ""}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {p.start_at ? format(parseISO(p.start_at), "MMM d") : "—"} → {p.end_at ? format(parseISO(p.end_at), "MMM d") : "No end"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" title="Preview" onClick={() => setPreviewPopup(p)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" title="Edit" onClick={() => handleOpen(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" title={p.active ? "Deactivate" : "Activate"} onClick={() => handleToggle(p)} disabled={toggling === p.id}>
                          {toggling === p.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : p.active ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-green-600" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[24px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Popup" : "New Promotional Popup"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {errors.length > 0 && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive space-y-1">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            {/* Content */}
            <div className="grid gap-2">
              <Label htmlFor="pp-title">Title <span className="text-destructive">*</span></Label>
              <Input id="pp-title" value={form.title} onChange={e => setField("title", e.target.value)} placeholder="Summer Mosquito Sale" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pp-subtitle">Subtitle</Label>
              <Input id="pp-subtitle" value={form.subtitle} onChange={e => setField("subtitle", e.target.value)} placeholder="Limited time offer" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pp-body">Body Text</Label>
              <Textarea id="pp-body" value={form.body} onChange={e => setField("body", e.target.value)} placeholder="Get 20% off your first recurring service this month only." className="resize-none" rows={3} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pp-image">Image URL</Label>
              <Input id="pp-image" value={form.image_url} onChange={e => setField("image_url", e.target.value)} placeholder="https://..." />
            </div>

            {/* CTAs */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pp-cta-label">CTA Label</Label>
                <Input id="pp-cta-label" value={form.cta_label} onChange={e => setField("cta_label", e.target.value)} placeholder="Get My Quote" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pp-cta-url">CTA URL</Label>
                <Input id="pp-cta-url" value={form.cta_url} onChange={e => setField("cta_url", e.target.value)} placeholder="/pricing or https://..." />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pp-sec-label">Secondary Label</Label>
                <Input id="pp-sec-label" value={form.secondary_label} onChange={e => setField("secondary_label", e.target.value)} placeholder="Learn More" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pp-sec-url">Secondary URL</Label>
                <Input id="pp-sec-url" value={form.secondary_url} onChange={e => setField("secondary_url", e.target.value)} placeholder="/our-story or https://..." />
              </div>
            </div>

            {/* Targeting */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Audience</Label>
                <Select value={form.audience} onValueChange={v => setField("audience", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All visitors</SelectItem>
                    <SelectItem value="public">Public (logged out only)</SelectItem>
                    <SelectItem value="logged_in">Logged in only</SelectItem>
                    <SelectItem value="customers">Customers only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Page Target</Label>
                <Select value={form.page_target} onValueChange={v => setField("page_target", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All pages</SelectItem>
                    <SelectItem value="home">Homepage only</SelectItem>
                    <SelectItem value="pricing">Pricing page</SelectItem>
                    <SelectItem value="services">Services page</SelectItem>
                    <SelectItem value="marketplace">Marketplace</SelectItem>
                    <SelectItem value="dashboard">Customer dashboard</SelectItem>
                    <SelectItem value="custom">Custom path</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.page_target === "custom" && (
              <div className="grid gap-2">
                <Label htmlFor="pp-custom-path">Custom Path</Label>
                <Input id="pp-custom-path" value={form.custom_path} onChange={e => setField("custom_path", e.target.value)} placeholder="/specific-page" />
              </div>
            )}

            {/* Schedule */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pp-start">Start Date/Time</Label>
                <Input id="pp-start" type="datetime-local" value={form.start_at} onChange={e => setField("start_at", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pp-end">End Date/Time</Label>
                <Input id="pp-end" type="datetime-local" value={form.end_at} onChange={e => setField("end_at", e.target.value)} />
              </div>
            </div>

            {/* Frequency + Priority + Active */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setField("frequency", v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once_per_session">Once per session</SelectItem>
                    <SelectItem value="once_per_day">Once per day</SelectItem>
                    <SelectItem value="always">Always</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pp-priority">Priority</Label>
                <Input id="pp-priority" type="number" min={0} value={form.priority} onChange={e => setField("priority", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Active</Label>
                <div className="flex items-center h-10">
                  <Switch checked={form.active} onCheckedChange={v => setField("active", v)} />
                  <span className="ml-2 text-sm text-muted-foreground">{form.active ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? "Save Changes" : "Create Popup")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewPopup} onOpenChange={open => { if (!open) setPreviewPopup(null); }}>
        <DialogContent className="max-w-md rounded-[24px] p-0 overflow-hidden">
          <DialogHeader className="sr-only"><DialogTitle>Popup Preview</DialogTitle></DialogHeader>
          {previewPopup && (
            <div className="relative">
              {previewPopup.image_url && (
                <img src={previewPopup.image_url} alt="" className="w-full h-40 object-cover" />
              )}
              <button className="absolute top-3 right-3 h-7 w-7 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50" onClick={() => setPreviewPopup(null)}>
                <X className="h-4 w-4" />
              </button>
              <div className="p-6 space-y-3">
                <h2 className="text-xl font-bold font-display">{previewPopup.title}</h2>
                {previewPopup.subtitle && <p className="text-sm text-primary font-semibold">{previewPopup.subtitle}</p>}
                {previewPopup.body && <p className="text-sm text-muted-foreground leading-relaxed">{previewPopup.body}</p>}
                {(previewPopup.cta_label || previewPopup.secondary_label) && (
                  <div className="flex gap-2 pt-1">
                    {previewPopup.cta_label && (
                      <span className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{previewPopup.cta_label}</span>
                    )}
                    {previewPopup.secondary_label && (
                      <span className="inline-flex items-center justify-center rounded-full border border-border/60 px-4 py-2 text-sm font-semibold text-foreground">{previewPopup.secondary_label}</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/60 pt-1">Preview only — dismiss/link behavior requires live popup</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPromotionsManagement;
