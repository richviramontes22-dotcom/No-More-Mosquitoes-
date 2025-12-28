import SectionHeading from "@/components/common/SectionHeading";

const Profile = () => {
  return (
    <div className="grid gap-8">
      <SectionHeading eyebrow="Profile" title="Device & preferences" description="Navigation default, notifications, and safety docs." />
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 grid gap-4 text-sm">
        <label className="grid">
          <span className="text-muted-foreground">Default navigation</span>
          <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option>Google</option><option>Apple</option></select>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" /> SMS notifications
        </label>
      </div>
    </div>
  );
};

export default Profile;
