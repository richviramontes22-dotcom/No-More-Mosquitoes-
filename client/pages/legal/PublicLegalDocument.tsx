import { useEffect, useState } from "react";
import { PageHero } from "@/components/page";
import Seo from "@/components/seo/Seo";
import { Loader2, FileX } from "lucide-react";

interface DeployedDocument {
  id: string;
  document_type: string;
  title: string;
  version: string;
  content_md: string | null;
  file_url: string | null;
  file_name: string | null;
  effective_date: string | null;
  deployed_at: string | null;
}

interface PublicLegalDocumentProps {
  documentType: string;
  fallbackTitle: string;
  canonicalPath: string;
}

/**
 * Renders a deployed legal document fetched from GET /api/legal/documents/:type.
 * Shows "Document not yet published" if nothing is deployed for this type —
 * draft/attorney_review/approved documents are never reachable here, since
 * the backing endpoint only ever queries status = 'deployed'.
 */
const PublicLegalDocument = ({ documentType, fallbackTitle, canonicalPath }: PublicLegalDocumentProps) => {
  const [doc, setDoc] = useState<DeployedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/legal/documents/${documentType}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setDoc(data.document);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [documentType]);

  return (
    <div className="flex flex-col gap-0">
      <Seo
        title={`${doc?.title ?? fallbackTitle} | No More Mosquitoes`}
        description={`${doc?.title ?? fallbackTitle} for No More Mosquitoes customers.`}
        canonicalUrl={`https://nomoremosquitoes.us${canonicalPath}`}
      />
      <PageHero
        variant="centered"
        eyebrow="Legal"
        title={doc?.title ?? fallbackTitle}
        description={
          doc?.effective_date
            ? `Effective ${new Date(doc.effective_date).toLocaleDateString()} · v${doc.version}`
            : doc ? `v${doc.version}` : undefined
        }
      />
      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-12">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading…</span>
            </div>
          )}

          {!loading && notFound && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 p-12 text-center">
              <FileX className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-lg font-semibold">Document not yet published</p>
              <p className="text-sm text-muted-foreground">This document hasn't been deployed yet. Please check back later.</p>
            </div>
          )}

          {!loading && doc && (
            doc.file_url ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-8 text-center">
                <p className="font-medium mb-4">{doc.file_name}</p>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-brand"
                >
                  View / Download Document
                </a>
              </div>
            ) : (
              <div className="prose prose-sm sm:prose dark:prose-invert max-w-none whitespace-pre-wrap">
                {doc.content_md || "No content available."}
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
};

export default PublicLegalDocument;
