// frontend/src/store/useFlashcardStore.js - ОНОВЛЕНО З ПІДТРИМКОЮ LISTEN-AND-CHOOSE

import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";

// ДОДАНО: Функція для перемішування масиву (Fisher-Yates shuffle)
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const useFlashcardStore = create((set, get) => ({
  flashcards: [],
  isLoading: false,
  currentCategoryFilter: null,
  learningStats: null,

  getFlashcards: async (categoryId = null, status = null) => {
    set({ isLoading: true });
    try {
      let url = "/flashcards";
      const params = new URLSearchParams();

      if (categoryId) {
        params.append('categoryId', categoryId);
      }

      if (status) {
        params.append('status', status);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await axiosInstance.get(url);
      set({
        flashcards: res.data,
        currentCategoryFilter: categoryId
      });
    } catch (error) {
      console.log("Error getting flashcards:", error);
      toast.error("Помилка завантаження карток");
    } finally {
      set({ isLoading: false });
    }
  },

  // ВИПРАВЛЕНО: Змінена логіка додавання нової картки
  createFlashcard: async (flashcardData) => {
    try {
      const submitData = {
        ...flashcardData,
        examples: flashcardData.examples ? flashcardData.examples.filter(ex => ex && ex.trim()) : []
      };

      const res = await axiosInstance.post("/flashcards", submitData);

      const currentFilter = get().currentCategoryFilter;
      const newFlashcard = res.data;

      const shouldAddToList =
          !currentFilter ||
          (currentFilter === 'uncategorized' && !newFlashcard.categoryId) ||
          (newFlashcard.categoryId?._id === currentFilter);

      if (shouldAddToList) {
        // ВИПРАВЛЕНО: Додаємо нову картку в КІНЕЦЬ масиву замість початку
        set({ flashcards: [...get().flashcards, newFlashcard] });
      }

      toast.success("Картку створено!");
      get().refreshLearningStats();

      // ДОДАНО: Повертаємо також індекс нової картки
      const newIndex = shouldAddToList ? get().flashcards.length - 1 : -1;

      return {
        flashcard: res.data,
        newIndex: newIndex
      };
    } catch (error) {
      console.log("Error creating flashcard:", error);

      const message = error.response?.data?.message || "Помилка створення картки";
      toast.error(message);
      throw error;
    }
  },

  updateFlashcard: async (id, flashcardData) => {
    try {
      const submitData = {
        ...flashcardData,
        examples: flashcardData.examples ? flashcardData.examples.filter(ex => ex && ex.trim()) : []
      };

      const res = await axiosInstance.put(`/flashcards/${id}`, submitData);
      const updatedFlashcard = res.data;

      set({
        flashcards: get().flashcards.map((card) =>
            card._id === id ? updatedFlashcard : card
        ),
      });

      const currentFilter = get().currentCategoryFilter;
      const shouldBeInList =
          !currentFilter ||
          (currentFilter === 'uncategorized' && !updatedFlashcard.categoryId) ||
          (updatedFlashcard.categoryId?._id === currentFilter);

      if (!shouldBeInList) {
        set({
          flashcards: get().flashcards.filter((card) => card._id !== id),
        });
      }

      toast.success("Картку оновлено!");
      return res.data;
    } catch (error) {
      console.log("Error updating flashcard:", error);

      const message = error.response?.data?.message || "Помилка оновлення картки";
      toast.error(message);
      throw error;
    }
  },

  deleteFlashcard: async (id) => {
    try {
      await axiosInstance.delete(`/flashcards/${id}`);
      set({
        flashcards: get().flashcards.filter((card) => card._id !== id),
      });

      get().refreshLearningStats();

      toast.success("Картку видалено!");
    } catch (error) {
      console.log("Error deleting flashcard:", error);

      const message = error.response?.data?.message || "Помилка видалення картки";
      toast.error(message);
    }
  },

  getFlashcardsGrouped: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/flashcards/grouped");
      return res.data;
    } catch (error) {
      console.log("Error getting grouped flashcards:", error);
      toast.error("Помилка завантаження карток");
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // ВИПРАВЛЕНО: Спрощена логіка для reading comprehension
  handleExerciseResult: async (flashcardId, exerciseType, isCorrect, usedWordIds = null) => {
    try {
      const requestData = {
        flashcardId,
        exerciseType,
        isCorrect
      };

      // Підтримка кількох слів для reading comprehension
      if (usedWordIds && Array.isArray(usedWordIds) && usedWordIds.length > 0) {
        requestData.usedWordIds = usedWordIds;
        console.log(`📖 Store: Handling exercise result for ${usedWordIds.length} words:`, usedWordIds);
      }

      const res = await axiosInstance.post("/flashcards/exercise-result", requestData);

      console.log(`📖 Store: Backend response:`, res.data);

      // Правильна обробка відповіді з кількома словами
      if (res.data.allWords && Array.isArray(res.data.allWords)) {
        console.log(`📖 Store: Updating ${res.data.allWords.length} words in store`);

        // Створюємо мапу оновлених слів для ефективного пошуку
        const updatedWordsMap = new Map();
        res.data.allWords.forEach(word => {
          updatedWordsMap.set(word._id, word);
        });

        // Оновлюємо всі слова в store
        set({
          flashcards: get().flashcards.map((card) => {
            const updatedWord = updatedWordsMap.get(card._id);
            if (updatedWord) {
              console.log(`📖 Store: Updating card "${card.text}" with new data`);
              return {
                ...card,
                ...updatedWord,
                isReadingComprehensionExercise: updatedWord.isReadingComprehensionExercise ?? card.isReadingComprehensionExercise,
                isSentenceCompletionExercise: updatedWord.isSentenceCompletionExercise ?? card.isSentenceCompletionExercise,
                isMultipleChoiceExercise: updatedWord.isMultipleChoiceExercise ?? card.isMultipleChoiceExercise,
                isListenAndFillExercise: updatedWord.isListenAndFillExercise ?? card.isListenAndFillExercise,
                isListenAndChooseExercise: updatedWord.isListenAndChooseExercise ?? card.isListenAndChooseExercise, // ДОДАНО: нова вправа
                status: updatedWord.status ?? card.status,
                lastReviewedAt: updatedWord.lastReviewedAt ?? card.lastReviewedAt
              };
            }
            return card;
          })
        });

        console.log(`📖 Store: Successfully updated ${res.data.allWords.length} words`);
      } else if (res.data.flashcard) {
        // Стандартна обробка для одного слова
        const updatedFlashcard = res.data.flashcard;
        console.log(`📝 Store: Updating single word "${updatedFlashcard.text}"`);

        set({
          flashcards: get().flashcards.map((card) =>
              card._id === flashcardId ? { ...card, ...updatedFlashcard } : card
          )
        });
      }

      get().refreshLearningStats();

      return res.data;
    } catch (error) {
      console.error("❌ Store: Error handling exercise result:", error);
      toast.error("Помилка обробки результату вправи");
      throw error;
    }
  },

  // ВИПРАВЛЕНО: Нова логіка де слова позначаються як використані одразу при виборі
  getWordsForExercise: async (exerciseType, limit = 10, categoryId = null, excludeIds = []) => {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());

      if (categoryId && categoryId !== 'all') {
        params.append('categoryId', categoryId);
      }

      if (excludeIds && excludeIds.length > 0) {
        params.append('excludeIds', excludeIds.join(','));
      }

      console.log(`🚀 Store: Requesting words for ${exerciseType}: limit=${limit}, category=${categoryId}, excluded=${excludeIds.length}`);

      const res = await axiosInstance.get(`/flashcards/exercise/${exerciseType}?${params.toString()}`);

      // ВИПРАВЛЕНО: Спеціальна обробка для reading comprehension
      if (exerciseType === 'reading-comprehension') {
        console.log(`📖 Store: Received ${res.data.words.length} words for reading comprehension`);

        // ВАЖЛИВО: Слова вже позначені як використані на backend, тому оновлюємо store
        if (res.data.words && res.data.words.length > 0) {
          console.log(`📖 Store: Words already marked as used on backend, updating local store`);

          // Створюємо мапу оновлених слів
          const updatedWordsMap = new Map();
          res.data.words.forEach(word => {
            updatedWordsMap.set(word._id, word);
          });

          // Оновлюємо store одразу після отримання слів
          set({
            flashcards: get().flashcards.map((card) => {
              const updatedWord = updatedWordsMap.get(card._id);
              if (updatedWord) {
                console.log(`📖 Store: Updating "${card.text}" - isReadingComprehension: ${card.isReadingComprehensionExercise} -> ${updatedWord.isReadingComprehensionExercise}`);
                return {
                  ...card,
                  isReadingComprehensionExercise: updatedWord.isReadingComprehensionExercise,
                  lastReviewedAt: updatedWord.lastReviewedAt || card.lastReviewedAt
                };
              }
              return card;
            })
          });
        }

        // Якщо була застосована ротація, також оновлюємо всі слова категорії
        if (res.data.wasRotationApplied && res.data.allCategoryWords) {
          console.log(`🔄 Store: Rotation was applied - updating ${res.data.allCategoryWords.length} cards in store`);

          // Створюємо мапу оновлених карток з backend після ротації
          const allUpdatedCardsMap = new Map();
          res.data.allCategoryWords.forEach(updatedCard => {
            allUpdatedCardsMap.set(updatedCard._id, updatedCard);
          });

          // Оновлюємо картки в store з новими значеннями після ротації
          set({
            flashcards: get().flashcards.map((existingCard) => {
              const updatedCard = allUpdatedCardsMap.get(existingCard._id);
              if (updatedCard) {
                return {
                  ...existingCard,
                  isReadingComprehensionExercise: updatedCard.isReadingComprehensionExercise,
                  status: updatedCard.status ?? existingCard.status,
                  lastReviewedAt: updatedCard.lastReviewedAt ?? existingCard.lastReviewedAt,
                  isSentenceCompletionExercise: updatedCard.isSentenceCompletionExercise ?? existingCard.isSentenceCompletionExercise,
                  isMultipleChoiceExercise: updatedCard.isMultipleChoiceExercise ?? existingCard.isMultipleChoiceExercise,
                  isListenAndFillExercise: updatedCard.isListenAndFillExercise ?? existingCard.isListenAndFillExercise,
                  isListenAndChooseExercise: updatedCard.isListenAndChooseExercise ?? existingCard.isListenAndChooseExercise // ДОДАНО: нова вправа
                };
              }
              return existingCard;
            })
          });

          toast.success("🔄 Цикл Reading Comprehension оновлено - всі слова доступні знову!", {
            duration: 4000,
            position: 'top-center'
          });

          console.log(`🔄 Store: Updated flashcards state after rotation`);
        }

        console.log(`📖 Store: Returning ${res.data.words.length} words for reading comprehension`);
      } else {
        console.log(`🎲 Store: Received ${res.data.words.length} words for ${exerciseType} (shuffled by backend):`, res.data.words.map(w => w.text));
      }

      // ДОДАНО: Додаткове перемішування на frontend для максимальної рандомізації
      if (res.data.words && res.data.words.length > 1) {
        console.log(`🎲 Store: Applying additional frontend shuffle for ${exerciseType}`);
        res.data.words = shuffleArray(res.data.words);
        console.log(`🎲 Store: Final shuffled order:`, res.data.words.map(w => w.text));
      }

      return res.data;
    } catch (error) {
      console.error(`❌ Store: Error getting words for ${exerciseType} exercise:`, error);
      toast.error(`Помилка отримання слів для вправи ${exerciseType}`);
      throw error;
    }
  },

  getLearningStats: async () => {
    try {
      const res = await axiosInstance.get("/flashcards/learning/stats");
      set({ learningStats: res.data });
      return res.data;
    } catch (error) {
      console.error("Error getting learning stats:", error);
      throw error;
    }
  },

  refreshLearningStats: async () => {
    try {
      await get().getLearningStats();
    } catch (error) {
      console.warn("Failed to refresh learning stats:", error);
    }
  },

  getWordsWithProgress: async (status = null) => {
    try {
      const params = status ? `?status=${status}` : '';
      const res = await axiosInstance.get(`/flashcards/learning/progress${params}`);
      return res.data;
    } catch (error) {
      console.error("Error getting words with progress:", error);
      toast.error("Помилка отримання прогресу слів");
      throw error;
    }
  },

  resetWordProgress: async (flashcardId) => {
    try {
      const res = await axiosInstance.post(`/flashcards/learning/reset/${flashcardId}`);

      const updatedFlashcard = res.data.flashcard;
      set({
        flashcards: get().flashcards.map((card) =>
            card._id === flashcardId ? { ...card, ...updatedFlashcard } : card
        )
      });

      get().refreshLearningStats();

      toast.success(res.data.message);
      return res.data;
    } catch (error) {
      console.error("Error resetting word progress:", error);
      toast.error("Помилка скидання прогресу");
      throw error;
    }
  },

  // ДОДАНО: Нова функція для міграції карток до останньої версії
  migrateFlashcardsToLatestVersion: async () => {
    try {
      const res = await axiosInstance.post("/flashcards/migrate-to-latest");

      // Оновлюємо flashcards після міграції
      await get().getFlashcards(get().currentCategoryFilter);

      toast.success(res.data.message, {
        duration: 5000,
        position: 'top-center'
      });

      return res.data;
    } catch (error) {
      console.error("Error migrating flashcards:", error);
      const message = error.response?.data?.message || "Помилка оновлення карток";
      toast.error(message);
      throw error;
    }
  },

  // Ручне скидання reading comprehension для категорії
  resetReadingComprehensionForCategory: async (categoryId = null) => {
    try {
      console.log(`🔄 Store: Manually resetting reading comprehension flags for category: ${categoryId || 'all'}`);

      const result = await get().getWordsForExercise('reading-comprehension', 3, categoryId, []);

      if (result.wasRotationApplied) {
        toast.success("🔄 Reading Comprehension скинуто для нового циклу!", {
          duration: 3000,
          position: 'top-center'
        });
        console.log(`🔄 Store: Manual rotation successful`);
      } else {
        toast.info("Reading Comprehension вже доступний для нових слів", {
          duration: 2000,
          position: 'top-center'
        });
      }

      return true;
    } catch (error) {
      console.error("Store: Error manually resetting reading comprehension:", error);
      toast.error("Помилка скидання Reading Comprehension");
      return false;
    }
  },

  // ОНОВЛЕНО: Перевірка можливості використання слова у вправі (включаючи нову вправу)
  canUseInExercise: (flashcard, exerciseType) => {
    switch (exerciseType) {
      case 'sentence-completion':
        return !flashcard.isSentenceCompletionExercise;
      case 'multiple-choice':
        return !flashcard.isMultipleChoiceExercise;
      case 'listen-and-fill':
        return !flashcard.isListenAndFillExercise;
      case 'listen-and-choose': // ДОДАНО: нова вправа
        return !flashcard.isListenAndChooseExercise;
      case 'reading-comprehension':
        return !flashcard.isReadingComprehensionExercise;
      case 'dialog':
        return true;
      default:
        return true;
    }
  },

  // ОНОВЛЕНО: Отримання прогресу слова (включаючи нову вправу)
  getWordProgress: (flashcard) => {
    const completed = [
      flashcard.isSentenceCompletionExercise,
      flashcard.isMultipleChoiceExercise,
      flashcard.isListenAndFillExercise,
      flashcard.isListenAndChooseExercise // ДОДАНО: нова вправа
    ].filter(Boolean).length;

    return Math.round((completed / 4) * 100); // ОНОВЛЕНО: тепер 4 основні вправи
  },

  // ОНОВЛЕНО: Перевірка готовності слова для review (включаючи нову вправу)
  isWordReadyForReview: (flashcard) => {
    return flashcard.isSentenceCompletionExercise &&
        flashcard.isMultipleChoiceExercise &&
        flashcard.isListenAndFillExercise &&
        flashcard.isListenAndChooseExercise; // ДОДАНО: нова вправа
  },

  // Filter functions
  setCategoryFilter: (categoryId) => {
    set({ currentCategoryFilter: categoryId });
  },

  clearFilter: () => {
    set({ currentCategoryFilter: null });
  },

  refreshFlashcards: () => {
    const currentFilter = get().currentCategoryFilter;
    get().getFlashcards(currentFilter);
  },

  handleCategoryDeleted: (deletedCategoryId) => {
    set({
      flashcards: get().flashcards.filter((card) =>
          card.categoryId?._id !== deletedCategoryId
      ),
    });

    if (get().currentCategoryFilter === deletedCategoryId) {
      get().getFlashcards();
    }
  },

  // AI Generation methods
  generateFlashcardContent: async (text, englishLevel, promptType = "completeFlashcard") => {
    try {
      const response = await axiosInstance.post("/openai/generate-flashcard", {
        text,
        englishLevel,
        promptType
      });

      return response.data;
    } catch (error) {
      console.error("Error generating flashcard content:", error);
      throw error;
    }
  },

  generateFieldContent: async (text, englishLevel, fieldType) => {
    try {
      const response = await axiosInstance.post("/openai/generate-flashcard", {
        text,
        englishLevel,
        promptType: fieldType
      });

      return response.data.result;
    } catch (error) {
      console.error(`Error generating ${fieldType}:`, error);
      throw error;
    }
  },

  generateSentenceWithGap: async (text, englishLevel) => {
    try {
      const response = await axiosInstance.post("/openai/generate-flashcard", {
        text,
        englishLevel,
        promptType: "sentenceWithGap"
      });

      return response.data.result;
    } catch (error) {
      console.error("Error generating sentence with gap:", error);
      throw error;
    }
  },

  generateMatchingDescription: async (text, englishLevel) => {
    try {
      const response = await axiosInstance.post("/openai/generate-flashcard", {
        text,
        englishLevel,
        promptType: "matchingDescription"
      });

      return response.data.result;
    } catch (error) {
      console.error("Error generating matching description:", error);
      throw error;
    }
  },

  // ВИПРАВЛЕНО: Додано рандомізацію до генерації діалогу
  generateInteractiveDialog: async (words, englishLevel) => {
    try {
      const wordsString = Array.isArray(words) ? words.join(', ') : words;

      console.log(`🎯 Store: Generating dialog for words: ${wordsString} (backend will randomize)`);

      const response = await axiosInstance.post("/openai/generate-flashcard", {
        text: wordsString,
        englishLevel,
        promptType: "dialog"
      });

      return response.data.result;
    } catch (error) {
      console.error("Error generating interactive dialog:", error);
      throw error;
    }
  },

  // Спрощена генерація reading comprehension з новою логікою
  generateReadingComprehension: async (words, englishLevel) => {
    try {
      const wordsString = Array.isArray(words) ? words.join(', ') : words;

      console.log(`🎯 Store: Generating reading comprehension for words: ${wordsString}`);

      const response = await axiosInstance.post("/openai/generate-flashcard", {
        text: wordsString,
        englishLevel,
        promptType: "readingComprehension"
      });

      const result = response.data.result;

      // Додаткова валідація для reading comprehension
      if (!result || !result.text || !result.facts || !Array.isArray(result.facts)) {
        throw new Error("Invalid reading comprehension data structure");
      }

      if (result.facts.length !== 3) {
        throw new Error(`Reading comprehension must have exactly 3 facts, got ${result.facts.length}`);
      }

      if (!Array.isArray(result.usedWords) || result.usedWords.length !== 3) {
        throw new Error(`Reading comprehension must use exactly 3 words, got ${result.usedWords?.length || 0}`);
      }

      console.log(`✅ Store: Reading comprehension generated successfully with words:`, result.usedWords);

      return result;
    } catch (error) {
      console.error("❌ Store: Error generating reading comprehension:", error);
      throw error;
    }
  },

  translateSentenceToUkrainian: async (sentence, englishLevel = "B1") => {
    try {
      const response = await axiosInstance.post("/openai/generate-flashcard", {
        text: sentence,
        englishLevel,
        promptType: "translateSentenceToUkrainian"
      });

      return response.data.result;
    } catch (error) {
      console.error("Error translating sentence to Ukrainian:", error);
      throw error;
    }
  },

  regenerateExamples: async (cardId) => {
    try {
      const response = await axiosInstance.post(`/openai/regenerate-examples/${cardId}`);

      if (response.data.success) {
        const updatedCard = response.data.flashcard;

        set({
          flashcards: get().flashcards.map((card) =>
              card._id === cardId ? updatedCard : card
          ),
        });

        return updatedCard;
      } else {
        throw new Error("Failed to regenerate examples");
      }
    } catch (error) {
      console.error("Error regenerating examples:", error);

      let errorMessage = "Помилка генерації нових прикладів";

      if (error.response?.status === 401) {
        errorMessage = "API ключ недійсний";
      } else if (error.response?.status === 402) {
        errorMessage = "Недостатньо кредитів OpenAI";
      } else if (error.response?.status === 429) {
        errorMessage = "Перевищено ліміт запитів OpenAI";
      } else if (error.response?.status === 404) {
        errorMessage = "Картку не знайдено";
      }

      toast.error(errorMessage);
      throw error;
    }
  },

  generateExamplesForWord: async (text, englishLevel) => {
    try {
      const response = await axiosInstance.post("/openai/generate-flashcard", {
        text,
        englishLevel,
        promptType: "examples"
      });

      return response.data.result;
    } catch (error) {
      console.error("Error generating examples for word:", error);
      throw error;
    }
  },

  // ДОДАНО: Функції з додатковою рандомізацією для практики
  getRandomizedFlashcardsByCategory: (categoryId) => {
    const cards = get().flashcards.filter(card => {
      if (categoryId === 'uncategorized') {
        return !card.categoryId;
      }
      return card.categoryId?._id === categoryId;
    });

    return shuffleArray(cards);
  },

  getRandomizedUncategorizedFlashcards: () => {
    const cards = get().flashcards.filter(card => !card.categoryId);
    return shuffleArray(cards);
  },

  getRandomizedAvailableWordsForExercise: (exerciseType) => {
    const cards = get().flashcards.filter(card => get().canUseInExercise(card, exerciseType));
    return shuffleArray(cards);
  },

  // Utility functions з рандомізацією
  getFlashcardsByCategory: (categoryId) => {
    return get().flashcards.filter(card => {
      if (categoryId === 'uncategorized') {
        return !card.categoryId;
      }
      return card.categoryId?._id === categoryId;
    });
  },

  getUncategorizedFlashcards: () => {
    return get().flashcards.filter(card => !card.categoryId);
  },

  getExamplesFromCard: (card) => {
    if (card.examples && Array.isArray(card.examples) && card.examples.length > 0) {
      return card.examples.filter(ex => ex && ex.trim());
    } else if (card.example && card.example.trim()) {
      return [card.example.trim()];
    }
    return [];
  },

  getFirstExample: (card) => {
    const examples = get().getExamplesFromCard(card);
    return examples.length > 0 ? examples[0] : null;
  },

  hasExamples: (card) => {
    const examples = get().getExamplesFromCard(card);
    return examples.length > 0;
  },

  getExamplesCount: (card) => {
    const examples = get().getExamplesFromCard(card);
    return examples.length;
  },

  migrateCardExamples: (card) => {
    if (card.example && (!card.examples || card.examples.length === 0)) {
      return {
        ...card,
        examples: [card.example]
      };
    }
    return card;
  },

  migrateAllCards: () => {
    const currentCards = get().flashcards;
    const migratedCards = currentCards.map(card => get().migrateCardExamples(card));
    set({ flashcards: migratedCards });
  },

  getWordsByStatus: (status) => {
    return get().flashcards.filter(card => card.status === status);
  },

  getAvailableWordsForExercise: (exerciseType) => {
    return get().flashcards.filter(card => get().canUseInExercise(card, exerciseType));
  },

  getStatusCounts: () => {
    const flashcards = get().flashcards;
    return {
      learning: flashcards.filter(card => card.status === 'learning').length,
      review: flashcards.filter(card => card.status === 'review').length,
      total: flashcards.length
    };
  },

  getOverallProgress: () => {
    const flashcards = get().flashcards;
    const totalWords = flashcards.length;

    if (totalWords === 0) {
      return { percentage: 0, completedWords: 0, totalWords: 0 };
    }

    const completedWords = flashcards.filter(card => card.status === 'review').length;
    const percentage = Math.round((completedWords / totalWords) * 100);

    return { percentage, completedWords, totalWords };
  },

  // Спеціальні методи для reading comprehension з правильною логікою
  getWordsUsedInReadingComprehension: () => {
    return get().flashcards.filter(card => card.isReadingComprehensionExercise);
  },

  getAvailableWordsForReadingComprehension: () => {
    return get().flashcards.filter(card => !card.isReadingComprehensionExercise);
  },

  getReadingComprehensionStats: () => {
    const flashcards = get().flashcards;
    const usedInReading = flashcards.filter(card => card.isReadingComprehensionExercise).length;
    const availableForReading = flashcards.filter(card => !card.isReadingComprehensionExercise).length;

    return {
      used: usedInReading,
      available: availableForReading,
      total: flashcards.length,
      percentage: flashcards.length > 0 ? Math.round((usedInReading / flashcards.length) * 100) : 0
    };
  },

  // Функція для діагностики стану reading comprehension
  debugReadingComprehensionState: (categoryId = null) => {
    const flashcards = get().flashcards;

    let targetCards = flashcards;
    if (categoryId && categoryId !== 'all') {
      if (categoryId === 'uncategorized') {
        targetCards = flashcards.filter(card => !card.categoryId);
      } else {
        targetCards = flashcards.filter(card => card.categoryId?._id === categoryId);
      }
    }

    const used = targetCards.filter(card => card.isReadingComprehensionExercise);
    const available = targetCards.filter(card => !card.isReadingComprehensionExercise);

    console.log(`📊 Reading Comprehension Debug for category "${categoryId || 'all'}":`);
    console.log(`   Total cards: ${targetCards.length}`);
    console.log(`   Used in RC: ${used.length} - ${used.map(c => c.text).join(', ')}`);
    console.log(`   Available for RC: ${available.length} - ${available.map(c => c.text).join(', ')}`);
    console.log(`   Need rotation: ${available.length < 3 ? 'YES' : 'NO'}`);

    return {
      total: targetCards.length,
      used: used.length,
      available: available.length,
      needsRotation: available.length < 3,
      usedWords: used.map(c => ({ id: c._id, text: c.text })),
      availableWords: available.map(c => ({ id: c._id, text: c.text }))
    };
  },

  // ДОДАНО: Нові функції для рандомізованого вибору карток
  getRandomCards: (count = 1, excludeIds = []) => {
    const availableCards = get().flashcards.filter(card =>
        !excludeIds.includes(card._id)
    );

    const shuffled = shuffleArray(availableCards);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  },

  getRandomCardsByStatus: (status, count = 1, excludeIds = []) => {
    const availableCards = get().flashcards.filter(card =>
        card.status === status && !excludeIds.includes(card._id)
    );

    const shuffled = shuffleArray(availableCards);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  },

  getRandomCardsByCategory: (categoryId, count = 1, excludeIds = []) => {
    const availableCards = get().flashcards.filter(card => {
      if (excludeIds.includes(card._id)) return false;

      if (categoryId === 'uncategorized') {
        return !card.categoryId;
      }
      return card.categoryId?._id === categoryId;
    });

    const shuffled = shuffleArray(availableCards);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  },

  // ОНОВЛЕНО: Функція для отримання рандомізованих карток для різних типів вправ (включаючи нову)
  getRandomCardsForExercise: (exerciseType, count = 1, excludeIds = []) => {
    const availableCards = get().flashcards.filter(card =>
        get().canUseInExercise(card, exerciseType) && !excludeIds.includes(card._id)
    );

    const shuffled = shuffleArray(availableCards);
    console.log(`🎲 Store: Selected ${Math.min(count, shuffled.length)} random cards for ${exerciseType}:`,
        shuffled.slice(0, count).map(c => c.text));

    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}));

// Expose refresh method globally so category store can call it
if (typeof window !== 'undefined') {
  window.refreshFlashcards = () => {
    const store = useFlashcardStore.getState();
    store.refreshFlashcards();
  };
}