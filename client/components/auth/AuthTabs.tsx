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

    try {
      setIsSubmitting(true);
      await login({ email: loginEmail, password: loginPassword });
      toast({ title: "Welcome back", description: "You’re now signed in to your customer portal." });
      onSuccess?.("login");
    } catch (error) {
      toast({
        title: "Unable to sign in",
        description: error instanceof Error ? error.message : "We couldn’t verify those details.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (invalidSignupReason) {
      toast({ title: "Update your details", description: invalidSignupReason });
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp({ name: signupName, email: signupEmail, password: signupPassword });
      toast({ title: "Account created", description: "You can now manage visits, invoices, and videos." });
      onSuccess?.("signup");
    } catch (error) {
      toast({
        title: "Unable to create account",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
  );
};

export default AuthTabs;
