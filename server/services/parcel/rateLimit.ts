import type { Request } from "express";

// Simple in-memory rate limiter — resets on server restart.
// For production scale, swap the map for a Redis INCR + EXPIRE.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const ANON_LIMIT = parseInt(process.env.PARCEL_RATE_LIMIT_ANON_PER_HOUR ?? "20", 10);
const AUTH_LIMIT = parseInt(process.env.PARCEL_RATE_LIMIT_AUTH_PER_HOUR ?? "100", 10);
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown"
  );
}

function isAuthenticated(req: Request): boolean {
  // The Authorization header is set by the Supabase client for authenticated calls.
  return !!req.headers.authorization;
}

export function checkRateLimit(req: Request): { allowed: boolean; retryAfterMs: number } {
  const key = isAuthenticated(req) ? `auth:${getIp(req)}` : `anon:${getIp(req)}`;
  const limit = isAuthenticated(req) ? AUTH_LIMIT : ANON_LIMIT;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count++;

  if (bucket.count > limit) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }
  return { allowed: true, retryAfterMs: 0 };
}

// Prune expired buckets every 10 minutes to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 10 * 60 * 1000);
