import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import SectionHeading from "@/components/common/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  User,
  Bell,
  ShieldCheck,
  Save,
  Trash2,
  Lock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const Profile = () => {
  const { user } = useAuth();
  const { data: profileRaw } = useProfile();
  const profile = profileRaw as any;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: ""
  });

  const DEFAULT_NOTIF_PREFS = { smsReminders: true, videoAlerts: true, marketing: false };

  const [notifPrefs, setNotifPrefs] = useState<{ smsReminders: boolean; videoAlerts: boolean; marketing: boolean }>(() => {
    try {
      const stored = localStorage.getItem("nmm_notif_prefs");
      return stored ? JSON.parse(stored) : DEFAULT_NOTIF_PREFS;
    } catch { return DEFAULT_NOTIF_PREFS; }
  });
  const [savingNotif, setSavingNotif] = useState(false);

  // Sync notification prefs from DB once profile loads
  useEffect(() => {
    if (profile?.notification_preferences) {
      const dbPrefs = { ...DEFAULT_NOTIF_PREFS, ...profile.notification_preferences };
      setNotifPrefs(dbPrefs);
      try { localStorage.setItem("nmm_notif_prefs", JSON.stringify(dbPrefs)); } catch {}
    }
  }, [profile?.notification_preferences]);

  const setNotifPref = async (key: string, value: boolean) => {
    if (!user) return;
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    try { localStorage.setItem("nmm_notif_prefs", JSON.stringify(next)); } catch {}

    setSavingNotif(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: next })
        .eq("id", user.id);
      if (error) throw error;
      toast({ title: "Preferences saved", description: "Your notification settings have been updated." });
    } catch {
      toast({ title: "Couldn't save preference", description: "Change saved locally but not synced to your account.", variant: "destructive" });
    } finally {
      setSavingNotif(false);
    }
  };

  // Change Password dialog state
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Minimum 8 characters.", variant: "destructive" }); return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" }); return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      setPwDialogOpen(false);
      setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setSavingPw(false); }
  };

  // Populate phone from profile once it loads (AuthContext doesn't carry phone)
  useEffect(() => {
    setFormData(prev => ({
      name: profile?.name ?? user?.name ?? prev.name,
      email: profile?.email ?? user?.email ?? prev.email,
      phone: profile?.phone ?? prev.phone,
    }));
  }, [profile?.phone, profile?.name, profile?.email, user?.name, user?.email]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const { name, email, phone } = formData;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name, email, phone, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your account changes have been saved successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to save profile changes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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
                  <Input
                    id="full-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Taylor Johnson"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="taylor@example.com"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(949) 555-0123"
                    className="rounded-xl"
                  />
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
                  <Switch checked={notifPrefs.smsReminders} disabled={savingNotif} onCheckedChange={(v) => setNotifPref("smsReminders", v)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">Video Recap Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified immediately when your visit video is uploaded.</p>
                  </div>
                  <Switch checked={notifPrefs.videoAlerts} disabled={savingNotif} onCheckedChange={(v) => setNotifPref("videoAlerts", v)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">Marketing & Tips</p>
                    <p className="text-xs text-muted-foreground">Seasonal pest alerts and special program offers.</p>
                  </div>
                  <Switch checked={notifPrefs.marketing} disabled={savingNotif} onCheckedChange={(v) => setNotifPref("marketing", v)} />
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
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setPwDialogOpen(true)}>
                <Lock className="mr-2 h-4 w-4" />
                Change Password
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Two-factor authentication is managed by your identity provider. Contact support to enable it.
              </p>
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

      {/* Change Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={(open) => { setPwDialogOpen(open); if (!open) { setNewPassword(""); setConfirmPassword(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="new-pw">New Password</Label>
              <Input
                id="new-pw"
                type="password"
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setPwDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleChangePassword}
              disabled={savingPw || !newPassword || !confirmPassword}
            >
              {savingPw ? "Updating…" : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
