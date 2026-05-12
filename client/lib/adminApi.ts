import { supabase, withTimeout } from "@/lib/supabase";

export class AdminApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export async function adminApi(path: string, method = "GET", body?: unknown, timeoutMs = 10000) {
  const { data: { session } } = await withTimeout(
    supabase.auth.getSession(),
    timeoutMs,
    "Admin session"
  );
  const token = session?.access_token;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await withTimeout(
      fetch(path, {
        method,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      timeoutMs,
      `Admin request ${path}`
    );

    const text = await res.text();
    let json: any = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new AdminApiError(text, res.status);
      }
    }

    if (!res.ok) {
      throw new AdminApiError(json.error || "Request failed", res.status);
    }

    return json;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AdminApiError(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
