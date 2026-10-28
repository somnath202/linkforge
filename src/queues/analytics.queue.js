import { Queue } from "bullmq";

const redisUrl = new URL(
  process.env.REDIS_URL || "redis://127.0.0.1:6379"
);
 
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  ...(redisUrl.password
    ? { password: decodeURIComponent(redisUrl.password) }
    : {}),
  ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
};

export const analyticsQueue = new Queue("analytics", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});