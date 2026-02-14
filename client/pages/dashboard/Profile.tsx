import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";

const Profile = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading
        eyebrow="Profile & Preferences"
        title="Update your account and notifications"
        description="Change your contact information, password, and notification settings."
      />
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 text-sm text-muted-foreground">
        Account settings and preferences controls will appear here.
      </div>
      <div className="flex flex-wrap gap-3">
        <Button className="rounded-full">Save changes</Button>
      </div>
    </div>
  );
};

export default Profile;
