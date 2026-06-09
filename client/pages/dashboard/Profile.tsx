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
  Lock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const Profile = () => {
  const { user } = useAuth();
  const { data: profileRaw } = useProfile();
  const profile = profileRaw as any;
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    confirmEmail: "",
    phone: "",
  });

  // Track what the email was on load so we know if it changed
  const [originalEmail, setOriginalEmail] = useState("");

  const emailChanged = formData.email.trim() !== originalEmail;
  const emailMismatch =
    emailChanged &&
    formData.confirmEmail.length > 0 &&
    formData.email.trim() !== formData.confirmEmail.trim();
  const canSave =
    !isSaving &&
    (!emailChanged || (formData.confirmEmail.trim() === formData.email.trim()));

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [isDeletionRequesting, setIsDeletionRequesting] = useState(false);
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

  const handleDeleteRequest = async () => {
    if (!user || deleteConfirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
      toast({ title: "Email doesn't match", description: "Please enter your account email to confirm.", variant: "destructive" });
      return;
    }
    setIsDeletionRequesting(true);
    try {
      await supabase.from("tickets").insert({
        user_id:  user.id,
        category: "account",
        subject:  "Account Deletion Request",
        body:     `User ${user.email} has requested permanent deletion of their account and all associated data.`,
        status:   "new",
        priority: "high",
      });
      toast({
        title: "Deletion request received",
        description: "We'll process your request within 3–5 business days and send a confirmation email.",
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmEmail("");
    } catch (err: any) {
      toast({ title: "Request failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDeletionRequesting(false);
    }
  };

  // Populate form from profile once it loads
  useEffect(() => {
    const fullName = profile?.name ?? user?.name ?? "";
    // Split on first space — everything after the first space is "last name"
    const spaceIdx = fullName.indexOf(" ");
    const firstName = spaceIdx >= 0 ? fullName.slice(0, spaceIdx) : fullName;
    const lastName  = spaceIdx >= 0 ? fullName.slice(spaceIdx + 1) : "";

    const email = profile?.email ?? user?.email ?? "";

    setFormData(prev => ({
      firstName: firstName || prev.firstName,
      lastName:  lastName  || prev.lastName,
      email:     email     || prev.email,
      confirmEmail: "",
      phone: profile?.phone ?? prev.phone,
    }));
    setOriginalEmail(email);
  }, [profile?.phone, profile?.name, profile?.email, user?.name, user?.email]);

  const handleSave = async () => {
    if (!user) return;

    if (emailChanged && formData.confirmEmail.trim() !== formData.email.trim()) {
      toast({ title: "Email addresses don't match", description: "Please make sure both email fields are identical.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    const name  = [formData.firstName.trim(), formData.lastName.trim()].filter(Boolean).join(" ");
    const email = formData.email.trim();
    const phone = formData.phone.trim();

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ name, email, phone, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // If email changed, update Supabase Auth (sends confirmation to new address)
      if (emailChanged) {
        const { error: authError } = await supabase.auth.updateUser({ email });
        if (authError) throw authError;

        setOriginalEmail(email);
        setFormData(prev => ({ ...prev, confirmEmail: "" }));

        toast({
          title: "Profile updated — verify your new email",
          description: "A confirmation link has been sent to your new address. Your email will update once you click it.",
        });
      } else {
        toast({
          title: "Profile updated",
          description: "Your contact information has been saved.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Update failed",
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
            <CardContent className="space-y-5">
              {/* Row 1: First Name + Last Name */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name</Label>
                  <Input
                    id="first-name"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Taylor"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input
                    id="last-name"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Johnson"
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Row 2: Email (+ Confirm Email when changed) */}
              <div className={cn("grid gap-4", emailChanged ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value, confirmEmail: "" }))}
                    placeholder="taylor@example.com"
                    className="rounded-xl"
                  />
                </div>
                <div className={cn("space-y-2 transition-all", emailChanged ? "opacity-100" : "opacity-0 pointer-events-none")}>
                  <Label htmlFor="confirm-email" className="flex items-center gap-1.5">
                    Confirm Email
                    {emailChanged && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        changed
                      </span>
                    )}
                  </Label>
                  <Input
                    id="confirm-email"
                    type="email"
                    value={formData.confirmEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmEmail: e.target.value }))}
                    placeholder="Re-enter new email"
                    className={cn(
                      "rounded-xl transition-colors",
                      emailMismatch && "border-destructive focus-visible:ring-destructive"
                    )}
                    tabIndex={emailChanged ? 0 : -1}
                  />
                  {emailMismatch && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" /> Addresses don't match
                    </p>
                  )}
                </div>
              </div>

              {/* Row 3: Phone */}
              <div className="grid gap-4 sm:grid-cols-2">
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

              {emailChanged && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-3">
                  <AlertCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  Changing your email sends a confirmation link to the new address. Your login email updates once you click it.
                </p>
              )}

              <Button onClick={handleSave} disabled={!canSave} className="rounded-xl">
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving…" : "Update Contact Info"}
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
              <Button
                variant="ghost"
                className="w-full rounded-xl text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
              >
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

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmEmail(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>This will submit a deletion request. Your account and data will be permanently removed within 3–5 business days. This cannot be undone.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">Type your email to confirm</Label>
              <Input
                id="delete-confirm"
                type="email"
                placeholder={user?.email ?? "your@email.com"}
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                className="rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleDeleteRequest()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={handleDeleteRequest}
              disabled={isDeletionRequesting || !deleteConfirmEmail.trim()}
            >
              {isDeletionRequesting ? "Submitting…" : "Request Deletion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
