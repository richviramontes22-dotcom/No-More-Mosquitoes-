import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "nmm-auth-store";

export type UserRole = "admin" | "support" | "customer";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type StoredUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
  createdAt: string;
};

type AuthStore = {
  users: Record<string, StoredUser>;
  currentUserEmail?: string;
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
  logout: () => void;
};

const defaultStore: AuthStore = {
  users: {},
  currentUserEmail: undefined,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

const sanitizeUser = (user: StoredUser | null): AuthUser | null => {
  if (!user) return null;
  const { id, name, email, role } = user;
  return { id, name, email, role };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [store, setStore] = useState<AuthStore>(defaultStore);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AuthStore;
        setStore({
          users: parsed.users ?? {},
          currentUserEmail: parsed.currentUserEmail,
        });
      } catch (error) {
        console.error("Failed to parse auth store", error);
        setStore(defaultStore);
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store, isHydrated]);

  const login = useCallback(async ({ email, password }: LoginInput) => {
    const normalizedEmail = normalizeEmail(email);
    const storedUser = store.users[normalizedEmail];
    if (!storedUser) {
      throw new Error("No account found for that email.");
    }
    if (storedUser.password !== password) {
      throw new Error("Incorrect password. Try again or reset it.");
    }

    setStore((previous) => ({
      ...previous,
      currentUserEmail: normalizedEmail,
    }));
  }, [store.users]);

  const signUp = useCallback(async ({ name, email, password }: SignUpInput) => {
    const normalizedEmail = normalizeEmail(email);
    if (store.users[normalizedEmail]) {
      throw new Error("An account with that email already exists.");
    }

    const isFirstUser = Object.keys(store.users).length === 0;

    const newUser: StoredUser = {
      id: createId(),
      name: name.trim(),
      email: normalizedEmail,
      role: isFirstUser ? "admin" : "customer",
      password,
      createdAt: new Date().toISOString(),
    };

    setStore((previous) => ({
      users: {
        ...previous.users,
        [normalizedEmail]: newUser,
      },
      currentUserEmail: normalizedEmail,
    }));
  }, [store.users]);

  const logout = useCallback(() => {
    setStore((previous) => ({
      ...previous,
      currentUserEmail: undefined,
    }));
  }, []);

  const currentUser = useMemo(() => {
    if (!store.currentUserEmail) return null;
    return store.users[store.currentUserEmail] ?? null;
  }, [store.currentUserEmail, store.users]);

  const value = useMemo<AuthContextValue>(() => ({
    user: sanitizeUser(currentUser),
    isAuthenticated: Boolean(currentUser),
    isHydrated,
    login,
    signUp,
    logout,
  }), [currentUser, login, logout, signUp, isHydrated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
