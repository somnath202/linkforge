
import "dotenv/config";
import { Worker } from "bullmq";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import ClickEvent from "../models/ClickEvent.js";

const redisUrl = new URL(
  process.env.REDIS_URL || "redis://127.0.0.1:6379"
);

const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  ...(redisUrl.password
    ? { password: decodeURIComponent(redisUrl.password) }
    : {}),
  ...(redisUrl.protocol === "rediss:"
    ? { tls: {} }
    : {}),
};

let worker;
let shuttingDown = false;

async function startWorker() {
  await connectDB();

  worker = new Worker(
    "analytics",
    async (job) => {
      if (job.name !== "record-click") {
        throw new Error(`Unknown analytics job: ${job.name}`);
      }

      await ClickEvent.updateOne(
        { eventId: job.data.eventId },
        {
          $setOnInsert: {
            eventId: job.data.eventId,
            shortCode: job.data.shortCode,
            referrer: job.data.referrer || null,
            userAgent: job.data.userAgent || null,
          },
        },
        { upsert: true }
      );

      // Avoid logging every click under heavy load.
      if (job.attemptsMade === 0) {
        console.log(`Recorded click for ${job.data.shortCode}`);
      }
    },
    {
      connection,
      concurrency: 5,
    }
  );

  worker.on("failed", (job, error) => {
    console.error(`Analytics job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Analytics worker error:", error.message);
  });

  console.log("Analytics worker started");
}

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received. Shutting down worker...`);

  const forceExit = setTimeout(() => {
    console.error("Worker shutdown timed out.");
    process.exit(1);
  }, 15000);

  forceExit.unref();

  try {
    if (worker) {
      // Stop fetching new jobs and wait for active jobs to finish.
      await worker.close();
    }

    await mongoose.disconnect();

    console.log("Analytics worker shut down cleanly.");
    process.exitCode = 0;
  } catch (error) {
    console.error("Worker shutdown failed:", error.message);
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startWorker().catch(async (error) => {
  console.error("Failed to start analytics worker:", error.message);
  await mongoose.disconnect().catch(() => { });
  process.exitCode = 1;
});
