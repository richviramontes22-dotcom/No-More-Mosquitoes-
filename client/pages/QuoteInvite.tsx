import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import Seo from "@/components/seo/Seo";
import { savePendingOnboarding } from "@/lib/pendingOnboarding";

// ─── Quote invite data (returned by GET /api/quote-invite/:token) ─────────────

interface QuoteInviteData {
  ok: boolean;
  inviteId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  planType: string | null;
  cadenceDays: number | null;
  priceCents: number | null;
  acreage: number | null;
  priceLabel: string | null;
  programLabel: string | null;
  customerName: string | null;
  customerEmail: string | null;
  expiresAt: string | null;
  message?: string;
}

function formatCents(cents: number): string {
  return cents % 100 === 0 ? `$${(cents / 100).toFixed(0)}` : `$${(cents / 100).toFixed(2)}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const QuoteInvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phase, setPhase] = useState<"loading" | "form" | "success" | "error">("loading");
  const [invite, setInvite] = useState<QuoteInviteData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Load invite data ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setErrorMsg("No invite token found in the URL."); setPhase("error"); return; }

    fetch(`/api/quote-invite/${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((data: QuoteInviteData) => {
        if (!data.ok) {
          setErrorMsg(data.message || "This quote link is invalid or has expired.");
          setPhase("error");
          return;
        }
        setInvite(data);
        // Prefill name if admin provided it
        const parts = (data.customerName || "").trim().split(/\s+/);
        if (parts[0]) setFirstName(parts[0]);
        if (parts.length > 1) setLastName(parts.slice(1).join(" "));
        // Prefill email
        if (data.customerEmail) setEmail(data.customerEmail);
        setPhase("form");
      })
      .catch(() => {
        setErrorMsg("Unable to load your quote. Please check your connection and try again.");
        setPhase("error");
      });
  }, [token]);

  // ── Submit: create account ────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite || !supabase) return;
    if (!firstName.trim()) { toast({ title: "First name is required.", variant: "destructive" }); return; }
    if (!email.trim()) { toast({ title: "Email is required.", variant: "destructive" }); return; }
    if (password.length < 8) { toast({ title: "Password must be at least 8 characters.", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

      // Try sign-up first
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: displayName, first_name: firstName.trim(), last_name: lastName.trim(), role: "customer" } },
      });

      let userId: string | null = signUpData?.user?.id ?? null;

      if (signUpError) {
        // "User already registered" — sign them in instead and claim the quote
        if (signUpError.message.toLowerCase().includes("already registered") ||
            signUpError.message.toLowerCase().includes("already exists")) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });
          if (signInError) {
            toast({ title: "Email already has an account", description: "Sign in with your existing password to claim this quote.", variant: "destructive" });
            setSubmitting(false);
            return;
          }
          userId = signInData?.user?.id ?? null;
        } else {
          throw signUpError;
        }
      } else {
        // Create profile for new accounts (mirrors the normal signUp flow)
        if (userId) {
          await supabase.from("profiles").insert({
            id: userId,
            name: displayName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || null,
            role: "customer",
          }).then(() => {});
        }
      }

      if (!userId) throw new Error("Could not determine user account.");

      // Mark the invite accepted on the server
      await fetch(`/api/quote-invite/${encodeURIComponent(token!)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: userId }),
      });

      // Pre-fill onboarding with the locked quote details (same shape as the
      // normal pendingOnboarding path, so Onboarding.tsx works without changes)
      savePendingOnboarding({
        address:        invite.address,
        city:           invite.city ?? undefined,
        state:          invite.state ?? undefined,
        zip:            invite.zip ?? undefined,
        acreage:        invite.acreage ?? undefined,
        program:        invite.planType as any ?? undefined,
        cadenceDays:    invite.cadenceDays ?? undefined,
        estimatedPrice: invite.priceCents != null ? invite.priceCents / 100 : undefined,
        source:         "admin_quote",
      });

      setPhase("success");
      // Short delay so the success state is visible, then redirect
      setTimeout(() => navigate("/onboarding"), 1800);

    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Seo title="Quote Link Expired | No More Mosquitoes" description="" canonicalUrl="" />
        <div className="w-full max-w-md text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Quote link unavailable</h1>
          <p className="text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={() => navigate("/")}>Back to homepage</Button>
        </div>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h1 className="font-display text-2xl font-semibold">Account created!</h1>
          <p className="text-muted-foreground">Heading to your setup page — your address and plan are already saved.</p>
        </div>
      </div>
    );
  }

  // Use the normalized address directly (already includes city/state/zip from
  // the parcel lookup). Only fall back to constructing it when the address
  // string doesn't already contain the city/state.
  const cityStateZip = [invite!.city, invite!.state, invite!.zip].filter(Boolean).join(", ");
  const displayAddress = (invite!.address && cityStateZip && invite!.address.includes(invite!.city ?? ""))
    ? invite!.address
    : [invite!.address, cityStateZip].filter(Boolean).join(", ");
  const priceDisplay = invite!.priceLabel ?? (invite!.priceCents != null ? formatCents(invite!.priceCents) : "—");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-primary/[0.03] py-10 px-4">
      <Seo
        title="Set Up Your Account | No More Mosquitoes"
        description="Finish setting up your mosquito control account. Your quote is ready."
        canonicalUrl={`https://nomoremosquitoes.us/quote-invite/${token}`}
      />

      <div className="mx-auto max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 text-primary mb-2">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Your quote is ready</h1>
          <p className="text-muted-foreground text-sm">Set up your account below — your address and plan are already saved.</p>
        </div>

        {/* Locked quote summary */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Your Quote</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{displayAddress}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Lock className="h-3 w-3" /> This address is tied to your quote
                </p>
              </div>
            </div>
            <div className="border-t border-primary/15 pt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="font-semibold">{invite!.programLabel ?? invite!.planType ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="font-semibold text-primary">{priceDisplay}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Need a different address or plan? Contact us and we'll send a new quote.
            </p>
          </CardContent>
        </Card>

        {/* Account setup form */}
        <Card className="border-border/60 bg-card/90 shadow-xl rounded-[20px]">
          <CardContent className="pt-6 pb-6 px-6 space-y-4">
            <p className="text-sm font-semibold text-foreground">Create your account</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="qi-first">First name</Label>
                  <Input id="qi-first" value={firstName} onChange={e => setFirstName(e.target.value)}
                    placeholder="Jane" required autoComplete="given-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qi-last">Last name</Label>
                  <Input id="qi-last" value={lastName} onChange={e => setLastName(e.target.value)}
                    placeholder="Smith" autoComplete="family-name" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qi-email">Email</Label>
                <Input id="qi-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="jane@example.com" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qi-phone">Phone <span className="text-muted-foreground font-normal">(for technician updates)</span></Label>
                <Input id="qi-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 555-0100" autoComplete="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qi-password">Password</Label>
                <Input id="qi-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters" required autoComplete="new-password" />
              </div>

              <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account…</> : "Set Up My Account →"}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="underline underline-offset-4 hover:text-primary">Sign in here</a>
              {" "}— your quote will be linked automatically.
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default QuoteInvitePage;
