// backend/src/controllers/flashcard.controller.js - ОНОВЛЕНО: Видалено dialog та міграцію

import Flashcard from "../models/flashcard.model.js";
import Category from "../models/category.model.js";

// Функція для перемішування масиву (Fisher-Yates shuffle)
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
            isListenAndChooseExercise: false,
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

// Обробка результатів вправ
const handleExerciseResult = async (req, res) => {
    try {
        const { flashcardId, exerciseType, isCorrect, usedWordIds } = req.body;
        const userId = req.user._id;

        // Для reading comprehension використовуємо usedWordIds
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

        const validExerciseTypes = ['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose', 'reading-comprehension'];
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

            // Review картки НЕ обробляються у вправах
            if (flashcard.status === 'review') {
                console.log(`⏭️ Skipping review card "${flashcard.text}" - review cards don't participate in exercises`);
                continue;
            }

            let progressChanged = false;

            console.log(`📝 Processing "${flashcard.text}" for ${exerciseType}:`);
            console.log(`   Current status: ${flashcard.status}`);
            console.log(`   Sentence: ${flashcard.isSentenceCompletionExercise}`);
            console.log(`   Multiple: ${flashcard.isMultipleChoiceExercise}`);
            console.log(`   Listen: ${flashcard.isListenAndFillExercise}`);
            console.log(`   Choose: ${flashcard.isListenAndChooseExercise}`);
            console.log(`   Reading: ${flashcard.isReadingComprehensionExercise}`);

            // Спеціальна логіка для reading comprehension
            if (exerciseType === 'reading-comprehension') {
                console.log(`📖 Word "${flashcard.text}" already marked as used during selection (isRC: ${flashcard.isReadingComprehensionExercise})`);

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
                    wasUpdated: progressChanged,
                    isSentenceCompletionExercise: flashcard.isSentenceCompletionExercise,
                    isMultipleChoiceExercise: flashcard.isMultipleChoiceExercise,
                    isListenAndFillExercise: flashcard.isListenAndFillExercise,
                    isListenAndChooseExercise: flashcard.isListenAndChooseExercise,
                    isReadingComprehensionExercise: flashcard.isReadingComprehensionExercise,
                    lastReviewedAt: flashcard.lastReviewedAt
                });

            } else if (isCorrect) {
                // Обробляємо правильну відповідь
                if (['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose'].includes(exerciseType)) {
                    progressChanged = flashcard.handleCorrectAnswer(exerciseType);

                    if (progressChanged) {
                        await flashcard.save();

                        console.log(`✅ After correct answer processing for "${flashcard.text}":`);
                        console.log(`   Status: ${flashcard.status}`);
                        console.log(`   Sentence: ${flashcard.isSentenceCompletionExercise}`);
                        console.log(`   Multiple: ${flashcard.isMultipleChoiceExercise}`);
                        console.log(`   Listen: ${flashcard.isListenAndFillExercise}`);
                        console.log(`   Choose: ${flashcard.isListenAndChooseExercise}`);
                    }

                    processedWords.push({
                        _id: flashcard._id,
                        text: flashcard.text,
                        status: flashcard.status,
                        progressInfo: flashcard.getProgressInfo(),
                        wasUpdated: progressChanged,
                        isSentenceCompletionExercise: flashcard.isSentenceCompletionExercise,
                        isMultipleChoiceExercise: flashcard.isMultipleChoiceExercise,
                        isListenAndFillExercise: flashcard.isListenAndFillExercise,
                        isListenAndChooseExercise: flashcard.isListenAndChooseExercise,
                        isReadingComprehensionExercise: flashcard.isReadingComprehensionExercise,
                        lastReviewedAt: flashcard.lastReviewedAt
                    });
                }
            } else {
                // Обробляємо неправильну відповідь
                if (['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose'].includes(exerciseType)) {
                    progressChanged = flashcard.handleIncorrectAnswer(exerciseType);

                    if (progressChanged) {
                        await flashcard.save();

                        console.log(`❌ After incorrect answer processing for "${flashcard.text}":`);
                        console.log(`   Status: ${flashcard.status} (should be learning)`);
                        console.log(`   All exercise flags reset to false`);
                    }

                    processedWords.push({
                        _id: flashcard._id,
                        text: flashcard.text,
                        status: flashcard.status,
                        progressInfo: flashcard.getProgressInfo(),
                        wasUpdated: progressChanged,
                        isSentenceCompletionExercise: flashcard.isSentenceCompletionExercise,
                        isMultipleChoiceExercise: flashcard.isMultipleChoiceExercise,
                        isListenAndFillExercise: flashcard.isListenAndFillExercise,
                        isListenAndChooseExercise: flashcard.isListenAndChooseExercise,
                        isReadingComprehensionExercise: flashcard.isReadingComprehensionExercise,
                        lastReviewedAt: flashcard.lastReviewedAt
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

        const isMainExercise = ['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose'].includes(exerciseType);

        console.log(`📊 Exercise result summary:`);
        console.log(`   Type: ${exerciseType}`);
        console.log(`   Words processed: ${processedWords.length}`);
        console.log(`   Words: ${processedWords.map(w => w.text).join(', ')}`);
        console.log(`   Updated: ${processedWords.filter(w => w.wasUpdated).length}`);

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

// Отримання слів для вправ
const getWordsForExercise = async (req, res) => {
    try {
        const { exerciseType } = req.params;
        const { limit = 10, categoryId, excludeIds } = req.query;
        const userId = req.user._id;

        const validExerciseTypes = ['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose', 'reading-comprehension'];
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

        // Швидкий режим для core вправ
        const coreExercises = ['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose'];

        if (coreExercises.includes(exerciseType)) {
            console.log(`⚡ Fast mode: Getting words for core exercise ${exerciseType}: userId=${userId}, categoryId=${categoryId}, limit=${limit}`);

            const baseQuery = {
                userId,
                status: "learning"
            };

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

            switch (exerciseType) {
                case 'sentence-completion':
                    baseQuery.isSentenceCompletionExercise = false;
                    break;
                case 'multiple-choice':
                    baseQuery.isMultipleChoiceExercise = false;
                    break;
                case 'listen-and-fill':
                    baseQuery.isListenAndFillExercise = false;
                    break;
                case 'listen-and-choose':
                    baseQuery.isListenAndChooseExercise = false;
                    break;
            }

            let learningWords = await Flashcard.find(baseQuery)
                .populate('categoryId', 'name color')
                .sort({ lastReviewedAt: 1 });

            console.log(`⚡ Fast mode: Found ${learningWords.length} available learning words for ${exerciseType}`);

            if (learningWords.length > 0) {
                console.log(`⚡ Available words:`, learningWords.map(w => `"${w.text}"`));
            }

            learningWords = shuffleArray(learningWords);
            words = learningWords.slice(0, parseInt(limit));

            console.log(`⚡ Fast mode: Selected ${words.length} learning words for ${exerciseType} (shuffled):`, words.map(w => w.text));

            return res.status(200).json({
                words,
                total: words.length,
                exerciseType,
                mode: 'fast',
                breakdown: {
                    learning: words.length,
                    review: 0
                }
            });
        }

        // Логіка для reading comprehension
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
                    mode: 'network',
                    wasRotationApplied: false,
                    allCategoryWords: allCategoryWords,
                    note: "No words available for reading comprehension"
                });
            }

            words = shuffleArray(words);

            console.log(`Found ${words.length} words for reading comprehension (shuffled):`, words.map(w => w.text));
            console.log(`Rotation applied: ${wasRotationApplied}`);

            return res.status(200).json({
                words: words,
                total: words.length,
                exerciseType,
                mode: 'network',
                wasRotationApplied,
                allCategoryWords: allCategoryWords,
                note: wasRotationApplied
                    ? `Words selected after rotation reset - all RC flags cleared for fresh cycle`
                    : `Words selected for reading comprehension using rotation logic - already marked as used`
            });
        }

        console.log(`🎲 getWordsForExercise: Retrieved words for ${exerciseType} (network mode)`);

        return res.status(200).json({
            words: words || [],
            total: (words || []).length,
            exerciseType,
            mode: 'network',
            breakdown: {
                learning: (words || []).filter(w => w.status === 'learning').length,
                review: (words || []).filter(w => w.status === 'review').length
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
        flashcard.isListenAndChooseExercise = false;
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
                progressInfo: flashcard.getProgressInfo(),
                isSentenceCompletionExercise: flashcard.isSentenceCompletionExercise,
                isMultipleChoiceExercise: flashcard.isMultipleChoiceExercise,
                isListenAndFillExercise: flashcard.isListenAndFillExercise,
                isListenAndChooseExercise: flashcard.isListenAndChooseExercise,
                isReadingComprehensionExercise: flashcard.isReadingComprehensionExercise,
                lastReviewedAt: flashcard.lastReviewedAt
            }
        });

    } catch (error) {
        console.log("Error in resetWordProgress controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
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
};