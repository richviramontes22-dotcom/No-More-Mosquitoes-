import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Account {
  label: string;
  email: string;
  password: string;
  badge?: string;
  badgeColor?: string;
}

const DEV_ACCOUNTS: Account[] = [
  {
    label: "Test Employee",
    email: "hj@test.com",
    password: "BmBJBKtbCaBPN6",
    badge: "TEST",
    badgeColor: "bg-amber-100 text-amber-700 border-amber-300",
  },
];

/** Dev-only quick login panel. Hidden in production (import.meta.env.DEV guard). */
export function DevQuickLogin() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!import.meta.env.DEV) return null;

  const handleLogin = async (account: Account) => {
    setLoading(account.email);
    setError(null);
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (signInErr) {
      setError(signInErr.message);
      setLoading(null);
    }
    // On success the auth context updates and the parent page redirects
  };

  return (
    <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-center">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-amber-700">
        Dev — Quick Login
      </p>
      <div className="flex flex-col gap-2">
        {DEV_ACCOUNTS.map((acc) => (
          <button
            key={acc.email}
            onClick={() => handleLogin(acc)}
            disabled={loading === acc.email}
            className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-amber-50 disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              {acc.badge && (
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${acc.badgeColor}`}>
                  {acc.badge}
                </span>
              )}
              <span className="font-medium text-foreground">{acc.label}</span>
              <span className="text-xs text-muted-foreground">{acc.email}</span>
            </span>
            <span className="text-xs font-semibold text-amber-700">
              {loading === acc.email ? "Logging in…" : "Login →"}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
