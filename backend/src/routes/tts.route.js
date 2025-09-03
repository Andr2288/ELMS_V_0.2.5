// backend/src/routes/tts.route.js - ОНОВЛЕНА ВЕРСІЯ

import express from "express";

import ttsController from "../controllers/tts.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// Generate speech with user settings and automatic key selection
router.post("/speech", authMiddleware.protectRoute, ttsController.generateSpeech);

// Test TTS with current settings and API key
router.get("/test-current", authMiddleware.protectRoute, ttsController.testTTSWithCurrentSettings);

// Check available models with current API key
router.get("/models", authMiddleware.protectRoute, ttsController.checkAvailableModels);

// Clear audio cache
router.post("/clear-cache", authMiddleware.protectRoute, ttsController.clearAudioCache);

// ДОДАНО: Get cache statistics
router.get("/cache-stats", authMiddleware.protectRoute, ttsController.getCacheStats);

export default router;