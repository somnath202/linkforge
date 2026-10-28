
import { Router } from "express";
import { getLinkAnalytics } from "../controllers/analytics.controller.js";

const router = Router();

router.get("/:code/analytics", getLinkAnalytics);

export default router;
