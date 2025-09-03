// backend/src/controllers/flashcard.controller.js - ОНОВЛЕНО З ПІДТРИМКОЮ LISTEN-AND-CHOOSE

import Flashcard from "../models/flashcard.model.js";
import Category from "../models/category.model.js";

// ДОДАНО: Функція для перемішування масиву (Fisher-Yates shuffle)
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const createFlashcard = async (req, res) => {
  try {
    const { text, transcription, translation, shortDescription, explanation, example, examples, notes, isAIGenerated, categoryId } = req.body;
    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    if (categoryId) {
      const category = await Category.findOne({ _id: categoryId, userId });
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
    }

    let processedExamples = [];
    if (examples && Array.isArray(examples)) {
      processedExamples = examples.filter(ex => ex && ex.trim()).map(ex => ex.trim());
    } else if (example && example.trim()) {
      processedExamples = [example.trim()];
    }

    const newFlashcard = new Flashcard({
      text: text.trim(),
      transcription: transcription?.trim() || "",
      translation: translation?.trim() || "",
      shortDescription: shortDescription?.trim() || "",
      explanation: explanation?.trim() || "",
      examples: processedExamples,
      example: example?.trim() || "",
      notes: notes?.trim() || "",
      isAIGenerated: isAIGenerated || false,
      categoryId: categoryId || null,
      userId,
      status: "learning",
      isSentenceCompletionExercise: false,
      isMultipleChoiceExercise: false,
      isListenAndFillExercise: false,
      isListenAndChooseExercise: false, // ДОДАНО: нова вправа
      isReadingComprehensionExercise: false,
      addedToLearningAt: new Date(),
      lastReviewedAt: new Date()
    });

    await newFlashcard.save();
    await newFlashcard.populate('categoryId', 'name color');

    return res.status(201).json(newFlashcard);
  } catch (error) {
    console.log("Error in createFlashcard controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getFlashcards = async (req, res) => {
  try {
    const userId = req.user._id;
    const { categoryId, status } = req.query;

    let query = { userId };

    if (categoryId) {
      if (categoryId === 'uncategorized') {
        query.categoryId = null;
      } else {
        query.categoryId = categoryId;
      }
    }

    if (status && ['learning', 'review'].includes(status)) {
      query.status = status;
    }

    const flashcards = await Flashcard.find(query)
        .populate('categoryId', 'name color')
        .sort({ createdAt: -1 });

    return res.status(200).json(flashcards);
  } catch (error) {
    console.log("Error in getFlashcards controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, transcription, translation, shortDescription, explanation, example, examples, notes, isAIGenerated, categoryId } = req.body;
    const userId = req.user._id;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const flashcard = await Flashcard.findOne({ _id: id, userId });

    if (!flashcard) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    if (categoryId) {
      const category = await Category.findOne({ _id: categoryId, userId });
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
    }

    let processedExamples = [];
    if (examples && Array.isArray(examples)) {
      processedExamples = examples.filter(ex => ex && ex.trim()).map(ex => ex.trim());
    } else if (example && example.trim()) {
      processedExamples = [example.trim()];
    }

    flashcard.text = text.trim();
    flashcard.transcription = transcription?.trim() || "";
    flashcard.translation = translation?.trim() || "";
    flashcard.shortDescription = shortDescription?.trim() || "";
    flashcard.explanation = explanation?.trim() || "";
    flashcard.examples = processedExamples;
    flashcard.example = example?.trim() || "";
    flashcard.notes = notes?.trim() || "";
    if (isAIGenerated !== undefined) flashcard.isAIGenerated = isAIGenerated;
    flashcard.categoryId = categoryId || null;

    await flashcard.save();
    await flashcard.populate('categoryId', 'name color');

    return res.status(200).json(flashcard);
  } catch (error) {
    console.log("Error in updateFlashcard controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const flashcard = await Flashcard.findOneAndDelete({ _id: id, userId });

    if (!flashcard) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    return res.status(200).json({ message: "Flashcard deleted" });
  } catch (error) {
    console.log("Error in deleteFlashcard controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getFlashcardsGrouped = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await Flashcard.aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      {
        $group: {
          _id: "$categoryId",
          category: { $first: { $arrayElemAt: ["$category", 0] } },
          flashcards: { $push: "$$ROOT" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    return res.status(200).json(result);
  } catch (error) {
    console.log("Error in getFlashcardsGrouped controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const handleExerciseResult = async (req, res) => {
  try {
    const { flashcardId, exerciseType, isCorrect, usedWordIds } = req.body;
    const userId = req.user._id;

    // Для reading comprehension використовуємо usedWordIds, а не flashcardId
    let wordIds;

    if (exerciseType === 'reading-comprehension' && usedWordIds && Array.isArray(usedWordIds) && usedWordIds.length > 0) {
      wordIds = usedWordIds;
      console.log(`📖 Reading comprehension: processing ${wordIds.length} words:`, wordIds);
    } else {
      wordIds = [flashcardId];
      console.log(`📝 Regular exercise: processing 1 word:`, flashcardId);
    }

    if (wordIds.length === 0 || !exerciseType || typeof isCorrect !== 'boolean') {
      return res.status(400).json({
        message: "FlashcardId(s), exerciseType and isCorrect are required"
      });
    }

    // ОНОВЛЕНО: Додано listen-and-choose до валідних типів вправ
    const validExerciseTypes = ['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose', 'dialog', 'reading-comprehension'];
    if (!validExerciseTypes.includes(exerciseType)) {
      return res.status(400).json({
        message: "Invalid exercise type"
      });
    }

    let processedWords = [];
    let resultMessage = "";

    // Обробляємо кожне слово
    for (const wordId of wordIds) {
      const flashcard = await Flashcard.findOne({ _id: wordId, userId });

      if (!flashcard) {
        console.warn(`Flashcard not found: ${wordId}`);
        continue;
      }

      let progressChanged = false;

      // ВИПРАВЛЕНО: Спеціальна логіка для reading comprehension
      if (exerciseType === 'reading-comprehension') {
        // Слова вже позначені як використані при виборі, тут тільки оновлюємо дату
        console.log(`📖 Word "${flashcard.text}" already marked as used during selection (isRC: ${flashcard.isReadingComprehensionExercise})`);

        // Просто оновлюємо дату останнього повторення
        flashcard.lastReviewedAt = new Date();
        progressChanged = true;

        if (progressChanged) {
          await flashcard.save();
        }

        processedWords.push({
          _id: flashcard._id,
          text: flashcard.text,
          status: flashcard.status,
          progressInfo: flashcard.getProgressInfo(),
          wasUpdated: progressChanged
        });

      } else if (exerciseType === 'dialog') {
        // Просто оновлюємо дату останнього повторення
        flashcard.lastReviewedAt = new Date();
        progressChanged = true;

        if (progressChanged) {
          await flashcard.save();
        }

        processedWords.push({
          _id: flashcard._id,
          text: flashcard.text,
          status: flashcard.status,
          progressInfo: flashcard.getProgressInfo(),
          wasUpdated: progressChanged
        });

        console.log(`Interactive dialog completed for word: ${flashcard.text}`);

      } else if (isCorrect) {
        // Обробляємо правильну відповідь для основних вправ (включно з listen-and-choose)
        if (['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose'].includes(exerciseType)) {
          progressChanged = flashcard.handleCorrectAnswer(exerciseType);

          if (progressChanged) {
            await flashcard.save();
          }

          processedWords.push({
            _id: flashcard._id,
            text: flashcard.text,
            status: flashcard.status,
            progressInfo: flashcard.getProgressInfo(),
            wasUpdated: progressChanged
          });
        }
      } else {
        // Обробляємо неправильну відповідь для основних вправ (включно з listen-and-choose)
        if (['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose'].includes(exerciseType)) {
          // Скидання прогресу тільки для основних вправ
          progressChanged = flashcard.handleIncorrectAnswer(exerciseType);

          if (progressChanged) {
            await flashcard.save();
          }

          processedWords.push({
            _id: flashcard._id,
            text: flashcard.text,
            status: flashcard.status,
            progressInfo: flashcard.getProgressInfo(),
            wasUpdated: progressChanged
          });
        }
      }
    }

    // Формуємо відповідне повідомлення
    if (exerciseType === 'reading-comprehension') {
      if (isCorrect) {
        resultMessage = `Правильна відповідь! Прочитано успішно. Опрацьовано ${processedWords.length} слів.`;
      } else {
        resultMessage = `Неправильна відповідь. Читайте уважніше. Опрацьовано ${processedWords.length} слів.`;
      }
    } else if (exerciseType === 'dialog') {
      resultMessage = `Інтерактивний діалог завершено! Ви покращили навички читання. Опрацьовано ${processedWords.length} слів.`;
    } else if (isCorrect) {
      const mainWord = processedWords[0];
      if (mainWord) {
        const progressInfo = mainWord.progressInfo;
        resultMessage = `Правильна відповідь! Прогрес: ${progressInfo.progress}%`;
      } else {
        resultMessage = "Правильна відповідь!";
      }
    } else {
      resultMessage = "Неправильна відповідь. Прогрес скинуто.";
    }

    // ОНОВЛЕНО: Додано listen-and-choose до основних вправ
    const isMainExercise = ['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose'].includes(exerciseType);

    console.log(`📊 Exercise result summary:`);
    console.log(`   Type: ${exerciseType}`);
    console.log(`   Words processed: ${processedWords.length}`);
    console.log(`   Words: ${processedWords.map(w => w.text).join(', ')}`);
    console.log(`   Updated: ${processedWords.filter(w => w.wasUpdated).length}`);

    // Повертаємо результат
    return res.status(200).json({
      success: true,
      flashcard: processedWords.length > 0 ? processedWords[0] : null,
      allWords: processedWords,
      message: resultMessage,
      isMainExercise: isMainExercise,
      exerciseType: exerciseType,
      wordsProcessed: processedWords.length
    });

  } catch (error) {
    console.log("Error in handleExerciseResult controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// ВИПРАВЛЕНО: Додано рандомізацію порядку слів для всіх типів вправ
const getWordsForExercise = async (req, res) => {
  try {
    const { exerciseType } = req.params;
    const { limit = 10, categoryId, excludeIds } = req.query;
    const userId = req.user._id;

    // ОНОВЛЕНО: Додано listen-and-choose до валідних типів вправ
    const validExerciseTypes = ['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose', 'dialog', 'reading-comprehension'];
    if (!validExerciseTypes.includes(exerciseType)) {
      return res.status(400).json({
        message: "Invalid exercise type"
      });
    }

    let excludeIdsList = [];
    if (excludeIds) {
      try {
        excludeIdsList = Array.isArray(excludeIds) ? excludeIds : excludeIds.split(',');
      } catch (error) {
        console.warn("Failed to parse excludeIds:", error);
      }
    }

    let words;
    let wasRotationApplied = false;
    let allCategoryWords = [];

    // Логіка для reading comprehension з НЕГАЙНИМ позначенням слів
    if (exerciseType === 'reading-comprehension') {
      console.log(`Getting words for reading comprehension: userId=${userId}, categoryId=${categoryId}, limit=${limit}, excludeIds=${excludeIdsList.length}`);

      const result = await Flashcard.getWordsForReadingComprehensionWithRotationInfo(userId, categoryId, parseInt(limit) || 3, excludeIdsList);

      words = result.words;
      wasRotationApplied = result.wasRotationApplied;
      allCategoryWords = result.allCategoryWords;

      if (words.length === 0) {
        console.warn(`No words found for reading comprehension`);
        return res.status(200).json({
          words: [],
          total: 0,
          exerciseType,
          wasRotationApplied: false,
          allCategoryWords: allCategoryWords,
          note: "No words available for reading comprehension"
        });
      }

      // ДОДАНО: Перемішуємо слова для reading comprehension
      words = shuffleArray(words);

      console.log(`Found ${words.length} words for reading comprehension (shuffled):`, words.map(w => w.text));
      console.log(`Rotation applied: ${wasRotationApplied}`);

      return res.status(200).json({
        words: words,
        total: words.length,
        exerciseType,
        wasRotationApplied,
        allCategoryWords: allCategoryWords,
        note: wasRotationApplied
            ? `Words selected after rotation reset - all RC flags cleared for fresh cycle`
            : `Words selected for reading comprehension using rotation logic - already marked as used`
      });
    }

    // Логіка для діалогу з додаванням рандомізації
    if (exerciseType === 'dialog') {
      console.log(`Getting words for dialog: userId=${userId}, categoryId=${categoryId}, limit=${limit}`);

      const baseQuery = { userId };

      if (categoryId && categoryId !== 'all' && categoryId !== null) {
        if (categoryId === 'uncategorized') {
          baseQuery.categoryId = null;
        } else {
          baseQuery.categoryId = categoryId;
        }
      }

      if (excludeIdsList.length > 0) {
        baseQuery._id = { $nin: excludeIdsList };
      }

      const allWordsInCategory = await Flashcard.find(baseQuery)
          .populate('categoryId', 'name color')
          .sort({ lastReviewedAt: 1 });

      if (allWordsInCategory.length === 0) {
        console.warn(`No words found for dialog`);
        return res.status(200).json({
          words: [],
          total: 0,
          exerciseType,
          note: "No words available"
        });
      }

      // ДОДАНО: Перемішуємо всі слова перед вибором
      const shuffledWords = shuffleArray(allWordsInCategory);
      const requestedCount = parseInt(limit) || 10;
      const selectedWords = shuffledWords.slice(0, Math.min(requestedCount, shuffledWords.length));

      console.log(`Found ${selectedWords.length} words for dialog (shuffled):`, selectedWords.map(w => w.text));

      return res.status(200).json({
        words: selectedWords,
        total: selectedWords.length,
        exerciseType,
        note: `Words selected for dialog (randomized order)`
      });
    }

    // ВИПРАВЛЕНО: Логіка для інших типів вправ з додаванням рандомізації (включно з listen-and-choose)
    if (categoryId && categoryId !== 'all') {
      const categoryQuery = categoryId === 'uncategorized' ? null : categoryId;

      const baseQuery = {
        userId,
        categoryId: categoryQuery
      };

      if (excludeIdsList.length > 0) {
        baseQuery._id = { $nin: excludeIdsList };
      }

      const learningQuery = { ...baseQuery, status: "learning" };

      switch (exerciseType) {
        case 'sentence-completion':
          learningQuery.isSentenceCompletionExercise = false;
          break;
        case 'multiple-choice':
          learningQuery.isMultipleChoiceExercise = false;
          break;
        case 'listen-and-fill':
          learningQuery.isListenAndFillExercise = false;
          break;
        case 'listen-and-choose': // ДОДАНО: нова вправа
          learningQuery.isListenAndChooseExercise = false;
          break;
      }

      // ВИПРАВЛЕНО: Спочатку отримуємо всі доступні learning слова, потім перемішуємо
      let learningWords = await Flashcard.find(learningQuery)
          .populate('categoryId', 'name color')
          .sort({ lastReviewedAt: 1 });

      // ДОДАНО: Перемішуємо learning слова
      learningWords = shuffleArray(learningWords);
      words = learningWords.slice(0, parseInt(limit));

      if (words.length < parseInt(limit)) {
        const needed = parseInt(limit) - words.length;
        const reviewQuery = { ...baseQuery, status: "review" };

        const usedIds = [...excludeIdsList, ...words.map(w => w._id.toString())];
        if (usedIds.length > 0) {
          reviewQuery._id = { $nin: usedIds };
        }

        // ВИПРАВЛЕНО: Отримуємо всі review слова, потім перемішуємо
        let reviewWords = await Flashcard.find(reviewQuery)
            .populate('categoryId', 'name color')
            .sort({ lastReviewedAt: 1 });

        // ДОДАНО: Перемішуємо review слова
        reviewWords = shuffleArray(reviewWords);
        const selectedReviewWords = reviewWords.slice(0, needed);

        words = [...words, ...selectedReviewWords];
      }
    } else {
      // Використовуємо статичний метод для отримання слів
      let allWords = await Flashcard.getWordsForExercise(userId, exerciseType, parseInt(limit) * 3, excludeIdsList);

      // ДОДАНО: Перемішуємо отримані слова
      allWords = shuffleArray(allWords);
      words = allWords.slice(0, parseInt(limit));
    }

    // ДОДАНО: Логування для debug
    console.log(`🎲 getWordsForExercise: Retrieved ${words.length} words for ${exerciseType} (randomized order):`, words.map(w => w.text));

    return res.status(200).json({
      words,
      total: words.length,
      exerciseType,
      breakdown: {
        learning: words.filter(w => w.status === 'learning').length,
        review: words.filter(w => w.status === 'review').length
      }
    });

  } catch (error) {
    console.log("Error in getWordsForExercise controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getLearningStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Flashcard.getLearningStats(userId);

    return res.status(200).json(stats);
  } catch (error) {
    console.log("Error in getLearningStats controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getWordsWithProgress = async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user._id;

    const words = await Flashcard.getWordsWithProgress(userId, status);

    return res.status(200).json(words);
  } catch (error) {
    console.log("Error in getWordsWithProgress controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const resetWordProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const flashcard = await Flashcard.findOne({ _id: id, userId });

    if (!flashcard) {
      return res.status(404).json({ message: "Flashcard not found" });
    }

    flashcard.status = "learning";
    flashcard.isSentenceCompletionExercise = false;
    flashcard.isMultipleChoiceExercise = false;
    flashcard.isListenAndFillExercise = false;
    flashcard.isListenAndChooseExercise = false; // ДОДАНО: скидання нової вправи
    flashcard.isReadingComprehensionExercise = false;
    flashcard.reviewedAt = null;
    flashcard.lastReviewedAt = new Date();

    await flashcard.save();

    return res.status(200).json({
      message: "Прогрес скинуто",
      flashcard: {
        _id: flashcard._id,
        text: flashcard.text,
        status: flashcard.status,
        progressInfo: flashcard.getProgressInfo()
      }
    });

  } catch (error) {
    console.log("Error in resetWordProgress controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// ДОДАНО: Нова функція для оновлення карток до останньої версії
const migrateFlashcardsToLatestVersion = async (req, res) => {
  try {
    const userId = req.user._id;

    console.log(`Starting flashcard migration for user: ${userId}`);

    // Отримуємо всі картки користувача
    const userFlashcards = await Flashcard.find({ userId });

    if (userFlashcards.length === 0) {
      return res.status(200).json({
        message: "Немає карток для оновлення",
        updated: 0,
        total: 0
      });
    }

    let updatedCount = 0;

    for (const flashcard of userFlashcards) {
      let needsUpdate = false;

      // Міграція 1: Додавання нового поля isListenAndChooseExercise
      if (!flashcard.hasOwnProperty('isListenAndChooseExercise')) {
        flashcard.isListenAndChooseExercise = false;
        needsUpdate = true;
      }

      // Міграція 2: Конвертація старого поля example в новий масив examples
      if (flashcard.example && (!flashcard.examples || flashcard.examples.length === 0)) {
        flashcard.examples = [flashcard.example.trim()];
        needsUpdate = true;
      }

      // Міграція 3: Очищення пустих елементів в масиві examples
      if (flashcard.examples && Array.isArray(flashcard.examples)) {
        const cleanedExamples = flashcard.examples.filter(ex => ex && ex.trim());
        if (cleanedExamples.length !== flashcard.examples.length) {
          flashcard.examples = cleanedExamples;
          needsUpdate = true;
        }
      }

      // Міграція 4: Забезпечення наявності всіх обов'язкових полів
      if (!flashcard.addedToLearningAt) {
        flashcard.addedToLearningAt = flashcard.createdAt || new Date();
        needsUpdate = true;
      }

      if (!flashcard.lastReviewedAt) {
        flashcard.lastReviewedAt = flashcard.createdAt || new Date();
        needsUpdate = true;
      }

      if (!flashcard.status) {
        flashcard.status = "learning";
        needsUpdate = true;
      }

      // Міграція 5: Забезпечення наявності всіх полів вправ
      if (!flashcard.hasOwnProperty('isSentenceCompletionExercise')) {
        flashcard.isSentenceCompletionExercise = false;
        needsUpdate = true;
      }

      if (!flashcard.hasOwnProperty('isMultipleChoiceExercise')) {
        flashcard.isMultipleChoiceExercise = false;
        needsUpdate = true;
      }

      if (!flashcard.hasOwnProperty('isListenAndFillExercise')) {
        flashcard.isListenAndFillExercise = false;
        needsUpdate = true;
      }

      if (!flashcard.hasOwnProperty('isReadingComprehensionExercise')) {
        flashcard.isReadingComprehensionExercise = false;
        needsUpdate = true;
      }

      if (needsUpdate) {
        try {
          await flashcard.save();
          updatedCount++;
          console.log(`Updated flashcard: ${flashcard.text}`);
        } catch (error) {
          console.error(`Error updating flashcard ${flashcard._id}:`, error);
        }
      }
    }

    console.log(`Migration completed. Updated ${updatedCount} out of ${userFlashcards.length} flashcards.`);

    return res.status(200).json({
      message: `Оновлення завершено! Оновлено ${updatedCount} карток з ${userFlashcards.length}`,
      updated: updatedCount,
      total: userFlashcards.length,
      details: {
        listenAndChooseFieldAdded: true,
        examplesMigrated: true,
        requiredFieldsEnsured: true,
        exerciseFieldsEnsured: true
      }
    });

  } catch (error) {
    console.error("Error in migrateFlashcardsToLatestVersion:", error);
    return res.status(500).json({
      message: "Помилка при оновленні карток",
      error: error.message
    });
  }
};

export default {
  createFlashcard,
  getFlashcards,
  updateFlashcard,
  deleteFlashcard,
  getFlashcardsGrouped,
  handleExerciseResult,
  getWordsForExercise,
  getLearningStats,
  getWordsWithProgress,
  resetWordProgress,
  migrateFlashcardsToLatestVersion, // ДОДАНО: новий endpoint
};