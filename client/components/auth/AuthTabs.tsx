import { FormEvent, useEffect, useMemo, useState } from "react";

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
  onSuccess?: (mode: Mode) => void;
};

const AuthTabs = ({ defaultMode = "login", onSuccess }: AuthTabsProps) => {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  const { toast } = useToast();
  const { login, signUp } = useAuth();

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

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
      toast({ title: "Check your password", description: `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }

    // Safety timeout to reset the button if Supabase hangs
    const timeoutId = setTimeout(() => {
      if (isSubmitting) {
        setIsSubmitting(false);
        toast({
          title: "Request taking longer than expected",
          description: "Please check your internet connection or try refreshing the page.",
          variant: "destructive"
        });
      }
    }, 10000);

    try {
      setIsSubmitting(true);
      await login({ email: loginEmail, password: loginPassword });
      clearTimeout(timeoutId);
      toast({ title: "Welcome back", description: "You’re now signed in to your customer portal." });
      onSuccess?.("login");
    } catch (error) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : "We couldn’t verify those details.";
      const isEmailNotConfirmed = message.toLowerCase().includes("confirm") || message.toLowerCase().includes("verify");

      toast({
        title: isEmailNotConfirmed ? "Email confirmation required" : "Unable to sign in",
        description: isEmailNotConfirmed
          ? "Please check your inbox or confirm the user in your Supabase dashboard."
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
        title: "Account Created",
        description: "You might need to confirm your email before logging in. Check your inbox or the Supabase dashboard."
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

  const useDemoAccount = async () => {
    if (mode === "login") {
      setLoginEmail("Admin@nnm.com");
      setLoginPassword("Password!");
      toast({ title: "Login Filled", description: "Click 'Sign in' to proceed." });
    } else {
      setSignupName("Admin User");
      setSignupEmail("Admin@nnm.com");
      setSignupPassword("Password!");
      setSignupConfirmPassword("Password!");
      toast({ title: "Signup Filled", description: "Click 'Create account' to proceed." });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="login">Log in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
        </TabsList>
        <TabsContent value="login" className="mt-8">
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="signup" className="mt-8">
          <form onSubmit={handleSignupSubmit} className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="signup-name">Full name</Label>
              <Input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Taylor Johnson"
                value={signupName}
                onChange={(event) => setSignupName(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(event) => setSignupEmail(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a password"
                value={signupPassword}
                onChange={(event) => setSignupPassword(event.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="signup-confirm-password">Confirm password</Label>
              <Input
                id="signup-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={signupConfirmPassword}
                onChange={(event) => setSignupConfirmPassword(event.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Internal Testing</span>
        </div>
      </div>

      <Button variant="outline" className="w-full border-dashed" onClick={useDemoAccount}>
        Use Test Credentials
      </Button>
    </div>
  );
};

export default AuthTabs;
