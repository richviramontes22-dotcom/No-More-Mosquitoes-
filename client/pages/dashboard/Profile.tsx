import { useState } from "react";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  Phone,
  Bell,
  ShieldCheck,
  Smartphone,
  Save,
  Trash2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Profile Updated",
        description: "Your account changes have been saved successfully.",
      });
    }, 1000);
  };

  return (
    <div className="grid gap-10">
      <SectionHeading
        eyebrow="Profile & Preferences"
        title="Your Account Settings"
        description="Manage your contact information, security preferences, and how we communicate with you."
      />

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {/* Contact Information */}
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-display">Contact Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name</Label>
                  <Input id="full-name" defaultValue={user?.name ?? ""} placeholder="Taylor Johnson" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" defaultValue={user?.email ?? ""} placeholder="taylor@example.com" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" type="tel" placeholder="(949) 555-0123" className="rounded-xl" />
                </div>
              </div>
              <Button onClick={handleSave} disabled={isSaving} className="rounded-xl">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Update Contact Info"}
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bell className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-display">Communication Preferences</CardTitle>
              </div>
              <CardDescription>Choose how you want to receive visit reminders and video recaps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">SMS Visit Reminders</p>
                    <p className="text-xs text-muted-foreground">Receive a text 24 hours before your technician arrives.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">Video Recap Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified immediately when your visit video is uploaded.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">Marketing & Tips</p>
                    <p className="text-xs text-muted-foreground">Seasonal pest alerts and special program offers.</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-8">
          {/* Security */}
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Manage your password and account security settings.</p>
              <Button variant="outline" className="w-full rounded-xl">Change Password</Button>
              <Button variant="outline" className="w-full rounded-xl">Two-Factor Auth</Button>
            </CardContent>
          </Card>

          {/* Delete Account */}
          <Card className="rounded-[28px] border-destructive/20 bg-destructive/5 shadow-none border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Once you delete your account, there is no going back. Please be certain.</p>
              <Button variant="ghost" className="w-full rounded-xl text-destructive hover:bg-destructive/10">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default Profile;
