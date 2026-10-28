import Url from "../models/Url.js";
import generateCode from "../utils/generateCode.js";
import redisClient from "../config/redis.js";
// import ClickEvent from "../models/ClickEvent.js";    no longer needed since we are using a queue for analytics
import { analyticsQueue } from "../queues/analytics.queue.js";
import { randomUUID } from "node:crypto";
import { createLinkLimiter } from "../middleware/rateLimiter.js";
import { Router } from "express";
 
const router = Router();

// Rate limiter runs before the controller.
router.post("/", createLinkLimiter, createShortUrl);

export default router;

export async function createShortUrl(req, res, next) {
  try {
    const { originalUrl } = req.body;

    if (typeof originalUrl !== "string" || !originalUrl.trim()) {
      return res.status(400).json({
        error: "originalUrl is required",
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      return res.status(400).json({
        error: "Invalid URL",
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        error: "Only HTTP and HTTPS URLs are supported",
      });
    }


    let savedUrl;

    for (let attempt = 0; attempt < 3; attempt++) {
      const shortCode = generateCode();

      try {
        savedUrl = await Url.create({
          originalUrl: parsedUrl.toString(),
          shortCode,
        });

        break;
      } catch (error) {
        // Retry only when the shortCode unique index caused the conflict.
        if (
          error.code === 11000 &&
          error.keyPattern?.shortCode &&
          attempt < 2
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!savedUrl) {
      return res.status(503).json({
        error: "Unable to generate a unique short code. Please retry.",
      });
    }


    return res.status(201).json({
      originalUrl: savedUrl.originalUrl,
      shortCode: savedUrl.shortCode,
      shortUrl: `${process.env.BASE_URL}/${savedUrl.shortCode}`,
      createdAt: savedUrl.createdAt,
    });
  } catch (error) {
    next(error);
  }
}


export async function redirectToOriginalUrl(req, res, next) {
  try {
    const { code } = req.params;
    const cacheKey = `url:${code}`;

    let originalUrl = null;
    let cacheAvailable = redisClient.isReady;

    // 1. Try Redis first.
    if (cacheAvailable) {
      try {
        originalUrl = await redisClient.get(cacheKey);
      } catch (error) {
        cacheAvailable = false;
        console.error("Redis cache read failed:", error.message);
      }
    }

    // 2. Query MongoDB on a cache miss.
    if (!originalUrl) {
      const url = await Url.findOne({
        shortCode: code,
      }).lean();

      if (!url) {
        return res.status(404).json({
          error: "Short URL not found",
        });
      }

      if (url.expiresAt && url.expiresAt <= new Date()) {
        return res.status(410).json({
          error: "Short URL has expired",
        });
      }

      originalUrl = url.originalUrl;

      // Cache only URLs without an expiration date.
      // This avoids bypassing expiry checks on cached URLs.
      if (!url.expiresAt && cacheAvailable && redisClient.isReady) {
        try {
          const ttl = Number(process.env.REDIS_TTL_SECONDS) || 3600;
          await redisClient.set(cacheKey, originalUrl, {
            EX: ttl,
          });
        } catch (error) {
          console.error("Redis cache write failed:", error.message);
        }
      }
    }

    // 3. Record analytics without allowing its failure
    // to prevent the redirect.
    try {
      await analyticsQueue.add("record-click", {
        eventId: randomUUID(),
        shortCode: code,
        referrer: req.get("referer") || null,
        userAgent: req.get("user-agent") || null,
      });

    } catch (error) {
      console.error("Failed to enqueue click analytics:", error.message);
    }

    // 4. Redirect to the destination.
    return res.redirect(302, originalUrl);
  } catch (error) {
    next(error);
  }
}
