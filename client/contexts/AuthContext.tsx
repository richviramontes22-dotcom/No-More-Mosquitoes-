import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";

export type UserRole = "admin" | "support" | "customer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type LoginInput = {
  email: string;
  password: string;
};

type SignUpInput = {
  name: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (input: LoginInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const fetchProfile = useCallback(async (supabaseUser: SupabaseUser) => {
    if (!supabase) return null;

    // Short timeout for profile fetch (3s) to prevent blocking the UI
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Profile fetch timeout")), 3000)
    );

    try {
      const profilePromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", supabaseUser.id)
        .single();

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;

      if (error) {
        // This is expected if the user just signed up and the profile isn't in DB yet
        return null;
      }

      return data as AuthUser;
    } catch (err) {
      // We don't log this as an error anymore because we have a reliable fallback
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsHydrated(true);
      return;
    }

    // Initial session check
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // 1. Immediately set user from metadata so the UI is responsive
          const metaUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.name || "User",
            role: (session.user.user_metadata?.role as UserRole) || "customer",
          };
          setUser(metaUser);

          // 2. Fetch full profile in the background
          fetchProfile(session.user).then(profile => {
            if (profile) setUser(profile);
          });
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        // Always mark as hydrated so the app can render
        setIsHydrated(true);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const metaUser: AuthUser = {
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || "User",
          role: (session.user.user_metadata?.role as UserRole) || "customer",
        };
        setUser(metaUser);

        const profile = await fetchProfile(session.user);
        if (profile) setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = useCallback(async ({ email, password }: LoginInput) => {
    if (!supabase) throw new Error("Authentication service is currently unavailable.");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }, []);

  const signUp = useCallback(async ({ name, email, password }: SignUpInput) => {
    if (!supabase) throw new Error("Authentication service is currently unavailable.");
    const normalizedEmail = normalizeEmail(email);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: name.trim(),
          role: "customer", // Default to customer, first user logic handled in profiles
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      // Try to create profile, but don't fail signup if it fails (e.g. table not created yet)
      try {
        const { data: profilesCount } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        const isFirstUser = !profilesCount || profilesCount.length === 0;

        await supabase.from("profiles").insert({
          id: data.user.id,
          name: name.trim(),
          email: normalizedEmail,
          role: isFirstUser ? "admin" : "customer",
        });
      } catch (profileError) {
        console.warn("Profile creation skipped or failed:", profileError);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isHydrated,
    login,
    signUp,
    logout,
  }), [user, login, logout, signUp, isHydrated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
