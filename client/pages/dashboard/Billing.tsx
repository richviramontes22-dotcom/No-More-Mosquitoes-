import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";

const Billing = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Plan & Billing"
        title="Update your plan, cadence, and payment methods"
        description="Change tiers, manage auto‑pay, and download invoices."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm font-semibold text-foreground">Current plan</p>
          <p className="mt-1 text-sm text-muted-foreground">Mosquito + pest bundle (21‑day cadence)</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button className="rounded-full">Change plan</Button>
            <Button variant="secondary" className="rounded-full">Update cadence</Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
          <p className="text-sm font-semibold text-foreground">Payment methods</p>
          <p className="mt-1 text-sm text-muted-foreground">Add or update your default card.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button className="rounded-full">Add payment method</Button>
            <Button variant="secondary" className="rounded-full">Open billing portal</Button>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6">
        <p className="text-sm font-semibold text-foreground">Invoices</p>
        <p className="mt-1 text-sm text-muted-foreground">Your invoice history will appear here.</p>
      </div>
    </div>
  );
};

export default Billing;
