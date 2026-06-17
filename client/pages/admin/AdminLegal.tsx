import { useEffect, useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, Download, FileText, ShieldCheck, AlertTriangle, Archive, CheckCircle2, Eye } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface LegalDocument {
  id: string;
  document_type: string;
  title: string;
  version: string;
  status: "draft" | "attorney_review" | "approved" | "deployed" | "archived";
  content_md: string | null;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  effective_date: string | null;
  deployed_at: string | null;
  created_at: string;
}

interface LegalSettings {
  id: string;
  enforcement_enabled: boolean;
  require_terms: boolean;
  require_privacy: boolean;
  require_service_agreement: boolean;
  require_pesticide_consent: boolean;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  terms_and_conditions: "Terms & Conditions",
  privacy_policy: "Privacy Policy",
  service_agreement: "Service Agreement",
  pesticide_consent: "Pesticide Consent",
};

const REQUIRE_FLAG_BY_TYPE: Record<string, keyof LegalSettings> = {
  terms_and_conditions: "require_terms",
  privacy_policy: "require_privacy",
  service_agreement: "require_service_agreement",
  pesticide_consent: "require_pesticide_consent",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  attorney_review: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  deployed: "bg-green-100 text-green-800",
  archived: "bg-slate-100 text-slate-500",
};

const STATUS_RANK: Record<string, number> = { draft: 0, attorney_review: 1, approved: 2, deployed: 3, archived: -1 };

function currentVersionFor(docs: LegalDocument[]): LegalDocument | null {
  const nonArchived = docs.filter((d) => d.status !== "archived");
  if (nonArchived.length === 0) return docs[0] ?? null;
  return [...nonArchived].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])[0];
}

