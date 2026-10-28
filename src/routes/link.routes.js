import { Router } from "express";
import { createShortUrl } from "../controllers/link.controller.js";

const router = Router();

router.post("/", createShortUrl);

export default router; 