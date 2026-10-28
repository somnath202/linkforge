
import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { connectRedis, default as redisClient } from "./config/redis.js";
import mongoose from "mongoose";
import { createServer } from "node:http";

const PORT = process.env.PORT || 3000;
const server = createServer(app);
 
let shuttingDown = false;

async function startServer() {
  try {
    await connectDB();

    try {
      await connectRedis();
    } catch (error) {
      console.error("Redis unavailable:", error.message);
      // Continue only if your application can safely operate
      // without Redis-backed features.
    }

    server.listen(PORT, () => {
      console.log(`LinkForge running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received. Shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error("Shutdown timed out; forcing exit.");
    process.exit(1);
  }, 10000);

  forceExit.unref();

  try {
    // Stop accepting new HTTP connections.
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    // Close MongoDB connection.
    await mongoose.disconnect();

    // Close Redis if it is connected.
    if (redisClient.isOpen) {
      await redisClient.quit();
    }

    console.log("LinkForge shut down cleanly.");
    process.exitCode = 0;
  } catch (error) {
    console.error("Error during shutdown:", error.message);
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer();
