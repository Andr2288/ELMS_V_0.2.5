// backend/src/routes/category.route.js

import express from "express";

import categoryController from "../controllers/category.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// Get all categories for user
router.get("/", authMiddleware.protectRoute, categoryController.getCategories);

// Create new category
router.post("/", authMiddleware.protectRoute, categoryController.createCategory);

// Update category
router.put("/:id", authMiddleware.protectRoute, categoryController.updateCategory);

// Delete category
router.delete("/:id", authMiddleware.protectRoute, categoryController.deleteCategory);

// Get category with its flashcards
router.get("/:id/flashcards", authMiddleware.protectRoute, categoryController.getCategoryWithFlashcards);

// Move flashcards between categories
router.post("/move-flashcards", authMiddleware.protectRoute, categoryController.moveFlashcards);

export default router;