import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";

export type UserRole = "admin" | "support" | "customer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  card_brand?: string;
  card_last4?: string;
  card_expiry?: string;
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

    // Wait for Supabase to be ready
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", supabaseUser.id)
        .single();

      if (error) {
        // If it's a "Failed to fetch" error, retry once after a short delay
        if (error.message.includes("Failed to fetch")) {
          await new Promise(res => setTimeout(res, 1000));
          const retry = await supabase
            .from("profiles")
            .select("*")
            .eq("id", supabaseUser.id)
            .single();
          if (retry.error) return null;
          return retry.data as AuthUser;
        }
        return null;
      }

      return data as AuthUser;
    } catch (err) {
      console.warn("Profile fetch failed:", err);
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
            phone: session.user.phone || "",
            card_brand: session.user.user_metadata?.card_brand,
            card_last4: session.user.user_metadata?.card_last4,
            card_expiry: session.user.user_metadata?.card_expiry,
          };

          setUser(prev => {
            if (JSON.stringify(prev) === JSON.stringify(metaUser)) return prev;
            return metaUser;
          });

          // 2. Fetch full profile in the background
          fetchProfile(session.user).then(profile => {
            if (profile) {
              setUser(prev => {
                if (JSON.stringify(prev) === JSON.stringify(profile)) return prev;
                return profile;
              });
            }
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
          phone: session.user.phone || "",
          card_brand: session.user.user_metadata?.card_brand,
          card_last4: session.user.user_metadata?.card_last4,
          card_expiry: session.user.user_metadata?.card_expiry,
        };

        setUser(prev => {
          if (JSON.stringify(prev) === JSON.stringify(metaUser)) return prev;
          return metaUser;
        });

        const profile = await fetchProfile(session.user);
        if (profile) {
          setUser(prev => {
            if (JSON.stringify(prev) === JSON.stringify(profile)) return prev;
            return profile;
          });
        }
      } else {
        setUser(prev => {
          if (prev === null) return prev;
          return null;
        });
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
