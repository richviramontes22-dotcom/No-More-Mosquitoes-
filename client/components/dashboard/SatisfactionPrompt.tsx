import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ExistingSurvey {
  id: string;
  rating: number;
  satisfaction_type: "promoter" | "passive" | "detractor";
}

async function authedFetch(path: string, method = "GET", body?: unknown) {
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

/**
 * Inline "Rate this service" prompt for a single completed appointment.
 * One submission per appointment, enforced server-side (and at the DB
 * level via a UNIQUE constraint) — this component checks on mount and
 * shows a thank-you state instead of the button if already submitted.
 */
export function SatisfactionPrompt({ appointmentId }: { appointmentId: string }) {
  const { toast } = useToast();
  const [existing, setExisting] = useState<ExistingSurvey | null | undefined>(undefined); // undefined = loading
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    authedFetch(`/api/satisfaction/surveys/${appointmentId}`)
      .then((res) => { if (mounted) setExisting(res.survey); })
      .catch(() => { if (mounted) setExisting(null); });
    return () => { mounted = false; };
  }, [appointmentId]);

  const submit = async () => {
    if (rating == null) return;
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/satisfaction/surveys", "POST", {
        appointment_id: appointmentId,
        rating,
        comment: comment.trim() || undefined,
      });
      setExisting(res.survey);
      setOpen(false);
      toast({ title: "Thanks for the feedback!" });
    } catch (err: any) {
      toast({ title: "Couldn't submit rating", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (existing === undefined) return null; // loading — avoid a layout flash

  if (existing) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        {existing.satisfaction_type === "promoter" ? "Thanks for the great rating!" : "Rating submitted"}
      </span>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => setOpen(true)}>
        Rate This Service
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>How was your service?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                On a scale of 0-10, how likely are you to recommend us?
              </p>
              <div className="grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={cn(
                      "h-8 rounded-md text-xs font-bold border transition-colors",
                      rating === n ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/40",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              placeholder="Anything you'd like to share? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="resize-none rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={rating == null || submitting} className="shadow-brand">
              {submitting ? "Submitting…" : "Submit Rating"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
