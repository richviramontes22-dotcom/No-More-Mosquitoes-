import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";

const Properties = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Properties"
        title="Manage your service addresses"
        description="Keep addresses, ZIPs, acreage, and access notes up to date."
      />
      <div className="flex flex-wrap gap-3">
        <Button className="rounded-full">Add property</Button>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">
        Your properties will appear here.
      </div>
    </div>
  );
};

export default Properties;
