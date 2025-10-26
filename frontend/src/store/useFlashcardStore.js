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

  // ОНОВЛЕНО: Покращені функції для роботи з оптимізованою логікою вправ

  // Генерація повного списку вправ для категорії з актуальним статусом
  generateCategoryExercisesList: (cards) => {
    const coreExercises = ['multiple-choice', 'sentence-completion', 'listen-and-fill', 'listen-and-choose'];
    const exercisesList = [];
    let exId = 1;

    // Спочатку додаємо learning картки (пріоритет)
    const learningCards = cards.filter(card => card.status === 'learning');
    const reviewCards = cards.filter(card => card.status === 'review');

    console.log(`📋 Store: Generating exercises: ${learningCards.length} learning, ${reviewCards.length} review cards`);

    // Генеруємо вправи для learning карток
    learningCards.forEach(flashcard => {
      coreExercises.forEach(exerciseType => {
        if (get().canCardUseExercise(flashcard, exerciseType)) {
          exercisesList.push({
            exId: exId++,
            flashcard: {
              ...flashcard,
              // ДОДАНО: Зберігаємо актуальний статус вправ на момент генерації
              currentExerciseStatus: {
                isSentenceCompletionExercise: flashcard.isSentenceCompletionExercise || false,
                isMultipleChoiceExercise: flashcard.isMultipleChoiceExercise || false,
                isListenAndFillExercise: flashcard.isListenAndFillExercise || false,
                isListenAndChooseExercise: flashcard.isListenAndChooseExercise || false
              }
            },
            exerciseType,
            priority: 'learning',
            wasAvailableAtGeneration: true,
            generatedAt: Date.now()
          });
        }
      });
    });

    // Додаємо review картки (другий пріоритет)
    reviewCards.forEach(flashcard => {
      coreExercises.forEach(exerciseType => {
        exercisesList.push({
          exId: exId++,
          flashcard: {
            ...flashcard,
            currentExerciseStatus: {
              isSentenceCompletionExercise: flashcard.isSentenceCompletionExercise || false,
              isMultipleChoiceExercise: flashcard.isMultipleChoiceExercise || false,
              isListenAndFillExercise: flashcard.isListenAndFillExercise || false,
              isListenAndChooseExercise: flashcard.isListenAndChooseExercise || false
            }
          },
          exerciseType,
          priority: 'review',
          wasAvailableAtGeneration: true,
          generatedAt: Date.now()
        });
      });
    });

    console.log(`📋 Store: Generated ${exercisesList.length} exercises total`);
    console.log(`   Learning exercises: ${exercisesList.filter(ex => ex.priority === 'learning').length}`);
    console.log(`   Review exercises: ${exercisesList.filter(ex => ex.priority === 'review').length}`);

    return exercisesList;
  },

  // ВИПРАВЛЕНО: Перевірка чи може картка використовуватися у вправі з актуальними даними
  canCardUseExercise: (flashcard, exerciseType) => {
    // Для review карток - можна використовувати всі вправи
    if (flashcard.status === 'review') {
      return true;
    }

    // ВИПРАВЛЕНО: Для learning карток - перевіряємо актуальний статус
    switch (exerciseType) {
      case 'sentence-completion':
        return !flashcard.isSentenceCompletionExercise;
      case 'multiple-choice':
        return !flashcard.isMultipleChoiceExercise;
      case 'listen-and-fill':
        return !flashcard.isListenAndFillExercise;
      case 'listen-and-choose':
        return !flashcard.isListenAndChooseExercise;
      default:
        return true;
    }
  },

  // ДОДАНО: Функція для валідації вправи з актуальним статусом картки зі store
  validateExerciseWithCurrentStatus: (exercise) => {
    const currentCard = get().flashcards.find(card => card._id === exercise.flashcard._id);
    if (!currentCard) {
      console.warn(`Store: Card ${exercise.flashcard._id} not found in current store`);
      return false;
    }

    // Якщо це завершена вправа - не валідна
    if (exercise.isCompleted) {
      return false;
    }

    return get().canCardUseExercise(currentCard, exercise.exerciseType);
  },

  // Вибір вправ із заготовленого списку з пріоритизацією та валідацією
  selectExercisesFromList: (exercisesList, requestedCount) => {
    if (!exercisesList || exercisesList.length === 0) {
      console.warn("Store: No exercises available in list");
      return [];
    }

    console.log(`🎯 Store: Selecting ${requestedCount} exercises from ${exercisesList.length} available`);

    // ВИПРАВЛЕНО: Валідуємо кожну вправу з актуальним статусом
    const validExercises = exercisesList.filter(exercise =>
        get().validateExerciseWithCurrentStatus(exercise)
    );

    console.log(`🔍 Store: After validation: ${validExercises.length} valid exercises from ${exercisesList.length} total`);

    if (validExercises.length === 0) {
      console.warn("Store: No valid exercises available after filtering");
      return [];
    }

    // Розділяємо на learning та review вправи
    const learningExercises = validExercises.filter(ex => ex.priority === 'learning');
    const reviewExercises = validExercises.filter(ex => ex.priority === 'review');

    console.log(`   Valid learning exercises: ${learningExercises.length}`);
    console.log(`   Valid review exercises: ${reviewExercises.length}`);

    let selectedExercises = [];

    // Спочатку намагаємося взяти learning вправи
    if (learningExercises.length >= requestedCount) {
      const shuffledLearning = shuffleArray([...learningExercises]);
      selectedExercises = shuffledLearning.slice(0, requestedCount);
      console.log(`   ✅ Selected ${requestedCount} exercises from learning cards only`);
    } else {
      // Якщо learning вправ не вистачає - беремо всі learning + добираємо review
      const shuffledLearning = shuffleArray([...learningExercises]);
      const neededFromReview = requestedCount - learningExercises.length;

      if (reviewExercises.length >= neededFromReview) {
        const shuffledReview = shuffleArray([...reviewExercises]);
        selectedExercises = [
          ...shuffledLearning,
          ...shuffledReview.slice(0, neededFromReview)
        ];
        console.log(`   ✅ Combined: ${learningExercises.length} learning + ${neededFromReview} review exercises`);
      } else {
        const shuffledReview = shuffleArray([...reviewExercises]);
        selectedExercises = [...shuffledLearning, ...shuffledReview];
        console.log(`   ⚠️ Not enough exercises: got ${selectedExercises.length} out of ${requestedCount} requested`);
      }
    }

    // Фінальне перемішування об'єднаного списку
    const finalExercises = shuffleArray(selectedExercises);

    console.log(`🎲 Store: Final selection (${finalExercises.length} exercises):`,
        finalExercises.map((ex, i) => `${i+1}. ${ex.flashcard.text} (${ex.exerciseType}, ${ex.priority})`));

    return finalExercises;
  },

  // Фільтр вправ за типом з валідацією
  filterExercisesByType: (exercisesList, exerciseType) => {
    const filtered = exercisesList.filter(ex => ex.exerciseType === exerciseType);
    // Додаткова валідація
    return filtered.filter(exercise => get().validateExerciseWithCurrentStatus(exercise));
  },

  // Отримання статистики вправ
  getExercisesListStats: (exercisesList) => {
    if (!exercisesList || exercisesList.length === 0) {
      return { total: 0, learning: 0, review: 0, valid: 0, byType: {} };
    }

    // Валідуємо всі вправи
    const validExercises = exercisesList.filter(exercise =>
        get().validateExerciseWithCurrentStatus(exercise)
    );

    const stats = {
      total: exercisesList.length,
      valid: validExercises.length,
      learning: validExercises.filter(ex => ex.priority === 'learning').length,
      review: validExercises.filter(ex => ex.priority === 'review').length,
      byType: {}
    };

    // Підрахунок за типами вправ
    const exerciseTypes = ['multiple-choice', 'sentence-completion', 'listen-and-fill', 'listen-and-choose'];
    exerciseTypes.forEach(type => {
      stats.byType[type] = validExercises.filter(ex => ex.exerciseType === type).length;
    });

    return stats;
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

  // Перевірка можливості використання слова у вправі
  canUseInExercise: (flashcard, exerciseType) => {
    // Review картки можуть використовуватися у всіх вправах
    if (flashcard.status === 'review') {
      return true;
    }

    switch (exerciseType) {
      case 'sentence-completion':
        return !flashcard.isSentenceCompletionExercise;
      case 'multiple-choice':
        return !flashcard.isMultipleChoiceExercise;
      case 'listen-and-fill':
        return !flashcard.isListenAndFillExercise;
      case 'listen-and-choose':
        return !flashcard.isListenAndChooseExercise;
      case 'reading-comprehension':
        return !flashcard.isReadingComprehensionExercise;
      case 'dialog':
        return true;
      default:
        return true;
    }
  },

  // Отримання прогресу слова
  getWordProgress: (flashcard) => {
    const completed = [
      flashcard.isSentenceCompletionExercise,
      flashcard.isMultipleChoiceExercise,
      flashcard.isListenAndFillExercise,
      flashcard.isListenAndChooseExercise
    ].filter(Boolean).length;

    return Math.round((completed / 4) * 100);
  },

  // Перевірка готовності слова для review
  isWordReadyForReview: (flashcard) => {
    return flashcard.isSentenceCompletionExercise &&
        flashcard.isMultipleChoiceExercise &&
        flashcard.isListenAndFillExercise &&
        flashcard.isListenAndChooseExercise;
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

  // Спрощена генерація reading comprehension
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

  // ОПТИМІЗОВАНІ ФУНКЦІЇ: Рандомізовані картки з пріоритизацією

  // Отримання рандомізованих карток категорії з пріоритетом learning
  getRandomizedFlashcardsByCategory: (categoryId) => {
    let cards = get().flashcards.filter(card => {
      if (categoryId === 'uncategorized') {
        return !card.categoryId;
      }
      return card.categoryId?._id === categoryId;
    });

    // Сортуємо: спочатку learning, потім review
    const learningCards = cards.filter(card => card.status === 'learning');
    const reviewCards = cards.filter(card => card.status === 'review');

    const shuffledLearning = shuffleArray(learningCards);
    const shuffledReview = shuffleArray(reviewCards);

    return [...shuffledLearning, ...shuffledReview];
  },

  // Отримання рандомізованих некатегоризованих карток
  getRandomizedUncategorizedFlashcards: () => {
    let cards = get().flashcards.filter(card => !card.categoryId);

    const learningCards = cards.filter(card => card.status === 'learning');
    const reviewCards = cards.filter(card => card.status === 'review');

    const shuffledLearning = shuffleArray(learningCards);
    const shuffledReview = shuffleArray(reviewCards);

    return [...shuffledLearning, ...shuffledReview];
  },

  // Отримання доступних слів для вправи з пріоритизацією
  getRandomizedAvailableWordsForExercise: (exerciseType) => {
    let availableCards = get().flashcards.filter(card => get().canUseInExercise(card, exerciseType));

    // Розділяємо на learning та review
    const learningCards = availableCards.filter(card => card.status === 'learning');
    const reviewCards = availableCards.filter(card => card.status === 'review');

    const shuffledLearning = shuffleArray(learningCards);
    const shuffledReview = shuffleArray(reviewCards);

    return [...shuffledLearning, ...shuffledReview];
  },

  // Utility functions
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

  // Спеціальні методи для reading comprehension
  getWordsUsedInReadingComprehension: () => {
    return get().flashcards.filter(card =>
        card.status === 'learning' && card.isReadingComprehensionExercise
    );
  },

  getAvailableWordsForReadingComprehension: () => {
    return get().flashcards.filter(card =>
        card.status === 'learning' && !card.isReadingComprehensionExercise
    );
  },

  getReadingComprehensionStats: () => {
    const learningCards = get().flashcards.filter(card => card.status === 'learning');
    const usedInReading = learningCards.filter(card => card.isReadingComprehensionExercise).length;
    const availableForReading = learningCards.filter(card => !card.isReadingComprehensionExercise).length;

    return {
      used: usedInReading,
      available: availableForReading,
      total: learningCards.length,
      percentage: learningCards.length > 0 ? Math.round((usedInReading / learningCards.length) * 100) : 0
    };
  },

  // Функція для діагностики стану reading comprehension
  debugReadingComprehensionState: (categoryId = null) => {
    let targetCards = get().flashcards.filter(card => card.status === 'learning');

    if (categoryId && categoryId !== 'all') {
      if (categoryId === 'uncategorized') {
        targetCards = targetCards.filter(card => !card.categoryId);
      } else {
        targetCards = targetCards.filter(card => card.categoryId?._id === categoryId);
      }
    }

    const used = targetCards.filter(card => card.isReadingComprehensionExercise);
    const available = targetCards.filter(card => !card.isReadingComprehensionExercise);

    console.log(`📊 Reading Comprehension Debug for category "${categoryId || 'all'}" (learning cards only):`);
    console.log(`   Total learning cards: ${targetCards.length}`);
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

  // ОПТИМІЗОВАНІ ФУНКЦІЇ: Рандомізований вибір карток з пріоритизацією

  // Отримання рандомних карток з пріоритетом learning
  getRandomCards: (count = 1, excludeIds = []) => {
    let availableCards = get().flashcards.filter(card => !excludeIds.includes(card._id));

    const learningCards = availableCards.filter(card => card.status === 'learning');
    const reviewCards = availableCards.filter(card => card.status === 'review');

    if (learningCards.length >= count) {
      const shuffled = shuffleArray(learningCards);
      return shuffled.slice(0, count);
    } else {
      const shuffledLearning = shuffleArray(learningCards);
      const neededFromReview = count - learningCards.length;
      const shuffledReview = shuffleArray(reviewCards);
      return [
        ...shuffledLearning,
        ...shuffledReview.slice(0, Math.min(neededFromReview, shuffledReview.length))
      ];
    }
  },

  // Отримання рандомних карток за статусом
  getRandomCardsByStatus: (status, count = 1, excludeIds = []) => {
    const availableCards = get().flashcards.filter(card =>
        card.status === status && !excludeIds.includes(card._id)
    );

    const shuffled = shuffleArray(availableCards);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  },

  // Отримання рандомних карток за категорією з пріоритизацією
  getRandomCardsByCategory: (categoryId, count = 1, excludeIds = []) => {
    let availableCards = get().flashcards.filter(card => {
      if (excludeIds.includes(card._id)) return false;

      if (categoryId === 'uncategorized') {
        return !card.categoryId;
      }
      return card.categoryId?._id === categoryId;
    });

    const learningCards = availableCards.filter(card => card.status === 'learning');
    const reviewCards = availableCards.filter(card => card.status === 'review');

    if (learningCards.length >= count) {
      const shuffled = shuffleArray(learningCards);
      return shuffled.slice(0, count);
    } else {
      const shuffledLearning = shuffleArray(learningCards);
      const neededFromReview = count - learningCards.length;
      const shuffledReview = shuffleArray(reviewCards);
      return [
        ...shuffledLearning,
        ...shuffledReview.slice(0, Math.min(neededFromReview, shuffledReview.length))
      ];
    }
  },

  // Отримання рандомізованих карток для конкретного типу вправи з пріоритизацією
  getRandomCardsForExercise: (exerciseType, count = 1, excludeIds = []) => {
    let availableCards = get().flashcards.filter(card =>
        get().canUseInExercise(card, exerciseType) && !excludeIds.includes(card._id)
    );

    const learningCards = availableCards.filter(card => card.status === 'learning');
    const reviewCards = availableCards.filter(card => card.status === 'review');

    let finalCards = [];

    if (learningCards.length >= count) {
      const shuffled = shuffleArray(learningCards);
      finalCards = shuffled.slice(0, count);
      console.log(`🎲 Store: Selected ${finalCards.length} learning cards for ${exerciseType}:`,
          finalCards.map(c => c.text));
    } else {
      const shuffledLearning = shuffleArray(learningCards);
      const neededFromReview = count - learningCards.length;
      const shuffledReview = shuffleArray(reviewCards);
      finalCards = [
        ...shuffledLearning,
        ...shuffledReview.slice(0, Math.min(neededFromReview, shuffledReview.length))
      ];

      console.log(`🎲 Store: Selected ${finalCards.length} cards for ${exerciseType} (${shuffledLearning.length} learning + ${finalCards.length - shuffledLearning.length} review):`,
          finalCards.map(c => `${c.text}(${c.status})`));
    }

    return finalCards;
  }
}));

// Expose refresh method globally so category store can call it
if (typeof window !== 'undefined') {
  window.refreshFlashcards = () => {
    const store = useFlashcardStore.getState();
    store.refreshFlashcards();
  };
}