import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import Seo from "@/components/seo/Seo";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase sends the recovery session via URL hash fragment.
  // onAuthStateChange fires with event "PASSWORD_RECOVERY" when the user
  // lands on this page after clicking the email link.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // Also check if we already have a valid session (user returning to tab)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    if (password !== confirm) {
      setError("Passwords do not match."); return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setDone(true);
      // Sign out so the user logs in fresh with their new password
      await supabase.auth.signOut({ scope: "local" });
      setTimeout(() => navigate("/login", { replace: true }), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update password. The link may have expired.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-80px)] w-full overflow-hidden bg-background">
      <Seo
        title="Reset Password | No More Mosquitoes"
        description="Create a new password for your No More Mosquitoes account."
        canonicalUrl="https://nomoremosquitoes.us/reset-password"
      />
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-30" aria-hidden />

      <div className="container relative flex min-h-[calc(100dvh-80px)] flex-col items-center justify-center py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <KeyRound className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Create new password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose a strong password for your account.
            </p>
          </div>

          <Card className="border-border/60 bg-card/80 shadow-xl backdrop-blur-sm sm:rounded-[24px]">
            <CardContent className="pt-6">
              {done ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <div>
                    <p className="font-semibold text-foreground">Password updated!</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Redirecting you to login in a moment…
                    </p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full mt-2">
                    <Link to="/login">Go to login</Link>
                  </Button>
                </div>
              ) : !sessionReady ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <AlertCircle className="h-10 w-10 text-amber-500" />
                  <div>
                    <p className="font-semibold text-foreground">Invalid or expired link</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This reset link has expired or is invalid. Please request a new one.
                    </p>
                  </div>
                  <Button asChild className="rounded-full shadow-brand">
                    <Link to="/forgot-password">Request new link</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm new password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      placeholder="Repeat your password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="rounded-xl"
                    />
                  </div>
                  {error && (
                    <p className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full rounded-full shadow-brand"
                    disabled={saving || !password || !confirm}
                  >
                    {saving ? "Updating…" : "Update password"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
