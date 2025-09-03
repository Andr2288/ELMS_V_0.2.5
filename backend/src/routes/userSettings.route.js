// backend/src/routes/userSettings.route.js - ДОДАНО НОВІ ENDPOINTS

import express from "express";

import userSettingsController from "../controllers/userSettings.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// Get user settings
router.get("/", authMiddleware.protectRoute, userSettingsController.getUserSettings);

// Update user settings
router.put("/", authMiddleware.protectRoute, userSettingsController.updateUserSettings);

// Reset settings to default
router.post("/reset", authMiddleware.protectRoute, userSettingsController.resetUserSettings);

// Get available options for dropdowns
router.get("/options", authMiddleware.protectRoute, userSettingsController.getAvailableOptions);

// Test API key
router.post("/test-api-key", authMiddleware.protectRoute, userSettingsController.testApiKey);

// Clear user API key
router.delete("/api-key", authMiddleware.protectRoute, userSettingsController.clearUserApiKey);

// ДОДАНО: Отримання статистики налаштувань
router.get("/stats", authMiddleware.protectRoute, userSettingsController.getSettingsStats);

// ДОДАНО: Міграція всіх користувачів (тільки для адміністрування)
// В реальному додатку тут має бути додаткова middleware для перевірки прав адміністратора
router.post("/migrate-all", authMiddleware.protectRoute, userSettingsController.migrateAllUsersSettings);

export default router;