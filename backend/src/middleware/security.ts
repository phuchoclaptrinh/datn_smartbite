import type { NextFunction, Request, Response } from 'express';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const windowMs = 60_000;
const maxRequests = 120;

const getClientIp = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';

export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
};

export const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    next();
    return;
  }

  const now = Date.now();
  const key = getClientIp(req);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  existing.count += 1;
  if (existing.count > maxRequests) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({ message: 'Too many requests' });
    return;
  }

  next();
};

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, windowMs).unref();
