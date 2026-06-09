import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, AlertTriangle, ChevronRight, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useEmployee } from "@/hooks/employee/useEmployee";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface Assignment {
  id: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
  due_date: string | null;
  form_id: string;
  form_version_id: string;
  onboarding_forms: {
    id: string;
    name: string;
    category: string;
    form_type: string;
    is_required: boolean;
    blocks_assignments: boolean;
    description: string | null;
  };
  onboarding_form_versions: {
    id: string;
    title: string;
    version_number: number;
    body_text: string | null;
    acknowledgment_statement: string;
    document_url: string | null;
    document_filename: string | null;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  gps_consent: "GPS/Location Consent",
  safety: "Safety Training",
  chemical_handling: "Chemical/Pesticide Handling",
  vehicle_policy: "Vehicle & Driving Policy",
  employment_agreement: "Employment Agreement",
  workers_comp: "Workers' Compensation",
  handbook: "Handbook Acknowledgment",
  equipment_policy: "Equipment Policy",
  media_policy: "Photo/Video Policy",
  custom: "General",
};

const Onboarding = () => {
  const { data: employee } = useEmployee();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [progress, setProgress] = useState({ total: 0, completed: 0, percent: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activeForm, setActiveForm] = useState<Assignment | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const loadOnboarding = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/employee/onboarding", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
        setProgress(data.progress || { total: 0, completed: 0, percent: 0 });
      }
    } catch (err: any) {
      toast({ title: "Failed to load onboarding", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadOnboarding(); }, [loadOnboarding]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm || !signatureName.trim() || !acknowledged) return;
    const token = await getToken();
    if (!token) return;

    setIsSigning(true);
    try {
      const res = await fetch(`/api/employee/onboarding/${activeForm.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ signature_text: signatureName.trim(), checkbox_acknowledged: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast({ title: "Form signed", description: `Signed at ${new Date(json.signed_at).toLocaleString()}` });
      setActiveForm(null);
      setSignatureName("");
      setAcknowledged(false);

      // Refresh employee data (GPS consent may have changed)
      queryClient.invalidateQueries({ queryKey: ["employee", user?.id] });
      loadOnboarding();
    } catch (err: any) {
      toast({ title: "Failed to sign", description: err.message, variant: "destructive" });
    } finally {
      setIsSigning(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm || !uploadUrl.trim()) return;
    const token = await getToken();
    if (!token) return;

    setIsUploading(true);
    try {
      const res = await fetch(`/api/employee/onboarding/${activeForm.id}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ document_url: uploadUrl.trim(), document_type: activeForm.onboarding_forms.category }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast({ title: "Document uploaded", description: "Your document has been submitted for admin review." });
      setActiveForm(null);
      setUploadUrl("");
      loadOnboarding();
    } catch (err: any) {
      toast({ title: "Failed to upload", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const pending = assignments.filter((a) => a.status === "pending");
  const completed = assignments.filter((a) => a.status === "completed");
  const required = assignments.filter((a) => a.onboarding_forms.is_required);
  const blocking = pending.filter((a) => a.onboarding_forms.blocks_assignments);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (assignments.length === 0) return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Onboarding" title="Welcome" description="Your onboarding documents are managed here." />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 p-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="font-semibold">No forms assigned yet</p>
        <p className="text-sm text-muted-foreground">Your administrator will assign onboarding documents when they are ready.</p>
      </div>
    </div>
  );

  // ── Form detail view ──────────────────────────────────────────────────────
  if (activeForm) {
    const form = activeForm.onboarding_forms;
    const version = activeForm.onboarding_form_versions;
    const isUpload = form.form_type === "upload_required";

    return (
      <div className="grid gap-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => { setActiveForm(null); setSignatureName(""); setAcknowledged(false); setUploadUrl(""); }}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
            ← Back to onboarding
          </button>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/95 p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{CATEGORY_LABELS[form.category] ?? form.category}</p>
            <h2 className="text-xl font-display font-bold">{version.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">Version {version.version_number}</p>
          </div>

          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}

          {version.body_text && (
            <div className="rounded-xl bg-muted/40 border border-border/60 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
              {version.body_text}
            </div>
          )}

          {version.document_url && (
            <a href={version.document_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium">
              <FileText className="h-4 w-4" /> View document PDF
            </a>
          )}

          {activeForm.status === "completed" ? (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Signed</p>
                {activeForm.completed_at && <p className="text-xs">{new Date(activeForm.completed_at).toLocaleString()}</p>}
              </div>
            </div>
          ) : isUpload ? (
            <form onSubmit={handleUpload} className="space-y-4 border-t border-border/60 pt-4">
              <p className="text-sm font-semibold">Upload Required Document</p>
              <p className="text-xs text-muted-foreground">
                Upload your document to Supabase Storage first, then paste the URL here. Your administrator will review the upload.
              </p>
              <div className="space-y-2">
                <Input
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="https://... (document URL)"
                  className="rounded-xl"
                  required
                />
              </div>
              <Button type="submit" disabled={isUploading || !uploadUrl.trim()} className="rounded-xl w-full">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Document for Review
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSign} className="space-y-4 border-t border-border/60 pt-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Note:</strong> This acknowledgment requires attorney review before it constitutes a legally binding agreement.
                By signing, you confirm you have read the content above.
              </div>
              <label className="inline-flex items-start gap-3 cursor-pointer text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded shrink-0" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} required />
                <span>
                  <span className="font-medium">I acknowledge: </span>
                  {version.acknowledgment_statement}
                </span>
              </label>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type your full legal name to sign *</label>
                <Input
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Your full legal name"
                  className="rounded-xl font-medium"
                  required
                />
              </div>
              <Button type="submit" disabled={isSigning || !signatureName.trim() || !acknowledged} className="rounded-xl w-full">
                {isSigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Sign & Acknowledge
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Main onboarding list ──────────────────────────────────────────────────
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Onboarding"
        title="Required Documents"
        description="Complete your onboarding forms before starting work."
      />

      {/* Blocking warning */}
      {blocking.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{blocking.length} required form{blocking.length > 1 ? "s" : ""} must be completed</p>
            <p className="text-xs mt-0.5">These forms block access to assignment details until signed.</p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-2xl border border-border/70 bg-card/95 p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Progress</span>
          <span className="text-muted-foreground">{progress.completed} of {progress.total} complete</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        {progress.percent === 100 && (
          <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> All required forms complete
          </p>
        )}
      </div>

      {/* Pending forms */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">{pending.length} Pending</p>
          {pending.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveForm(a)}
              className="w-full flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-left hover:bg-amber-50 transition"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{a.onboarding_forms.name}</p>
                  {a.onboarding_forms.is_required && <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Required</Badge>}
                  {a.onboarding_forms.blocks_assignments && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">Blocking</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[a.onboarding_forms.category] ?? a.onboarding_forms.category}</p>
                {a.due_date && <p className="text-xs text-amber-700">Due: {new Date(a.due_date).toLocaleDateString()}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Clock className="h-4 w-4 text-amber-500" />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Completed forms */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">{completed.length} Completed</p>
          {completed.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveForm(a)}
              className="w-full flex items-center justify-between gap-4 rounded-2xl border border-green-200 bg-green-50/40 p-4 text-left hover:bg-green-50/80 transition"
            >
              <div className="space-y-1">
                <p className="font-semibold text-sm">{a.onboarding_forms.name}</p>
                <p className="text-xs text-muted-foreground">Signed {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "—"}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Onboarding;
