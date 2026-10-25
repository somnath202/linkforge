import Url from "../models/Url.js";
import generateCode from "../utils/generateCode.js";
import redisClient from "../config/redis.js";
import ClickEvent from "../models/ClickEvent.js";

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

    // const shortCode = generateCode();

    // const savedUrl = await Url.create({
    //   originalUrl: parsedUrl.toString(),
    //   shortCode,
    // });


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

    // 2. Cache miss, or Redis unavailable: query MongoDB.
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

      // 3. Cache successful lookups for one hour.
      if (cacheAvailable && redisClient.isReady) {
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

    // 4. Redirect without waiting for analytics.
    await ClickEvent.create({
      shortCode: code,
      referrer: req.get("referer") || null,
      userAgent: req.get("user-agent") || null,
    });

    return res.redirect(302, originalUrl);
  } catch (error) {
    next(error);
  }
}
