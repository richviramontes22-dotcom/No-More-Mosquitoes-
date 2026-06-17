import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import LegalDocumentChecklist from "@/components/legal/LegalDocumentChecklist";
import {
  fetchLegalStatus, fetchMyAcceptances, diffRequiredAgainstAccepted, submitAcceptances,
  getPendingLegalAcceptance, clearPendingLegalAcceptance,
  type RequiredLegalDocument,
} from "@/lib/legalGate";

/**
 * Blocking screen shown when RequireCustomer detects the signed-in customer
 * hasn't accepted (or has an outdated acceptance for) a currently-required,
 * currently-deployed legal document. Covers two cases identically:
 *   1. Fresh signup — a pending payload from AuthTabs.tsx may already match,
 *      in which case this auto-submits without asking the customer to
 *      re-check boxes they already checked at signup.
 *   2. Re-acceptance — an existing customer whose accepted version is now
 *      older than what's currently deployed; no pending payload will match,
 *      so the checklist is always shown.
 * If the write fails for any reason, the dashboard stays blocked and the
 * customer must retry — never silently let through with a missing record.
 */
const LegalAcceptance = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const destination = (location.state as { from?: string })?.from || "/dashboard";

  const [missing, setMissing] = useState<RequiredLegalDocument[] | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluate = async (autoSubmitFromPending: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const [status, accepted] = await Promise.all([fetchLegalStatus(), fetchMyAcceptances()]);

      if (!status.enforcement_enabled || status.required.length === 0) {
        navigate(destination, { replace: true });
        return;
      }

      const stillMissing = diffRequiredAgainstAccepted(status.required, accepted);
      if (stillMissing.length === 0) {
        navigate(destination, { replace: true });
        return;
      }

      // Frictionless path: if a pending payload from signup covers every
      // currently-missing document at the currently-deployed version, submit
      // it automatically rather than asking the customer to re-check boxes
      // they already agreed to minutes ago.
      if (autoSubmitFromPending) {
        const pending = getPendingLegalAcceptance();
        const pendingCoversAll = pending && stillMissing.every((doc) =>
          pending.some((p) => p.document_id === doc.document_id && p.document_version === doc.version)
        );
        if (pendingCoversAll) {
          try {
            await submitAcceptances(pending!);
            clearPendingLegalAcceptance();
            navigate(destination, { replace: true });
            return;
          } catch {
            // Fall through to the explicit checklist — do not silently proceed.
          }
        }
      }

      setMissing(stillMissing);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { evaluate(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allChecked = (missing ?? []).every((d) => checked[d.document_id]);

  const handleSubmit = async () => {
    if (!missing || !allChecked) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitAcceptances(missing.map((d) => ({ document_id: d.document_id, document_type: d.document_type, document_version: d.version })));
      clearPendingLegalAcceptance();
      navigate(destination, { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to record your acceptance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Checking legal acceptance status…</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card className="rounded-[28px] border-border/60 shadow-soft">
        <CardHeader>
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-display">Updated Legal Documents</CardTitle>
          <CardDescription>
            We've updated one or more of our legal documents. Please review and accept them to continue to your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {missing && <LegalDocumentChecklist documents={missing} checked={checked} onChange={(id, c) => setChecked((p) => ({ ...p, [id]: c }))} />}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <Button className="w-full rounded-full shadow-brand h-11" disabled={!allChecked || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {submitting ? "Saving…" : "Accept & Continue"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegalAcceptance;