async function downloadDocument(doc: LegalDocument) {
  if (doc.file_url) {
    window.open(doc.file_url, "_blank", "noopener,noreferrer");
    return;
  }
  const blob = new Blob([doc.content_md || ""], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.document_type}-${doc.version}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

const AdminLegal = () => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [settings, setSettings] = useState<LegalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [enforcementError, setEnforcementError] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<LegalDocument | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [docsRes, settingsRes] = await Promise.all([
        adminApi("/api/admin/legal/documents"),
        adminApi("/api/admin/legal/settings"),
      ]);
      setDocuments(docsRes.documents || []);
      setSettings(settingsRes.settings);
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (doc: LegalDocument, status: string) => {
    try {
      const res = await adminApi(`/api/admin/legal/documents/${doc.id}`, "PATCH", { status });
      setDocuments((ds) => ds.map((d) => (d.id === doc.id ? res.document : d)));
      toast({ title: `Marked ${status.replace(/_/g, " ")}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const deploy = async (doc: LegalDocument) => {
    if (!window.confirm(`Deploy "${doc.title}" v${doc.version}? This will archive the currently-deployed version of this document type.`)) return;
    try {
      const res = await adminApi(`/api/admin/legal/documents/${doc.id}/deploy`, "POST");
      await fetchAll();
      toast({ title: "Document deployed", description: `${doc.title} v${doc.version} is now live.` });
    } catch (err: any) {
      toast({ title: "Deploy failed", description: err.message, variant: "destructive" });
    }
  };

  const saveSettings = async (updates: Partial<LegalSettings>) => {
    if (!settings) return;
    setSavingSettings(true);
    setEnforcementError(null);
    try {
      const res = await adminApi("/api/admin/legal/settings", "PATCH", updates);
      setSettings(res.settings);
      toast({ title: "Settings saved" });
    } catch (err: any) {
      setEnforcementError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading || !settings) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  const grouped: Record<string, LegalDocument[]> = {};
  Object.keys(DOCUMENT_TYPE_LABELS).forEach((type) => { grouped[type] = documents.filter((d) => d.document_type === type); });

  return (
    <div className="grid gap-8 pb-20">
      <SectionHeading
        eyebrow="Compliance"
        title="Legal Documents"
        description="Manage attorney-reviewed Terms, Privacy Policy, Service Agreement, and Pesticide Consent documents, and control whether customers must accept them."
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>All documents start as drafts for attorney review. Nothing is shown to customers, and no acceptance is required, until you explicitly deploy a document and separately enable enforcement below.</p>
      </div>

      {/* Document groups */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => {
          const docs = grouped[type] || [];
          const current = currentVersionFor(docs);
          const history = docs.filter((d) => d.id !== current?.id);

          return (
            <Card key={type} className="rounded-2xl border-border/60 bg-card/95">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{label}</span>
                  {current && <Badge className={STATUS_BADGE[current.status]}>{current.status.replace(/_/g, " ")}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!current ? (
                  <p className="text-sm text-muted-foreground italic">No document yet.</p>
                ) : (
                  <>
                    <div className="text-sm space-y-1">
                      <p className="font-semibold">{current.title} <span className="text-muted-foreground font-normal">v{current.version}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {current.effective_date ? `Effective ${new Date(current.effective_date).toLocaleDateString()}` : "No effective date set"}
                        {current.deployed_at ? ` · Deployed ${new Date(current.deployed_at).toLocaleDateString()}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => setViewDoc(current)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => downloadDocument(current)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => setUploadFor(type)}>
                        <Upload className="h-3.5 w-3.5 mr-1" /> Upload Replacement
                      </Button>
                      {current.status === "draft" && (
                        <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => updateStatus(current, "attorney_review")}>
                          Mark Attorney Review
                        </Button>
                      )}
                      {current.status === "attorney_review" && (
                        <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs text-blue-700 border-blue-200" onClick={() => updateStatus(current, "approved")}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Approved
                        </Button>
                      )}
                      {current.status === "approved" && (
                        <Button size="sm" className="rounded-lg h-8 text-xs shadow-brand" onClick={() => deploy(current)}>
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Deploy
                        </Button>
                      )}
                      {current.status !== "archived" && (
                        <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs text-muted-foreground" onClick={() => updateStatus(current, "archived")}>
                          <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {history.length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Version history</p>
                    <div className="space-y-1">
                      {history.map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>v{d.version} — {new Date(d.created_at).toLocaleDateString()}</span>
                          <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[d.status]}`}>{d.status.replace(/_/g, " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Enforcement settings */}
      <Card className="rounded-2xl border-border/60 bg-card/95">
        <CardHeader>
          <CardTitle className="text-base">Legal Acceptance Enforcement</CardTitle>
          <CardDescription>Do not enable enforcement until all required documents are attorney-reviewed, approved, and deployed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
            <div>
              <Label className="text-sm font-semibold">Require acceptance at registration</Label>
              <p className="text-xs text-muted-foreground">When off, registration works exactly as it does today — no gate, no blocking.</p>
            </div>
            <Switch
              checked={settings.enforcement_enabled}
              disabled={savingSettings}
              onCheckedChange={(checked) => saveSettings({ enforcement_enabled: checked })}
            />
          </div>

          {enforcementError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{enforcementError}</div>
          )}

          <div className="space-y-2.5">
            <Label className="text-sm font-semibold">Required documents</Label>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Switch
                  checked={!!settings[REQUIRE_FLAG_BY_TYPE[type]]}
                  disabled={savingSettings}
                  onCheckedChange={(checked) => saveSettings({ [REQUIRE_FLAG_BY_TYPE[type]]: checked } as Partial<LegalSettings>)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View dialog */}
      <Dialog open={!!viewDoc} onOpenChange={(open) => { if (!open) setViewDoc(null); }}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewDoc?.title} <span className="text-muted-foreground font-normal text-sm">v{viewDoc?.version}</span></DialogTitle>
            <DialogDescription>
              <Badge className={STATUS_BADGE[viewDoc?.status ?? "draft"]}>{viewDoc?.status?.replace(/_/g, " ")}</Badge>
            </DialogDescription>
          </DialogHeader>
          {viewDoc?.file_url ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              <p className="font-medium mb-2">{viewDoc.file_name}</p>
              <Button size="sm" variant="outline" onClick={() => downloadDocument(viewDoc)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download to view
              </Button>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{viewDoc?.content_md || "No content."}</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload replacement dialog */}
      <UploadReplacementDialog
        documentType={uploadFor}
        currentDoc={uploadFor ? currentVersionFor(grouped[uploadFor] || []) : null}
        onClose={() => setUploadFor(null)}
        onCreated={() => { setUploadFor(null); fetchAll(); }}
      />
    </div>
  );
};

function UploadReplacementDialog({
  documentType, currentDoc, onClose, onCreated,
}: {
  documentType: string | null;
  currentDoc: LegalDocument | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentDoc) {
      setTitle(currentDoc.title);
      setVersion("");
      setContentMd("");
      setFile(null);
      setEffectiveDate("");
    }
  }, [currentDoc, documentType]);

  const ACCEPTED = [".md", ".txt", ".pdf", ".docx"];

  const handleSubmit = async () => {
    if (!documentType || !title.trim() || !version.trim()) {
      toast({ title: "Title and version are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let file_url: string | undefined;
      let file_name: string | undefined;
      let mime_type: string | undefined;

      if (file) {
        const path = `${documentType}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("legal-documents").upload(path, file, {
          contentType: file.type || undefined,
        });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from("legal-documents").getPublicUrl(path);
        file_url = urlData.publicUrl;
        file_name = file.name;
        mime_type = file.type || undefined;
      }

      await adminApi("/api/admin/legal/documents", "POST", {
        document_type: documentType,
        title: title.trim(),
        version: version.trim(),
        content_md: contentMd.trim() || undefined,
        file_url, file_name, mime_type,
        effective_date: effectiveDate || undefined,
      });

      toast({ title: "New draft version created" });
      onCreated();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!documentType} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Upload Replacement — {documentType ? DOCUMENT_TYPE_LABELS[documentType] : ""}</DialogTitle>
          <DialogDescription>Creates a new draft version. The current version is never overwritten in place.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" /></div>
          <div><Label>Version *</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g., 1.0" className="rounded-xl" /></div>
          <div><Label>Effective date (optional)</Label><Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="rounded-xl" /></div>
          <div>
            <Label>Upload file (optional — {ACCEPTED.join(", ")})</Label>
            <input
              type="file"
              accept={ACCEPTED.join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm rounded-xl border border-input bg-background px-3 py-2"
            />
          </div>
          <div>
            <Label>Or paste content (Markdown/plain text)</Label>
            <textarea
              rows={6}
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none"
              placeholder="Paste the attorney-reviewed text here, or attach a file above."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="shadow-brand">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Create Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AdminLegal;
