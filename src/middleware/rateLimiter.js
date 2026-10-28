
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis.js";

let limiter;

function getLimiter() {
  if (!limiter) {
    limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,

      store: new RedisStore({
        sendCommand: (...args) => {
          if (!redisClient.isReady) {
            throw new Error("Redis is not ready");
          }

          return redisClient.sendCommand(args);
        },
        prefix: "linkforge:rate-limit:",
      }),

      message: {
        error: "Too many URL creation requests. Please try again later.",
      },
    });
  }

  return limiter;
}

export function createLinkLimiter(req, res, next) {
  if (!redisClient.isReady) {
    return res.status(503).json({
      error: "Rate limiting service temporarily unavailable",
    });
  }

  return getLimiter()(req, res, next);
}
