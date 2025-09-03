// backend/src/routes/flashcard.route.js - ОНОВЛЕНО З НОВИМ ENDPOINT ДЛЯ МІГРАЦІЇ

import express from "express";

import flashcardController from "../controllers/flashcard.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// Основні CRUD операції
router.get("/", authMiddleware.protectRoute, flashcardController.getFlashcards);
router.post("/", authMiddleware.protectRoute, flashcardController.createFlashcard);
router.put("/:id", authMiddleware.protectRoute, flashcardController.updateFlashcard);
router.delete("/:id", authMiddleware.protectRoute, flashcardController.deleteFlashcard);

// Групування по категоріях
router.get("/grouped", authMiddleware.protectRoute, flashcardController.getFlashcardsGrouped);

// РОУТИ ДЛЯ ЛОГІКИ ВИВЧЕННЯ

// Обробка результату вправи (підтримує всі типи: основні та додаткові)
router.post("/exercise-result", authMiddleware.protectRoute, flashcardController.handleExerciseResult);

// Отримання слів для конкретної вправи (підтримує всі типи: основні та додаткові)
// ОНОВЛЕНО: Підтримувані типи: sentence-completion, multiple-choice, listen-and-fill, listen-and-choose, dialog, reading-comprehension
router.get("/exercise/:exerciseType", authMiddleware.protectRoute, flashcardController.getWordsForExercise);

// Отримання статистики навчання
router.get("/learning/stats", authMiddleware.protectRoute, flashcardController.getLearningStats);

// Отримання слів з прогресом
router.get("/learning/progress", authMiddleware.protectRoute, flashcardController.getWordsWithProgress);

// Скидання прогресу конкретного слова
router.post("/learning/reset/:id", authMiddleware.protectRoute, flashcardController.resetWordProgress);

// ДОДАНО: Новий endpoint для оновлення карток до останньої версії
router.post("/migrate-to-latest", authMiddleware.protectRoute, flashcardController.migrateFlashcardsToLatestVersion);

export default router;