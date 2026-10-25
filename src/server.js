
import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    try {
      await connectRedis();
    } catch (error) {
      console.error(
        "Redis unavailable; continuing without cache:",
        error.message
      );
    }
 
    app.listen(PORT, () => {
      console.log(`LinkForge running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
