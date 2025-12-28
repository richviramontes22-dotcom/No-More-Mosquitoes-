import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";

const Messages = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Messages"
        title="Conversations with support"
        description="View and reply to open threads and see ticket updates."
      />
      <div className="flex flex-wrap gap-3">
        <Button className="rounded-full">New message</Button>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">
        Your message threads will appear here.
      </div>
    </div>
  );
};

export default Messages;
