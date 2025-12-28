import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";

const Support = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Support"
        title="Request a re‑service or contact our team"
        description="Submit a re‑service request linked to your last visit, or call/email us."
      />
      <div className="flex flex-wrap gap-3">
        <Button className="rounded-full">Request re‑service</Button>
        <Button variant="secondary" className="rounded-full">Call or text (949) 763‑0492</Button>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">
        Your recent tickets will appear here.
      </div>
    </div>
  );
};

export default Support;
