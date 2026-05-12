import { supabase, withTimeout } from "@/lib/supabase";

export type FormStatus = "idle" | "submitting" | "success" | "error";

export type SubmissionResult = {
  status: FormStatus;
  message?: string;
};

export const emptySubmissionResult: SubmissionResult = { status: "idle" };

export async function postJson<TResponse = unknown>(endpoint: string, payload: unknown): Promise<TResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add authorization header if session exists
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }

  const response = await withTimeout(fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }), 10000, `POST ${endpoint}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request to ${endpoint} failed with status ${response.status}`);
  }

  try {
    return (await response.json()) as TResponse;
  } catch (error) {
    return undefined as TResponse;
  }
}

export const isValidEmail = (value: string) => /.+@.+\..+/.test(value.trim());
export const isValidPhone = (value: string) => /^(\+1)?\s*\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}$/.test(value.trim());
