import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { clearEmployeeCache } from "@/lib/employee/offlineCache";

export type UserRole = "admin" | "support" | "customer";

/**
 * AuthUser represents the minimal auth identity derived from Supabase session/JWT.
 * Profile data is NOT included here. Use useProfile() hook for profile enrichment.
 */
export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  // Note: card_brand, card_last4, card_expiry, phone come from profile, not auth
  // Use useProfile() hook to fetch and enrich this user with profile data if needed
};

type LoginInput = {
  email: string;
  password: string;
};

type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Convert Supabase User to minimal AuthUser (session/JWT only, no profile enrichment)
 */
const createAuthUserFromSession = (supabaseUser: SupabaseUser): AuthUser => {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    name: supabaseUser.user_metadata?.name || supabaseUser.email?.split("@")[0] || "User",
    role: (supabaseUser.user_metadata?.role as UserRole) || "customer",
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  /**
   * SECTION 1: Minimal deterministic auth bootstrap
   * This only initializes session/auth state, NOT profile data.
   * Profile fetching is done separately via useProfile() hook.
   */
  useEffect(() => {
    if (!supabase) {
      if (import.meta.env.DEV) console.log("[Auth] Supabase client not available");
      setIsInitializing(false);
      setIsHydrated(true);
      return;
    }

    if (import.meta.env.DEV) console.log("[Auth] bootstrap started");

    let isMounted = true;

    // Get initial session state
    const checkInitialSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (isMounted) {
          if (data.session?.user) {
            const authUser = createAuthUserFromSession(data.session.user);
            if (import.meta.env.DEV) console.log("[Auth] user set from session");
            setUser(authUser);
          }
        }
      } catch (err) {
        console.error("[Auth] initial session check failed:", err);
      } finally {
        if (isMounted) {
          if (import.meta.env.DEV) console.log("[Auth] bootstrap completed");
          setIsInitializing(false);
          setIsHydrated(true);
        }
      }
    };

    checkInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      // PASSWORD_RECOVERY is a temporary session used only by the reset-password page.
      // Do NOT treat it as a regular sign-in — the ResetPassword component handles it
      // separately via its own onAuthStateChange listener. If we set the user here,
      // isAuthenticated becomes true and other components may redirect away from /reset-password.
      if (event === "PASSWORD_RECOVERY") return;

      if (session?.user) {
        const authUser = createAuthUserFromSession(session.user);
        setUser(authUser);
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password }: LoginInput) => {
    if (!supabase) throw new Error("Authentication service is currently unavailable.");

    // Block test accounts on the live site — they only exist on localhost
    if (import.meta.env.PROD && normalizeEmail(email).endsWith("@test.com")) {
      throw new Error("Test accounts are for localhost only and cannot log in on the live site.");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signUp = useCallback(async ({ firstName, lastName, email, phone, password }: SignUpInput) => {
    if (!supabase) throw new Error("Authentication service is currently unavailable.");
    const normalizedEmail = normalizeEmail(email);

    // ── Test account fast-path (localhost dev only) ───────────────────────────
    // For @test.com emails in dev: skip supabase.auth.signUp() entirely.
    // That call triggers Supabase to send a confirmation email, which hits
    // the email rate limit (429). Instead, we call a server-side endpoint that
    // uses the admin API to create the user with email_confirm:true — no email sent.
    if (import.meta.env.DEV && normalizedEmail.endsWith("@test.com")) {
      const res = await fetch("/api/dev/create-test-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email: normalizedEmail, phone, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create test account");
      }
      // Auto sign-in — account is already confirmed
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInErr) throw new Error(signInErr.message);
      return; // Done — skip the normal signUp flow below
    }

    // ── Normal signup path ────────────────────────────────────────────────────
    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name:       displayName,
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
          role:       "customer",
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      try {
        const { data: profilesCount } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        const isFirstUser = !profilesCount || profilesCount.length === 0;

        await supabase.from("profiles").insert({
          id:         data.user.id,
          name:       displayName,
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
          email:      normalizedEmail,
          phone:      phone.trim() || null,
          role:       isFirstUser ? "admin" : "customer",
        });

        if (isFirstUser) {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { role: "admin" }
          });
          if (updateError) {
            console.warn("Failed to update auth metadata role:", updateError);
          }
        }
      } catch (profileError) {
        console.warn("Profile creation skipped or failed:", profileError);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);

    if (!supabase) {
      return;
    }

    try {
      // Sign out from Supabase - this removes the session token
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.error("Error signing out from Supabase:", error.message);
      }

      // Clear session data from localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("sb-auth-session");
          localStorage.removeItem("sb-qamfxqbtvwwlzlmqrqbh-auth-token");
          sessionStorage.clear();
          // Technician offline cache — never leave a previous employee's
          // cached route/assignment data reachable by whoever signs in next
          // on this device.
          clearEmployeeCache();
        } catch (e) {
          console.warn("Could not clear auth storage:", e);
        }
      }
    } catch (err) {
      console.error("Logout cleanup error:", err);
    }
  }, []);

  // Mark as hydrated after initial session bootstrap completes
  useEffect(() => {
    if (!isInitializing) {
      if (import.meta.env.DEV) console.log("[Auth] auth ready true");
    }
  }, [isInitializing]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isHydrated: isHydrated && !isInitializing,
    isLoading: isInitializing,
    login,
    signUp,
    logout,
  }), [user, login, logout, signUp, isHydrated, isInitializing]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
