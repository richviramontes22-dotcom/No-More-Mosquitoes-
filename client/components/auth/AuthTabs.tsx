import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isValidEmail } from "@/lib/forms";

const MIN_PASSWORD_LENGTH = 8;

type Mode = "login" | "signup";

type AuthTabsProps = {
  defaultMode?: Mode;
  defaultEmail?: string;
  defaultName?: string;
  onSuccess?: (mode: Mode) => void;
};

const AuthTabs = ({ defaultMode = "login", defaultEmail = "", defaultName = "", onSuccess }: AuthTabsProps) => {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState(defaultEmail);
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState(defaultName);
  const [signupEmail, setSignupEmail] = useState(defaultEmail);
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  const { toast } = useToast();
  const { login, signUp } = useAuth();

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    if (defaultEmail) {
      setLoginEmail(defaultEmail);
      setSignupEmail(defaultEmail);
    }
    if (defaultName) {
      setSignupName(defaultName);
    }
  }, [defaultEmail, defaultName]);

  const invalidSignupReason = useMemo(() => {
    if (!signupName.trim()) return "Add your name";
    if (!isValidEmail(signupEmail)) return "Enter a valid email";
    if (signupPassword.trim().length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
    if (signupPassword !== signupConfirmPassword) return "Passwords must match";
    return null;
  }, [signupConfirmPassword, signupEmail, signupName, signupPassword]);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidEmail(loginEmail)) {
      toast({ title: "Enter a valid email", description: "We use your email to locate your portal." });
      return;
    }
    if (loginPassword.trim().length < MIN_PASSWORD_LENGTH) {
      toast({ title: "Check your password", description: `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`, variant: "destructive" });
      return;
    }

    // Safety timeout to reset if Supabase hangs
    const timeoutId = setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Request taking longer than expected",
        description: "Please check your internet connection or try refreshing.",
        variant: "destructive",
      });
    }, 10000);

    try {
      setIsSubmitting(true);
      await login({ email: loginEmail, password: loginPassword });
      clearTimeout(timeoutId);
      toast({ title: "Welcome back", description: "You're now signed in to your portal." });
      onSuccess?.("login");
    } catch (error) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : "We couldn't verify those details.";
      const isEmailNotConfirmed = message.toLowerCase().includes("confirm") || message.toLowerCase().includes("verify");
      toast({
        title: isEmailNotConfirmed ? "Email confirmation required" : "Unable to sign in",
        description: isEmailNotConfirmed
          ? "Please check your inbox and confirm your email before signing in."
          : message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invalidSignupReason) {
      toast({ title: "Update your details", description: invalidSignupReason, variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp({ name: signupName, email: signupEmail, password: signupPassword });
      toast({
        title: "Account created",
        description: "Check your inbox to confirm your email, then sign in.",
      });
      onSuccess?.("signup");
      setMode("login");
    } catch (error) {
      toast({
        title: "Unable to create account",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const useCustomerAccount = () => {
    if (mode === "login") {
      setLoginEmail("johndoe@test.com");
      setLoginPassword("TestCustomer123!");
      toast({ title: "Customer credentials filled", description: "Click 'Sign in' to proceed." });
    } else {
      setSignupName("John Doe");
      setSignupEmail("johndoe@test.com");
      setSignupPassword("TestCustomer123!");
      setSignupConfirmPassword("TestCustomer123!");
      toast({ title: "Customer credentials filled", description: "Click 'Create account' to proceed." });
    }
  };

  const useAdminAccount = () => {
    if (mode === "login") {
      setLoginEmail("admin@nnm.com");
      setLoginPassword("Password!");
      toast({ title: "Admin credentials filled", description: "Click 'Sign in' to proceed." });
    } else {
      setSignupName("Admin User");
      setSignupEmail("admin@nnm.com");
      setSignupPassword("Password!");
      setSignupConfirmPassword("Password!");
      toast({ title: "Admin credentials filled", description: "Click 'Create account' to proceed." });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="grid w-full grid-cols-2 bg-muted/50">
          <TabsTrigger value="login" className="rounded-lg">Sign in</TabsTrigger>
          <TabsTrigger value="signup" className="rounded-lg">Create account</TabsTrigger>
        </TabsList>

        {/* ── Login Tab ── */}
        <TabsContent value="login" className="mt-6">
          <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email address</Label>
              <Input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="rounded-xl h-11"
                aria-describedby="login-email-desc"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                {/* Forgot password — always visible, right-aligned for quick access */}
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                  tabIndex={0}
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="rounded-xl h-11"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full shadow-brand mt-2"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  Signing in…
                </span>
              ) : "Sign in"}
            </Button>
          </form>
        </TabsContent>

        {/* ── Sign Up Tab ── */}
        <TabsContent value="signup" className="mt-6">
          <form onSubmit={handleSignupSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="signup-name">Full name</Label>
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Taylor Johnson"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                required
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email">Email address</Label>
              <Input
                id="signup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="8+ characters"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-confirm">Confirm password</Label>
              <Input
                id="signup-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={signupConfirmPassword}
                onChange={(e) => setSignupConfirmPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="rounded-xl h-11"
              />
            </div>

            {invalidSignupReason && signupConfirmPassword.length > 0 && (
              <p className="text-xs text-destructive" role="alert">{invalidSignupReason}</p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full rounded-full shadow-brand mt-2"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                  Creating account…
                </span>
              ) : "Create account"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {/* Development-only: test credential shortcuts — stripped from production builds */}
      {import.meta.env.DEV && (
        <div className="space-y-2 pt-2">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Dev Only</span>
            </div>
          </div>
          <Button variant="outline" className="w-full border-dashed text-xs" onClick={useCustomerAccount}>
            [Dev] Fill Customer Credentials
          </Button>
          <Button variant="outline" className="w-full border-dashed text-xs" onClick={useAdminAccount}>
            [Dev] Fill Admin Credentials
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuthTabs;
