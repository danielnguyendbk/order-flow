import type { NextFunction, Request, Response } from "express";

export function securityHeaders(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
}

interface RateLimitOptions { windowMs: number; max: number; }

/** Bounded in-process guard; keep the API behind a rate-limiting reverse proxy in production. */
export function rateLimit({ windowMs, max }: RateLimitOptions) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const bucket = buckets.get(key);
    const active = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + windowMs };
    active.count += 1;
    buckets.set(key, active);
    response.setHeader("RateLimit-Limit", String(max));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, max - active.count)));
    response.setHeader("RateLimit-Reset", String(Math.ceil(active.resetAt / 1000)));
    if (active.count > max) {
      response.setHeader("Retry-After", String(Math.ceil((active.resetAt - now) / 1000)));
      response.status(429).json({ code: "RATE_LIMITED", message: "Too many requests" });
      return;
    }
    next();
  };
}
