import { useState, useEffect, useCallback } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { adminApi } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, FilePlus, CheckCircle2, Clock, AlertTriangle, Eye, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<string, string> = {
  employment_agreement: "Employment Agreement",
  safety: "Safety Training",
  chemical_handling: "Chemical/Pesticide Handling",
  vehicle_policy: "Vehicle & Driving Policy",
  gps_consent: "GPS/Location Consent",
  equipment_policy: "Equipment Policy",
  media_policy: "Photo/Video Policy",
  workers_comp: "Workers' Compensation Notice",
  background_check: "Background Check Authorization",
  arbitration: "Arbitration Agreement",
  nda: "Non-Disclosure Agreement",
  handbook: "Handbook Acknowledgment",
  contractor_agreement: "Contractor Agreement",
  custom: "Custom",
};

const WORKER_TYPE_LABELS: Record<string, string> = {
  employee: "W2 Employee",
  contractor: "Contractor",
  vendor: "Vendor",
  test: "Test Account",
};

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  approved: "bg-emerald-100 text-emerald-700",
};

const LegalCompliance = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"forms" | "employees" | "reviews">("forms");
  const [forms, setForms] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAddVersion, setShowAddVersion] = useState<any | null>(null);
  const [selectedForm, setSelectedForm] = useState<any | null>(null);

  const [newForm, setNewForm] = useState({
    name: "", description: "", category: "custom", form_type: "acknowledgment",
    required_for: [] as string[], required_roles: [] as string[],
    is_required: true, blocks_assignments: false,
  });
  const [isCreating, setIsCreating] = useState(false);

  const [newVersion, setNewVersion] = useState({
    title: "", body_text: "", acknowledgment_statement: "", document_url: "", effective_date: "",
  });
  const [isAddingVersion, setIsAddingVersion] = useState(false);

  const loadForms = useCallback(async () => {
    try {
      const data = await adminApi("/api/admin/onboarding/forms");
      setForms(data.forms || []);
    } catch (err: any) {
      toast({ title: "Failed to load forms", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await adminApi("/api/admin/onboarding/employees");
      setEmployees(data.employees || []);
    } catch (err: any) {
      toast({ title: "Failed to load employees", description: err.message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([loadForms(), loadEmployees()]);
      setIsLoading(false);
    };
    load();
  }, [loadForms, loadEmployees]);

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name.trim()) return;
    setIsCreating(true);
    try {
      await adminApi("/api/admin/onboarding/forms", "POST", newForm);
      toast({ title: "Form created." });
      setShowCreateForm(false);
      setNewForm({ name: "", description: "", category: "custom", form_type: "acknowledgment", required_for: [], required_roles: [], is_required: true, blocks_assignments: false });
      loadForms();
    } catch (err: any) {
      toast({ title: "Failed to create form", description: err.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersion.title.trim() || !newVersion.acknowledgment_statement.trim()) {
      toast({ title: "Title and acknowledgment statement are required.", variant: "destructive" });
      return;
    }
    setIsAddingVersion(true);
    try {
      await adminApi(`/api/admin/onboarding/forms/${showAddVersion.id}/versions`, "POST", newVersion);
      toast({ title: "Version added." });
      setShowAddVersion(null);
      setNewVersion({ title: "", body_text: "", acknowledgment_statement: "", document_url: "", effective_date: "" });
      loadForms();
      if (selectedForm?.id === showAddVersion.id) {
        const data = await adminApi(`/api/admin/onboarding/forms/${showAddVersion.id}`);
        setSelectedForm(data);
      }
    } catch (err: any) {
      toast({ title: "Failed to add version", description: err.message, variant: "destructive" });
    } finally {
      setIsAddingVersion(false);
    }
  };

  const handleActivateVersion = async (formId: string, versionId: string) => {
    try {
      await adminApi(`/api/admin/onboarding/forms/${formId}/activate-version`, "POST", { version_id: versionId });
      toast({ title: "Version activated." });
      loadForms();
      if (selectedForm?.id === formId) {
        const data = await adminApi(`/api/admin/onboarding/forms/${formId}`);
        setSelectedForm(data);
      }
    } catch (err: any) {
      toast({ title: "Failed to activate version", description: err.message, variant: "destructive" });
    }
  };

  const handleDeactivateForm = async (formId: string) => {
    if (!window.confirm("Deactivate this form? It will no longer be auto-assigned to new employees.")) return;
    try {
      await adminApi(`/api/admin/onboarding/forms/${formId}/deactivate`, "POST");
      toast({ title: "Form deactivated." });
      loadForms();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const openFormDetail = async (form: any) => {
    const data = await adminApi(`/api/admin/onboarding/forms/${form.id}`);
    setSelectedForm(data);
  };

  const toggleWorkerType = (type: string) => {
    setNewForm((p) => ({
      ...p,
      required_for: p.required_for.includes(type)
        ? p.required_for.filter((t) => t !== type)
        : [...p.required_for, type],
    }));
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Workforce"
        title="Legal & Compliance"
        description="Manage onboarding documents, acknowledgments, and compliance tracking."
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <strong>Legal Notice:</strong> This system supports document management and acknowledgment tracking.
        All legal text, disclosures, and agreements require attorney review before use with real employees.
        Do not present any document here as legally sufficient without independent legal review.
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/60">
        {(["forms", "employees", "reviews"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "forms" ? "Document Forms" : t === "employees" ? "Employee Progress" : "Document Review"}
          </button>
        ))}
      </div>

      {/* ── Forms Tab ─────────────────────────────────────────────────────────── */}
      {tab === "forms" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">{forms.length} form{forms.length !== 1 ? "s" : ""}</p>
              <Button onClick={() => setShowCreateForm(true)} className="rounded-xl">
                <Plus className="h-4 w-4 mr-2" /> Create Form
              </Button>
            </div>
            {forms.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 p-12 text-center">
                <FilePlus className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No onboarding forms yet.</p>
                <p className="text-xs text-muted-foreground">Create forms for safety acknowledgments, GPS consent, handbook acknowledgment, and more.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>For</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forms.map((f) => (
                      <TableRow key={f.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openFormDetail(f)}>
                        <TableCell className="font-medium">
                          {f.name}
                          {f.blocks_assignments && (
                            <Badge className="ml-2 text-[10px] bg-red-100 text-red-700 border-red-200">Blocking</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{CATEGORY_LABELS[f.category] ?? f.category}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(f.required_for || []).map((wt: string) => (
                              <Badge key={wt} variant="outline" className="text-[10px] capitalize">{WORKER_TYPE_LABELS[wt] ?? wt}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {f.current_version ? `v${f.current_version.version_number}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={f.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500"}>
                            {f.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={() => setShowAddVersion(f)}>
                              <FilePlus className="h-3 w-3 mr-1" /> Add Version
                            </Button>
                            {f.is_active && (
                              <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs text-destructive border-destructive/30" onClick={() => handleDeactivateForm(f.id)}>
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Form detail panel */}
          {selectedForm && (
            <Card className="rounded-2xl border-border/60 bg-card/95 self-start">
              <CardHeader>
                <CardTitle className="text-base">{selectedForm.form?.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[selectedForm.form?.category] ?? selectedForm.form?.category}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">{selectedForm.form?.description || "No description."}</p>
                <div>
                  <p className="text-xs font-semibold mb-2">Versions ({(selectedForm.versions || []).length})</p>
                  <div className="space-y-2">
                    {(selectedForm.versions || []).map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between rounded-xl border border-border/60 p-3 text-sm">
                        <div>
                          <p className="font-medium">v{v.version_number} — {v.title}</p>
                          <p className="text-xs text-muted-foreground">{new Date(v.effective_date).toLocaleDateString()}</p>
                        </div>
                        {v.is_current ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">Current</Badge>
                        ) : (
                          <Button size="sm" variant="outline" className="h-6 text-xs rounded-lg" onClick={() => handleActivateVersion(selectedForm.form.id, v.id)}>
                            Activate
                          </Button>
                        )}
                      </div>
                    ))}
                    {(selectedForm.versions || []).length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No versions yet. Add a version to make this form available.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Employee Progress Tab ──────────────────────────────────────────────── */}
      {tab === "employees" && (
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Onboarding Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Approved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No active employees.</TableCell></TableRow>
              ) : (
                employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{emp.worker_type ?? "employee"}</Badge></TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[emp.onboarding_status] ?? "bg-gray-100 text-gray-600"}`}>
                        {emp.onboarding_status?.replace("_", " ") ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {emp.forms_completed}/{emp.forms_total} forms
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {emp.onboarding_approved_at ? new Date(emp.onboarding_approved_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Document Review Tab ───────────────────────────────────────────────── */}
      {tab === "reviews" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Documents uploaded by employees that require admin review appear here.
            Navigate to an employee's onboarding detail to review individual uploads.
          </p>
          <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <Eye className="h-5 w-5 shrink-0" />
            <p>Document review is available per-employee. Go to Employee Progress tab, select an employee, and view their uploaded documents.</p>
          </div>
        </div>
      )}

      {/* ── Create Form Dialog ───────────────────────────────────────────────── */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="rounded-[28px] sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Create Onboarding Form</DialogTitle>
            <DialogDescription>Define a new form. Add content versions after creating.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateForm} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="form-name">Form Name *</Label>
              <Input id="form-name" value={newForm.name} onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))} placeholder="GPS/Location Tracking Consent" className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-desc">Description</Label>
              <Input id="form-desc" value={newForm.description} onChange={(e) => setNewForm((p) => ({ ...p, description: e.target.value }))} placeholder="Discloses GPS tracking during active assignments" className="rounded-xl" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newForm.category} onValueChange={(v) => setNewForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Form Type</Label>
                <Select value={newForm.form_type} onValueChange={(v) => setNewForm((p) => ({ ...p, form_type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acknowledgment">Acknowledgment (text + checkbox)</SelectItem>
                    <SelectItem value="pdf_view">PDF View + Confirmation</SelectItem>
                    <SelectItem value="upload_required">Document Upload Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Required For (worker types)</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(WORKER_TYPE_LABELS).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => toggleWorkerType(k)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${newForm.required_for.includes(k) ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:bg-muted/50"}`}
                  >{v}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded" checked={newForm.is_required} onChange={(e) => setNewForm((p) => ({ ...p, is_required: e.target.checked }))} />
                Required (not optional)
              </label>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded" checked={newForm.blocks_assignments} onChange={(e) => setNewForm((p) => ({ ...p, blocks_assignments: e.target.checked }))} />
                Block assignment access until complete
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreating} className="rounded-xl">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Form
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Version Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!showAddVersion} onOpenChange={(open) => { if (!open) setShowAddVersion(null); }}>
        <DialogContent className="rounded-[28px] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Add Version</DialogTitle>
            <DialogDescription>Add a new version to "{showAddVersion?.name}". Old versions are preserved for audit.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddVersion} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="v-title">Version Title *</Label>
              <Input id="v-title" value={newVersion.title} onChange={(e) => setNewVersion((p) => ({ ...p, title: e.target.value }))} placeholder="GPS Consent — June 2026" className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-body">Body Text (what employee reads)</Label>
              <textarea
                id="v-body"
                rows={5}
                value={newVersion.body_text}
                onChange={(e) => setNewVersion((p) => ({ ...p, body_text: e.target.value }))}
                placeholder="[DRAFT — requires attorney review] Your location will only be captured during active work assignments..."
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-ack">Acknowledgment Statement * (the sentence employee confirms)</Label>
              <Input id="v-ack" value={newVersion.acknowledgment_statement} onChange={(e) => setNewVersion((p) => ({ ...p, acknowledgment_statement: e.target.value }))}
                placeholder="I have read and understand the GPS/Location Tracking Disclosure." className="rounded-xl" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="v-url">Document URL (optional PDF link)</Label>
                <Input id="v-url" value={newVersion.document_url} onChange={(e) => setNewVersion((p) => ({ ...p, document_url: e.target.value }))} placeholder="https://..." className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-date">Effective Date</Label>
                <Input id="v-date" type="date" value={newVersion.effective_date} onChange={(e) => setNewVersion((p) => ({ ...p, effective_date: e.target.value }))} className="rounded-xl" />
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
              All text entered here requires attorney review before this form is assigned to real employees.
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowAddVersion(null)}>Cancel</Button>
              <Button type="submit" disabled={isAddingVersion} className="rounded-xl">
                {isAddingVersion ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus className="h-4 w-4 mr-2" />}
                Save Version
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LegalCompliance;
