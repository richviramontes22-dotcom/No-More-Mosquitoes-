import { FileText } from "lucide-react";
import type { RequiredLegalDocument } from "@/lib/legalGate";

const DOCUMENT_TYPE_PATH: Record<string, string> = {
  terms_and_conditions: "/legal/terms",
  privacy_policy: "/legal/privacy",
  service_agreement: "/legal/service-agreement",
  pesticide_consent: "/legal/pesticide-consent",
};

interface LegalDocumentChecklistProps {
  documents: RequiredLegalDocument[];
  checked: Record<string, boolean>;
  onChange: (documentId: string, checked: boolean) => void;
}

/**
 * Renders one checkbox per required document, each linking out to its public
 * /legal/* page so the customer can actually read it before checking the box.
 * Shared between the signup flow (AuthTabs.tsx) and the dashboard-entry
 * (re-)acceptance screen (LegalAcceptance.tsx) — same UI, same behavior,
 * different call sites.
 */
const LegalDocumentChecklist = ({ documents, checked, onChange }: LegalDocumentChecklistProps) => {
  if (documents.length === 0) return null;

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div key={doc.document_id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3">
          <input
            id={`legal-doc-${doc.document_id}`}
            type="checkbox"
            checked={!!checked[doc.document_id]}
            onChange={(e) => onChange(doc.document_id, e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer shrink-0"
          />
          <label htmlFor={`legal-doc-${doc.document_id}`} className="text-sm text-muted-foreground leading-relaxed cursor-pointer flex-1">
            I have read and agree to the{" "}
            <a
              href={DOCUMENT_TYPE_PATH[doc.document_type] ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:no-underline inline-flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              {doc.title}
            </a>
            <span className="text-xs text-muted-foreground/70"> (v{doc.version})</span>
          </label>
        </div>
      ))}
    </div>
  );
};

export default LegalDocumentChecklist;
