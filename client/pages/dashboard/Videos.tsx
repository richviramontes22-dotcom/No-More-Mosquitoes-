import SectionHeading from "@/components/common/SectionHeading";

const Videos = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Visit Videos"
        title="Completion videos and technician notes"
        description="Watch HD recaps from your recent visits."
      />
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">
        Your videos will appear here.
      </div>
    </div>
  );
};

export default Videos;
