import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import linkRoutes from "./routes/link.routes.js";
import { redirectToOriginalUrl } from "./controllers/link.controller.js";
import errorHandler from "./middleware/errorHandler.js";
import analyticsRoutes from "./routes/analytics.routes.js";

const app = express();
  
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(morgan("dev"));


app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1/links", linkRoutes);
app.use("/api/v1/links", analyticsRoutes);

// Keep this after API routes.
app.get("/:code", redirectToOriginalUrl);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

export default app;