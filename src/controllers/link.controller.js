import Url from "../models/Url.js";
import generateCode from "../utils/generateCode.js";

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

    const shortCode = generateCode();

    const savedUrl = await Url.create({
      originalUrl: parsedUrl.toString(),
      shortCode,
    });

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

    return res.redirect(302, url.originalUrl);
  } catch (error) {
    next(error);
  }
}