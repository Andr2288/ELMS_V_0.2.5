// frontend/src/store/useFlashcardStore.js - ВИПРАВЛЕНО: Правильна синхронізація статусу карток

import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";

// Функція для перемішування масиву (Fisher-Yates shuffle)
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

      // ДОДАНО: Лог оновлених карток для debug
      console.log(`📦 Store: Updated flashcards from server (${res.data.length} cards)`);
      if (res.data.length < 10) {
        console.log(`📦 Store: Cards status snapshot:`, res.data.map(card => ({
          text: card.text,
          status: card.status,
          sentence: card.isSentenceCompletionExercise,
          multiple: card.isMultipleChoiceExercise,
          listen: card.isListenAndFillExercise,
          choose: card.isListenAndChooseExercise,
          reading: card.isReadingComprehensionExercise
        })));
      }

    } catch (error) {
      console.log("Error getting flashcards:", error);
      toast.error("Помилка завантаження карток");
    } finally {
      set({ isLoading: false });
    }
  },

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
        set({ flashcards: [...get().flashcards, newFlashcard] });
      }

      toast.success("Картку створено!");
      get().refreshLearningStats();

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

  // ВИПРАВЛЕНО: Покращена функція обробки результатів вправ
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

        // ВИПРАВЛЕНО: Більш детальне оновлення статусів карток
        set({
          flashcards: get().flashcards.map((card) => {
            const updatedWord = updatedWordsMap.get(card._id);
            if (updatedWord) {
              console.log(`📖 Store: Updating card "${card.text}":`);
              console.log(`   Status: ${card.status} -> ${updatedWord.status || card.status}`);
              console.log(`   Reading: ${card.isReadingComprehensionExercise} -> ${updatedWord.isReadingComprehensionExercise}`);
              console.log(`   Sentence: ${card.isSentenceCompletionExercise} -> ${updatedWord.isSentenceCompletionExercise || card.isSentenceCompletionExercise}`);
              console.log(`   Multiple: ${card.isMultipleChoiceExercise} -> ${updatedWord.isMultipleChoiceExercise || card.isMultipleChoiceExercise}`);
              console.log(`   Listen: ${card.isListenAndFillExercise} -> ${updatedWord.isListenAndFillExercise || card.isListenAndFillExercise}`);
              console.log(`   Choose: ${card.isListenAndChooseExercise} -> ${updatedWord.isListenAndChooseExercise || card.isListenAndChooseExercise}`);

              return {
                ...card,
                ...updatedWord,
                // ВАЖЛИВО: Явно оновлюємо всі поля статусів вправ
                isReadingComprehensionExercise: updatedWord.isReadingComprehensionExercise ?? card.isReadingComprehensionExercise,
                isSentenceCompletionExercise: updatedWord.isSentenceCompletionExercise ?? card.isSentenceCompletionExercise,
                isMultipleChoiceExercise: updatedWord.isMultipleChoiceExercise ?? card.isMultipleChoiceExercise,
                isListenAndFillExercise: updatedWord.isListenAndFillExercise ?? card.isListenAndFillExercise,
                isListenAndChooseExercise: updatedWord.isListenAndChooseExercise ?? card.isListenAndChooseExercise,
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
        console.log(`   Old status: ${get().flashcards.find(c => c._id === flashcardId)?.isSentenceCompletionExercise}`);
        console.log(`   New status: ${updatedFlashcard.isSentenceCompletionExercise}`);

        set({
          flashcards: get().flashcards.map((card) =>
              card._id === flashcardId ? {
                ...card,
                ...updatedFlashcard,
                // ВАЖЛИВО: Явно оновлюємо всі поля статусів вправ
                isSentenceCompletionExercise: updatedFlashcard.isSentenceCompletionExercise ?? card.isSentenceCompletionExercise,
                isMultipleChoiceExercise: updatedFlashcard.isMultipleChoiceExercise ?? card.isMultipleChoiceExercise,
                isListenAndFillExercise: updatedFlashcard.isListenAndFillExercise ?? card.isListenAndFillExercise,
                isListenAndChooseExercise: updatedFlashcard.isListenAndChooseExercise ?? card.isListenAndChooseExercise,
                isReadingComprehensionExercise: updatedFlashcard.isReadingComprehensionExercise ?? card.isReadingComprehensionExercise,
                status: updatedFlashcard.status ?? card.status,
                lastReviewedAt: updatedFlashcard.lastReviewedAt ?? card.lastReviewedAt
              } : card
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

  // ОНОВЛЕНО: Функція тепер підтримує швидкий підхід для core вправ та мережевий для advanced
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

      // СПЕЦІАЛЬНА ОБРОБКА: Reading comprehension
      if (exerciseType === 'reading-comprehension') {
        console.log(`📖 Store: Received ${res.data.words.length} learning words for reading comprehension`);

        if (res.data.words && res.data.words.length > 0) {
          console.log(`📖 Store: Learning words already marked as used on backend, updating local store`);

          const updatedWordsMap = new Map();
          res.data.words.forEach(word => {
            updatedWordsMap.set(word._id, word);
          });

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

        if (res.data.wasRotationApplied && res.data.allCategoryWords) {
          console.log(`🔄 Store: Rotation was applied - updating ${res.data.allCategoryWords.length} cards in store`);

          const allUpdatedCardsMap = new Map();
          res.data.allCategoryWords.forEach(updatedCard => {
            allUpdatedCardsMap.set(updatedCard._id, updatedCard);
          });

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
                  isListenAndChooseExercise: updatedCard.isListenAndChooseExercise ?? existingCard.isListenAndChooseExercise
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

        console.log(`📖 Store: Returning ${res.data.words.length} learning words for reading comprehension`);
      } else {
        console.log(`🎲 Store: Received ${res.data.words.length} learning words for ${exerciseType} (shuffled by backend):`, res.data.words.map(w => w.text));
      }

      // Додаткове перемішування на frontend для максимальної рандомізації
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

  // Filter functions
  setCategoryFilter: (categoryId) => {
    set({ currentCategoryFilter: categoryId });
  },

  refreshFlashcards: () => {
    const currentFilter = get().currentCategoryFilter;
    get().getFlashcards(currentFilter);
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
  }
}));

if (typeof window !== 'undefined') {
  window.refreshFlashcards = () => {
    const store = useFlashcardStore.getState();
    store.refreshFlashcards();
  };
}