// backend/src/routes/openai.route.js

import express from "express";

import openaiController from "../controllers/openai.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// Generate flashcard content with AI
router.post("/generate-flashcard", authMiddleware.protectRoute, openaiController.generateFlashcardContent);

// Regenerate examples for existing flashcard
router.post("/regenerate-examples/:id", authMiddleware.protectRoute, openaiController.regenerateExamples);

export default router;