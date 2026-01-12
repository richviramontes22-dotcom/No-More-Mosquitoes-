import SectionHeading from "@/components/common/SectionHeading";

const Messages = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Messages" title="Customer & dispatch threads" description="Unified messaging across portals." />
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">Thread list placeholder…</div>
    </div>
  );
};

export default Messages;
