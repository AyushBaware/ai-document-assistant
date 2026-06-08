import express from "express";

import { generateAIResponse } from "../controllers/aiController.js";

const router = express.Router();

router.post("/generate", generateAIResponse);

export default router;
