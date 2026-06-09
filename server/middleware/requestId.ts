/**
 * Request ID middleware.
 *
 * Attaches a UUID requestId to every inbound request so that logs,
 * checkpoints, and error responses are traceable end-to-end.
 *
 * - Accepts x-request-id header from trusted callers (client retry logic, LBs)
 * - Generates a fresh UUID if none is provided or the provided one is invalid
 * - Returns x-request-id in every response header
 */

import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

// Extend Express Request to carry requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"];
  const valid = typeof incoming === "string" && UUID_RE.test(incoming);
  req.requestId = valid ? (incoming as string) : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
