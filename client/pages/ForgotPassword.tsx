import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Mail, CheckCircle2 } from "lucide-react";
import Seo from "@/components/seo/Seo";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);

    try {
      // Use the production URL for the redirect; falls back to current origin in dev
      const redirectTo = `${window.location.origin}/reset-password`;

      if (import.meta.env.DEV) {
        console.log("[ForgotPassword] redirectTo:", redirectTo);
        console.log("[ForgotPassword] IMPORTANT: This URL must be in Supabase Dashboard → Auth → URL Configuration → Redirect URLs");
      }

      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      );

      if (supabaseError) {
        if (import.meta.env.DEV) console.error("[ForgotPassword] Supabase error:", supabaseError);
        throw supabaseError;
      }
      setSent(true);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error("[ForgotPassword] Email send failed:", err);
      // Return generic message — do NOT reveal whether email exists in DB
      setError("If that email is registered, you'll receive a reset link shortly. Check your spam folder if you don't see it.");
      setSent(true); // show success UI regardless to prevent email enumeration
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-80px)] w-full overflow-hidden bg-background">
      <Seo
        title="Forgot Password | No More Mosquitoes"
        description="Reset your No More Mosquitoes customer portal password."
        canonicalUrl="https://nomoremosquitoes.us/forgot-password"
      />
      <div className="absolute inset-0 -z-10 bg-mesh-overlay opacity-30" aria-hidden />

      <div className="container relative flex min-h-[calc(100dvh-80px)] flex-col items-center justify-center py-12">
        <div className="absolute left-4 top-8 sm:left-8">
          <Link
            to="/login"
            className="group flex items-center gap-1 text-sm font-semibold text-muted-foreground transition hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
            Back to login
          </Link>
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <Mail className="h-7 w-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <Card className="border-border/60 bg-card/80 shadow-xl backdrop-blur-sm sm:rounded-[24px]">
            <CardContent className="pt-6">
              {sent ? (
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <div>
                    <p className="font-semibold text-foreground">Check your email</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      If that email is registered, you'll receive a password reset link shortly.
                      Check your spam folder if you don't see it within a few minutes.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full mt-2">
                    <Link to="/login">Back to login</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="rounded-xl"
                    />
                  </div>
                  {error && <p className="text-sm text-muted-foreground">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full rounded-full shadow-brand"
                    disabled={sending || !email.trim()}
                  >
                    {sending ? "Sending…" : "Send reset link"}
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

export default ForgotPassword;
