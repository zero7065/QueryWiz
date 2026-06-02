/**
 * In-memory rate limiting utility for QueryWiz API
 * Implements standard sliding window rate limits:
 * - 10 requests per minute
 * - 100 requests per day per IP
 */
import { Request, Response, NextFunction } from "express";

interface LimitStore {
  [ip: string]: {
    requestsThisMinute: { timestamp: number }[];
    requestsThisDay: { timestamp: number }[];
  };
}

const store: LimitStore = {};

const WINDOW_MIN_MS = 60 * 1000;
const WINDOW_DAY_MS = 24 * 60 * 60 * 1000;

const MAX_PER_MIN = Number(process.env.RATE_LIMIT_MAX_PER_WINDOW) || 10;
const MAX_PER_DAY = Number(process.env.RATE_LIMIT_MAX_PER_DAY) || 100;

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Try to grab IP from headers standard in cloud/proxy configurations
  const ip = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "anonymous").split(",")[0].trim();
  const now = Date.now();

  if (!store[ip]) {
    store[ip] = {
      requestsThisMinute: [],
      requestsThisDay: [],
    };
  }

  const clientLimit = store[ip];

  // Clean stale tokens
  clientLimit.requestsThisMinute = clientLimit.requestsThisMinute.filter(
    (item) => now - item.timestamp < WINDOW_MIN_MS
  );
  clientLimit.requestsThisDay = clientLimit.requestsThisDay.filter(
    (item) => now - item.timestamp < WINDOW_DAY_MS
  );

  // Check minute limit
  if (clientLimit.requestsThisMinute.length >= MAX_PER_MIN) {
    res.status(429).json({
      error: "Too many requests — you are limited to 10 queries per minute.",
      status: "rate_limited"
    });
    return;
  }

  // Check day limit
  if (clientLimit.requestsThisDay.length >= MAX_PER_DAY) {
    res.status(429).json({
      error: "Daily limit reached — you are limited to 100 queries per day.",
      status: "rate_limited"
    });
    return;
  }

  // Add token timestamps
  clientLimit.requestsThisMinute.push({ timestamp: now });
  clientLimit.requestsThisDay.push({ timestamp: now });

  next();
}
