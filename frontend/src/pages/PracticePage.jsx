// frontend/src/pages/PracticePage.jsx - ОПТИМІЗОВАНО: ШВИДКЕ ЗАВАНТАЖЕННЯ ВПРАВ

import { useState, useEffect, useRef, useCallback } from "react";
import { useFlashcardStore } from "../store/useFlashcardStore.js";
import { useCategoryStore } from "../store/useCategoryStore.js";
import MultipleChoiceExercise from "../components/exercises/MultipleChoiceExercise.jsx";
import ListenAndFillExercise from "../components/exercises/ListenAndFillExercise.jsx";
import ListenAndChooseExercise from "../components/exercises/ListenAndChooseExercise.jsx";
import SentenceCompletionExercise from "../components/exercises/SentenceCompletionExercise.jsx";
import DialogExercise from "../components/exercises/DialogExercise.jsx";
import ReadingComprehensionExercise from "../components/exercises/ReadingComprehensionExercise.jsx";
import ExerciseResult from "../components/shared/ExerciseResult.jsx";
import {
    Target, BookOpen, Play, Headphones, Shuffle, Brain, Type,
    CheckSquare, Volume2, Clock, ArrowRight, Star, TrendingUp,
    Calendar, Filter, X, Zap, Award, Activity, Users,
    Sparkles, Flame, ChevronRight, BarChart3, Medal,
    Globe, Settings, RefreshCw, Lightbulb, Timer, Trophy,
    MessageCircle, FileText, Eye, Layers, Loader, Download
} from "lucide-react";

// Функція для перемішування масиву (Fisher-Yates shuffle)
const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

const PracticePage = () => {
    const {
        flashcards,
        getFlashcards,
        handleExerciseResult,
        getWordsForExercise,
        getLearningStats,
        learningStats,
        migrateFlashcardsToLatestVersion
    } = useFlashcardStore();
    const { categories, getCategories } = useCategoryStore();

    const activeRequestRef = useRef(null);
    const componentMountedRef = useRef(true);

    const [selectedCategory, setSelectedCategory] = useState('all');
    const [practiceCards, setPracticeCards] = useState([]);
    const [currentExercise, setCurrentExercise] = useState(null);
    const [showCategoryFilter, setShowCategoryFilter] = useState(false);
    const [showExerciseResult, setShowExerciseResult] = useState(false);
    const [exerciseResults, setExerciseResults] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [sessionCards, setSessionCards] = useState([]);
    const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
    const [sessionProgress, setSessionProgress] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [questionLoading, setQuestionLoading] = useState(false);

    // ДОДАНО: Стейт для зберігання списку вправ категорії
    const [categoryExercisesList, setCategoryExercisesList] = useState([]);
    const [currentSessionExercises, setCurrentSessionExercises] = useState([]);

    // Стейт для відстеження використаних слів в сесії (для Reading Comprehension)
    const [sessionUsedWordIds, setSessionUsedWordIds] = useState([]);

    // Стейт для відстеження прогресу в реальному часі
    const [currentSessionProgress, setCurrentSessionProgress] = useState({ correct: 0, currentAnswered: 0 });

    // Стейт для лоадера при restart
    const [isRestarting, setIsRestarting] = useState(false);

    // Стейт для кнопки міграції
    const [isMigrating, setIsMigrating] = useState(false);

    const [practiceStats, setPracticeStats] = useState({
        todayCompleted: 3,
        dailyGoal: 10,
        currentStreak: 7,
        thisWeekCompleted: 18,
        weeklyGoal: 50,
        totalCompleted: 247
    });

    // ОНОВЛЕНО: Визначення основних та додаткових вправ
    const coreExercises = ['multiple-choice', 'sentence-completion', 'listen-and-fill', 'listen-and-choose'];
    const advancedExercises = ['dialog', 'reading-comprehension'];
    const allExerciseTypes = [...coreExercises, ...advancedExercises];

    useEffect(() => {
        componentMountedRef.current = true;
        return () => {
            componentMountedRef.current = false;
            if (activeRequestRef.current) {
                activeRequestRef.current.cancelled = true;
            }
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                await Promise.all([
                    getFlashcards(),
                    getCategories(),
                    getLearningStats()
                ]);
            } catch (error) {
                console.error("Error loading initial data:", error);
            }
        };
        loadData();
    }, [getFlashcards, getCategories, getLearningStats]);

    useEffect(() => {
        let filteredCards = [...flashcards];

        if (selectedCategory === 'learning') {
            filteredCards = flashcards.filter(card => card.status === 'learning');
        } else if (selectedCategory === 'review') {
            filteredCards = flashcards.filter(card => card.status === 'review');
        } else if (selectedCategory !== 'all') {
            if (selectedCategory === 'uncategorized') {
                filteredCards = flashcards.filter(card => !card.categoryId);
            } else {
                filteredCards = flashcards.filter(card => card.categoryId?._id === selectedCategory);
            }
        }

        setPracticeCards(filteredCards);

        // ДОДАНО: Генеруємо список всіх можливих вправ для категорії
        generateCategoryExercisesList(filteredCards);
    }, [flashcards, selectedCategory]);

    // ДОДАНО: Функція для генерації списку всіх можливих вправ категорії
    const generateCategoryExercisesList = useCallback((cards) => {
        const exercisesList = [];
        let exId = 1;

        // Спочатку додаємо learning картки
        const learningCards = cards.filter(card => card.status === 'learning');
        const reviewCards = cards.filter(card => card.status === 'review');

        // Генеруємо вправи для learning карток (пріоритет)
        learningCards.forEach(flashcard => {
            coreExercises.forEach(exerciseType => {
                // Перевіряємо чи може картка використовуватися у цій вправі
                if (canCardUseExercise(flashcard, exerciseType)) {
                    exercisesList.push({
                        exId: exId++,
                        flashcard,
                        exerciseType,
                        priority: 'learning' // Пріоритет для learning карток
                    });
                }
            });
        });

        // Додаємо review картки (другий пріоритет)
        reviewCards.forEach(flashcard => {
            coreExercises.forEach(exerciseType => {
                exercisesList.push({
                    exId: exId++,
                    flashcard,
                    exerciseType,
                    priority: 'review' // Нижчий пріоритет
                });
            });
        });

        console.log(`📋 Generated exercises list: ${exercisesList.length} exercises for ${cards.length} cards`);
        console.log(`   Learning exercises: ${exercisesList.filter(ex => ex.priority === 'learning').length}`);
        console.log(`   Review exercises: ${exercisesList.filter(ex => ex.priority === 'review').length}`);

        setCategoryExercisesList(exercisesList);
    }, [coreExercises]);

    // ДОДАНО: Функція перевірки чи може картка використовуватися у вправі
    const canCardUseExercise = useCallback((flashcard, exerciseType) => {
        // Для review карток - можна використовувати всі вправи
        if (flashcard.status === 'review') {
            return true;
        }

        // Для learning карток - перевіряємо чи не пройшла вже цю вправу
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
    }, []);

    useEffect(() => {
        if (!currentExercise) {
            setCurrentQuestion(null);
            setQuestionLoading(false);
            return;
        }

        const loadCurrentQuestion = async () => {
            setQuestionLoading(true);
            try {
                const question = await getCurrentQuestion();
                setCurrentQuestion(question);
            } catch (error) {
                console.error("Error loading current question:", error);
                setCurrentQuestion(null);
            } finally {
                setQuestionLoading(false);
            }
        };

        loadCurrentQuestion();
    }, [currentQuestionIndex, currentExercise, sessionUsedWordIds]);

    const safeSetState = useCallback((setter, value) => {
        if (componentMountedRef.current) {
            setter(value);
        }
    }, []);

    const cancelPreviousRequest = useCallback(() => {
        if (activeRequestRef.current) {
            activeRequestRef.current.cancelled = true;
            activeRequestRef.current = null;
        }
    }, []);

    // ОНОВЛЕНО: Функція для швидкого вибору вправ із заготовленого списку
    const selectExercisesFromList = useCallback((requestedCount, exerciseMode = 'core') => {
        if (categoryExercisesList.length === 0) {
            console.warn("No exercises available in category list");
            return [];
        }

        console.log(`🎯 Selecting ${requestedCount} exercises from ${categoryExercisesList.length} available exercises`);

        // Розділяємо на learning та review вправи
        const learningExercises = categoryExercisesList.filter(ex => ex.priority === 'learning');
        const reviewExercises = categoryExercisesList.filter(ex => ex.priority === 'review');

        console.log(`   Learning exercises available: ${learningExercises.length}`);
        console.log(`   Review exercises available: ${reviewExercises.length}`);

        let selectedExercises = [];

        // Спочатку намагаємося взяти learning вправи
        if (learningExercises.length >= requestedCount) {
            // Якщо learning вправ достатньо - берем тільки їх
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
                // Якщо навіть з review не вистачає - беремо що є
                const shuffledReview = shuffleArray([...reviewExercises]);
                selectedExercises = [...shuffledLearning, ...shuffledReview];
                console.log(`   ⚠️ Not enough exercises: got ${selectedExercises.length} out of ${requestedCount} requested`);
            }
        }

        // Фінальне перемішування об'єднаного списку
        const finalExercises = shuffleArray(selectedExercises);

        console.log(`🎲 Final selection (${finalExercises.length} exercises):`,
            finalExercises.map((ex, i) => `${i+1}. ${ex.flashcard.text} (${ex.exerciseType}, ${ex.priority})`));

        return finalExercises;
    }, [categoryExercisesList]);

    const generateOptionCards = useCallback((rightCard, allCards, exerciseType) => {
        if (exerciseType === 'listen-and-fill') {
            return [];
        }

        if (exerciseType === 'reading-comprehension' || exerciseType === 'dialog') {
            return allCards;
        }

        const minOptions = 4;
        const otherCards = allCards.filter(card => card._id !== rightCard._id);

        if (otherCards.length < minOptions - 1) {
            return [rightCard, ...otherCards];
        }

        const shuffledOthers = shuffleArray(otherCards);
        const wrongOptions = shuffledOthers.slice(0, minOptions - 1);

        return [rightCard, ...wrongOptions];
    }, []);

    const getCurrentQuestion = useCallback(async () => {
        if (!currentExercise || currentQuestionIndex >= currentSessionExercises.length) {
            return null;
        }

        const currentExerciseData = currentSessionExercises[currentQuestionIndex];
        if (!currentExerciseData) {
            console.error("No exercise data found for current question index");
            return null;
        }

        const rightCard = currentExerciseData.flashcard;
        const currentExerciseType = currentExerciseData.exerciseType;

        let optionCards;

        if (currentExerciseType === 'reading-comprehension' || currentExerciseType === 'dialog') {
            optionCards = practiceCards;
            console.log(`${currentExerciseType} question ${currentQuestionIndex + 1} prepared with word: ${rightCard.text}`);
        } else {
            optionCards = generateOptionCards(rightCard, practiceCards, currentExerciseType);
        }

        return {
            rightOptionCard: rightCard,
            optionCards: optionCards,
            questionNumber: currentQuestionIndex + 1,
            totalQuestions: currentSessionExercises.length,
            exerciseType: currentExerciseType
        };
    }, [currentExercise, currentQuestionIndex, currentSessionExercises, generateOptionCards, practiceCards]);

    // ОНОВЛЕНО: Швидка ініціалізація сеансів використовуючи заготовлений список
    const initializeExerciseSession = useCallback(async (exerciseType, maxQuestions = 10) => {
        if (isProcessing) {
            console.log("Request already in progress, ignoring new request");
            return null;
        }

        cancelPreviousRequest();

        const requestToken = { cancelled: false };
        activeRequestRef.current = requestToken;

        safeSetState(setIsProcessing, true);

        try {
            console.log(`🚀 Fast initializing ${exerciseType} session with optimized approach`);

            // Очищаємо sessionUsedWordIds при початку нової сесії
            safeSetState(setSessionUsedWordIds, []);

            if (requestToken.cancelled) {
                console.log("Request was cancelled during initialization");
                return null;
            }

            // СПЕЦІАЛЬНА ЛОГІКА: Advanced вправи використовують стару логіку
            if (advancedExercises.includes(exerciseType)) {
                return await initializeAdvancedExercise(exerciseType, maxQuestions, requestToken);
            }

            // НОВА ЛОГІКА: Швидкий старт для основних вправ
            if (['quick-warmup', 'intensive-mode', 'knowledge-marathon', 'mixed-practice'].includes(exerciseType)) {
                const cardCounts = {
                    'quick-warmup': 10,
                    'intensive-mode': 20,
                    'knowledge-marathon': 30,
                    'mixed-practice': 15
                };

                const requiredCount = cardCounts[exerciseType];

                if (categoryExercisesList.length === 0) {
                    throw new Error(`No exercises available for ${exerciseType}`);
                }

                console.log(`⚡ Fast loading: ${exerciseType} needs ${requiredCount} exercises from ${categoryExercisesList.length} available`);

                // Швидкий вибір вправ із заготовленого списку
                const selectedExercises = selectExercisesFromList(requiredCount, 'core');

                if (selectedExercises.length === 0) {
                    throw new Error(`No exercises selected for ${exerciseType}`);
                }

                if (componentMountedRef.current && !requestToken.cancelled) {
                    const words = selectedExercises.map(ex => ex.flashcard);

                    safeSetState(setCurrentSessionExercises, selectedExercises);
                    safeSetState(setSessionCards, words);
                    safeSetState(setCurrentQuestionIndex, 0);
                    safeSetState(setSessionStats, { correct: 0, total: 0 });
                    safeSetState(setSessionProgress, []);
                    safeSetState(setShowExerciseResult, false);
                    safeSetState(setExerciseResults, null);
                    safeSetState(setCurrentSessionProgress, { correct: 0, currentAnswered: 0 });

                    console.log(`⚡ ${exerciseType} session initialized INSTANTLY with ${selectedExercises.length} exercises`);

                    return {
                        type: exerciseType,
                        cards: words,
                        exercises: selectedExercises,
                        mode: 'core',
                        loadTime: 'instant'
                    };
                }
            }

            // Звичайні основні вправи також використовують швидкий підхід
            if (coreExercises.includes(exerciseType)) {
                const selectedExercises = selectExercisesFromList(maxQuestions, 'core')
                    .filter(ex => ex.exerciseType === exerciseType);

                if (selectedExercises.length === 0) {
                    throw new Error(`No ${exerciseType} exercises available`);
                }

                if (componentMountedRef.current && !requestToken.cancelled) {
                    const words = selectedExercises.map(ex => ex.flashcard);

                    safeSetState(setCurrentSessionExercises, selectedExercises);
                    safeSetState(setSessionCards, words);
                    safeSetState(setCurrentQuestionIndex, 0);
                    safeSetState(setSessionStats, { correct: 0, total: 0 });
                    safeSetState(setSessionProgress, []);
                    safeSetState(setShowExerciseResult, false);
                    safeSetState(setExerciseResults, null);
                    safeSetState(setCurrentSessionProgress, { correct: 0, currentAnswered: 0 });

                    console.log(`⚡ ${exerciseType} session initialized INSTANTLY with ${selectedExercises.length} exercises`);

                    return {
                        type: exerciseType,
                        cards: words,
                        exercises: selectedExercises,
                        mode: 'core',
                        loadTime: 'instant'
                    };
                }
            }

            return null;

        } catch (error) {
            console.error("Error initializing exercise session:", error);
            if (componentMountedRef.current && !requestToken.cancelled) {
                alert("Помилка ініціалізації вправи");
            }
            return null;
        } finally {
            if (activeRequestRef.current === requestToken) {
                activeRequestRef.current = null;
            }
            if (componentMountedRef.current) {
                safeSetState(setIsProcessing, false);
            }
        }
    }, [isProcessing, cancelPreviousRequest, safeSetState, categoryExercisesList, selectExercisesFromList, advancedExercises, coreExercises]);

    // ДОДАНО: Окрема функція для advanced вправ (стара логіка)
    const initializeAdvancedExercise = useCallback(async (exerciseType, maxQuestions, requestToken) => {
        console.log(`📖 Initializing advanced exercise: ${exerciseType}`);

        // Reading comprehension з рандомізацією та правильним excludeIds
        if (exerciseType === 'reading-comprehension') {
            console.log(`📖 Starting reading-comprehension session with 3 questions`);

            const minCardsRequired = 3;

            if (practiceCards.length < minCardsRequired) {
                if (componentMountedRef.current && !requestToken.cancelled) {
                    alert(`Для цієї вправи потрібно мінімум ${minCardsRequired} карток. Зараз доступно: ${practiceCards.length}`);
                }
                return null;
            }

            console.log(`📖 Reading comprehension session initialization - starting fresh`);

            try {
                const wordsData = await getWordsForExercise(
                    'reading-comprehension',
                    3,
                    selectedCategory === 'all' ? null : selectedCategory,
                    []
                );

                if (requestToken.cancelled || !componentMountedRef.current) {
                    console.log("Request was cancelled during reading comprehension setup");
                    return null;
                }

                if (wordsData.words.length < 3) {
                    if (componentMountedRef.current && !requestToken.cancelled) {
                        alert(`Недостатньо слів для reading comprehension. Потрібно мінімум 3, доступно: ${wordsData.words.length}`);
                    }
                    return null;
                }

                const selectedCards = shuffleArray([...wordsData.words]);

                if (componentMountedRef.current && !requestToken.cancelled) {
                    safeSetState(setSessionCards, selectedCards);
                    safeSetState(setCurrentQuestionIndex, 0);
                    safeSetState(setSessionStats, { correct: 0, total: 0 });
                    safeSetState(setSessionProgress, []);
                    safeSetState(setShowExerciseResult, false);
                    safeSetState(setExerciseResults, null);
                    safeSetState(setCurrentSessionProgress, { correct: 0, currentAnswered: 0 });

                    // Створюємо фейковий список вправ для сумісності
                    const fakeExercises = selectedCards.map(card => ({
                        flashcard: card,
                        exerciseType: 'reading-comprehension'
                    }));
                    safeSetState(setCurrentSessionExercises, fakeExercises);

                    console.log(`📖 Reading comprehension session initialized with 3 questions for words (shuffled):`,
                        selectedCards.map(c => c.text));

                    if (wordsData.wasRotationApplied) {
                        console.log(`🔄 Rotation was applied during session initialization`);

                        if (wordsData.allCategoryWords && wordsData.allCategoryWords.length > 0) {
                            setTimeout(() => {
                                getFlashcards(selectedCategory === 'all' ? null : selectedCategory);
                            }, 100);
                        }
                    }

                    return {
                        type: exerciseType,
                        cards: selectedCards,
                        mode: 'advanced',
                        wasRotationApplied: wordsData.wasRotationApplied,
                        allCategoryWords: wordsData.allCategoryWords,
                        loadTime: 'network'
                    };
                }
            } catch (error) {
                console.error("Error getting words for reading comprehension:", error);
                if (componentMountedRef.current && !requestToken.cancelled) {
                    alert("Помилка підготовки reading comprehension");
                }
                return null;
            }
        }

        // Dialog логіка
        if (exerciseType === 'dialog') {
            console.log(`💬 Starting dialog session with 3 questions`);

            const minCardsRequired = 3;

            if (practiceCards.length < minCardsRequired) {
                if (componentMountedRef.current && !requestToken.cancelled) {
                    alert(`Для цієї вправи потрібно мінімум ${minCardsRequired} карток. Зараз доступно: ${practiceCards.length}`);
                }
                return null;
            }

            const sessionUsedWordIds = sessionProgress
                .filter(progress => progress.exerciseType === 'dialog')
                .map(progress => progress.flashcardId);

            try {
                const wordsData = await getWordsForExercise(
                    'dialog',
                    3,
                    selectedCategory === 'all' ? null : selectedCategory,
                    sessionUsedWordIds
                );

                if (requestToken.cancelled || !componentMountedRef.current) {
                    return null;
                }

                if (wordsData.words.length < 3) {
                    if (componentMountedRef.current && !requestToken.cancelled) {
                        alert(`Недостатньо слів для діалогу. Потрібно мінімум 3, доступно: ${wordsData.words.length}`);
                    }
                    return null;
                }

                const selectedCards = shuffleArray([...wordsData.words]);

                if (componentMountedRef.current && !requestToken.cancelled) {
                    safeSetState(setSessionCards, selectedCards);
                    safeSetState(setCurrentQuestionIndex, 0);
                    safeSetState(setSessionStats, { correct: 0, total: 0 });
                    safeSetState(setSessionProgress, []);
                    safeSetState(setShowExerciseResult, false);
                    safeSetState(setExerciseResults, null);
                    safeSetState(setCurrentSessionProgress, { correct: 0, currentAnswered: 0 });

                    const fakeExercises = selectedCards.map(card => ({
                        flashcard: card,
                        exerciseType: 'dialog'
                    }));
                    safeSetState(setCurrentSessionExercises, fakeExercises);

                    console.log(`💬 Dialog session initialized with 3 questions for words (shuffled):`,
                        selectedCards.map(c => c.text));

                    return {
                        type: exerciseType,
                        cards: selectedCards,
                        mode: 'advanced',
                        loadTime: 'network'
                    };
                }
            } catch (error) {
                console.error("Error getting words for dialog:", error);
                if (componentMountedRef.current && !requestToken.cancelled) {
                    alert("Помилка підготовки діалогу");
                }
                return null;
            }
        }

        return null;
    }, [getWordsForExercise, selectedCategory, practiceCards, sessionProgress, safeSetState, getFlashcards]);

    const handleExerciseClick = useCallback(async (exerciseType) => {
        if (isProcessing || isRestarting) {
            console.log("Exercise click ignored: already processing");
            return;
        }

        console.log(`⚡ Starting ${exerciseType} exercise with OPTIMIZED loading`);
        const session = await initializeExerciseSession(exerciseType);

        if (session && componentMountedRef.current) {
            console.log(`⚡ Session loaded in: ${session.loadTime || 'unknown'} mode`);
            safeSetState(setCurrentExercise, session);
        }
    }, [isProcessing, isRestarting, initializeExerciseSession, safeSetState]);

    // Callback для оновлення прогресу в реальному часі
    const handleProgressUpdate = useCallback((updatedProgress) => {
        safeSetState(setCurrentSessionProgress, updatedProgress);
    }, [safeSetState]);

    // Обробка результатів
    const handleQuestionResult = useCallback(async (result) => {
        if (isProcessing || !componentMountedRef.current) {
            console.log("Question result ignored: processing or unmounted");
            return;
        }

        safeSetState(setIsProcessing, true);

        try {
            if (!result.completed) {
                if (componentMountedRef.current) {
                    safeSetState(setCurrentExercise, null);
                    safeSetState(setSessionCards, []);
                    safeSetState(setCurrentQuestionIndex, 0);
                    safeSetState(setSessionProgress, []);
                    safeSetState(setShowExerciseResult, false);
                    safeSetState(setExerciseResults, null);
                    safeSetState(setCurrentQuestion, null);
                    safeSetState(setQuestionLoading, false);
                    safeSetState(setCurrentSessionProgress, { correct: 0, currentAnswered: 0 });
                    safeSetState(setSessionUsedWordIds, []);
                    safeSetState(setCurrentSessionExercises, []);
                }
                return;
            }

            let currentWordProgress = [];

            if (result.rightOptionCard) {
                // ОНОВЛЕНО: Отримуємо тип вправи з поточного списку сеансу
                let currentExerciseType;
                if (currentSessionExercises[currentQuestionIndex]) {
                    currentExerciseType = currentSessionExercises[currentQuestionIndex].exerciseType;
                } else {
                    currentExerciseType = currentExercise.type;
                }

                try {
                    if (currentExerciseType === 'reading-comprehension' && result.usedWordIds && result.allWordsData) {
                        console.log(`📖 Processing reading comprehension result with ${result.usedWordIds.length} words`);

                        const exerciseResult = await handleExerciseResult(
                            result.rightOptionCard._id,
                            currentExerciseType,
                            result.isCorrect,
                            result.usedWordIds
                        );

                        if (exerciseResult.allWords && Array.isArray(exerciseResult.allWords)) {
                            currentWordProgress = exerciseResult.allWords.map(backendWord => ({
                                flashcardId: backendWord._id,
                                text: backendWord.text,
                                exerciseType: currentExerciseType,
                                isCorrect: result.isCorrect,
                                progressInfo: backendWord.progressInfo || { status: 'completed', progress: 100 },
                                isInCurrentSession: true
                            }));
                        } else {
                            currentWordProgress = result.allWordsData.map(wordData => ({
                                flashcardId: wordData._id,
                                text: wordData.text,
                                exerciseType: currentExerciseType,
                                isCorrect: result.isCorrect,
                                progressInfo: { status: 'completed', progress: 100 },
                                isInCurrentSession: true
                            }));
                        }

                        if (result.newSessionUsedWordIds && Array.isArray(result.newSessionUsedWordIds)) {
                            console.log(`📖 Updating sessionUsedWordIds: ${sessionUsedWordIds.length} -> ${result.newSessionUsedWordIds.length}`);
                            safeSetState(setSessionUsedWordIds, result.newSessionUsedWordIds);
                        }

                        setTimeout(() => {
                            getFlashcards(selectedCategory === 'all' ? null : selectedCategory);
                        }, 100);

                    } else {
                        const flashcardId = result.rightOptionCard._id;

                        const exerciseResult = await handleExerciseResult(flashcardId, currentExerciseType, result.isCorrect);

                        currentWordProgress = [{
                            flashcardId,
                            text: result.rightOptionCard.text,
                            exerciseType: currentExerciseType,
                            isCorrect: result.isCorrect,
                            progressInfo: exerciseResult.flashcard.progressInfo,
                            isInCurrentSession: true
                        }];

                        console.log(`📝 Exercise result processed:`, exerciseResult.message);
                    }
                } catch (error) {
                    console.error("❌ Error handling exercise result:", error);

                    if (currentExerciseType === 'reading-comprehension' && result.allWordsData) {
                        currentWordProgress = result.allWordsData.map(wordData => ({
                            flashcardId: wordData._id,
                            text: wordData.text,
                            exerciseType: currentExerciseType,
                            isCorrect: result.isCorrect,
                            progressInfo: { status: 'completed', progress: 100 },
                            isInCurrentSession: true
                        }));
                    } else {
                        currentWordProgress = [{
                            flashcardId: result.rightOptionCard._id,
                            text: result.rightOptionCard.text,
                            exerciseType: currentExerciseType,
                            isCorrect: result.isCorrect,
                            progressInfo: { status: 'completed', progress: 100 },
                            isInCurrentSession: true
                        }];
                    }
                }
            }

            const newStats = {
                correct: sessionStats.correct + (result.isCorrect ? 1 : 0),
                total: sessionStats.total + 1
            };

            if (componentMountedRef.current) {
                if (currentWordProgress.length > 0) {
                    safeSetState(setSessionProgress, prev => {
                        const updated = [...prev, ...currentWordProgress];
                        console.log(`📊 Updated session progress: ${updated.length} total words`);
                        return updated;
                    });
                }

                safeSetState(setSessionStats, newStats);

                console.log(`📊 Current question: ${currentQuestionIndex + 1}, Total questions: ${currentSessionExercises.length}`);

                if (currentQuestionIndex < currentSessionExercises.length - 1) {
                    console.log(`📖 Moving to next question: ${currentQuestionIndex + 2}`);
                    safeSetState(setCurrentQuestionIndex, prev => prev + 1);
                } else {
                    console.log(`📖 Session completed after ${currentSessionExercises.length} questions`);
                    const updatedProgress = currentWordProgress.length > 0
                        ? [...sessionProgress, ...currentWordProgress]
                        : sessionProgress;

                    handleSessionComplete(newStats, updatedProgress);
                }
            }
        } catch (error) {
            console.error("❌ Error handling question result:", error);
        } finally {
            if (componentMountedRef.current) {
                safeSetState(setIsProcessing, false);
            }
        }
    }, [isProcessing, safeSetState, handleExerciseResult, sessionStats, currentQuestionIndex, currentSessionExercises, currentExercise, sessionProgress, sessionUsedWordIds, getFlashcards, selectedCategory]);

    const handleSessionComplete = useCallback((finalStats, actualProgress = null) => {
        if (!componentMountedRef.current) return;

        const progressToUse = actualProgress || sessionProgress;

        const results = {
            correct: finalStats.correct,
            total: finalStats.total,
            exerciseType: currentExercise.type,
            sessionProgress: progressToUse
        };

        if (currentExercise.type === 'reading-comprehension') {
            if (currentExercise.allCategoryWords) {
                console.log(`📖 Using allCategoryWords from session: ${currentExercise.allCategoryWords.length} words`);
                results.allCategoryWords = currentExercise.allCategoryWords;
            } else {
                console.log(`📖 Using practiceCards as fallback: ${practiceCards.length} words`);
                results.allCategoryWords = practiceCards;
            }

            results.selectedCategory = selectedCategory;

            console.log(`📖 Reading comprehension completed. Category words: ${results.allCategoryWords.length}, Session words: ${progressToUse.length}`);

            if (currentExercise.wasRotationApplied) {
                console.log(`🔄 Session completed with rotation - refreshing flashcards to show updated state`);
                setTimeout(() => {
                    getFlashcards(selectedCategory === 'all' ? null : selectedCategory);
                }, 1000);
            }
        }

        console.log(`Session completed with ${progressToUse.length} words in progress:`, progressToUse.map(p => p.text));

        setPracticeStats(prev => ({
            ...prev,
            todayCompleted: prev.todayCompleted + 1,
            thisWeekCompleted: prev.thisWeekCompleted + 1,
            totalCompleted: prev.totalCompleted + 1
        }));

        getLearningStats();

        safeSetState(setExerciseResults, results);
        safeSetState(setShowExerciseResult, true);
        safeSetState(setCurrentExercise, null);
        safeSetState(setCurrentQuestion, null);
        safeSetState(setQuestionLoading, false);
        safeSetState(setSessionUsedWordIds, []);
        safeSetState(setCurrentSessionExercises, []);
    }, [currentExercise, sessionProgress, safeSetState, getLearningStats, selectedCategory, getFlashcards, practiceCards]);

    // Логіка restart з лоадером
    const handleRestartExercise = useCallback(async () => {
        if (isProcessing || isRestarting) {
            console.log("Restart ignored: already processing");
            return;
        }

        const currentType = currentExercise?.type || exerciseResults?.exerciseType;

        if (currentType && componentMountedRef.current) {
            safeSetState(setIsRestarting, true);

            try {
                console.log(`🔄⚡ Restarting ${currentType} with OPTIMIZED approach`);

                // Скидаємо стани прогресу
                safeSetState(setSessionProgress, []);
                safeSetState(setCurrentQuestion, null);
                safeSetState(setQuestionLoading, false);
                safeSetState(setCurrentSessionProgress, { correct: 0, currentAnswered: 0 });
                safeSetState(setSessionUsedWordIds, []);
                safeSetState(setCurrentSessionExercises, []);

                const session = await initializeExerciseSession(currentType);

                if (session && componentMountedRef.current) {
                    console.log(`⚡ Restart completed using: ${session.loadTime || 'unknown'} mode`);
                    safeSetState(setCurrentExercise, session);
                    safeSetState(setShowExerciseResult, false);
                    safeSetState(setExerciseResults, null);
                }
            } catch (error) {
                console.error("Error restarting exercise:", error);
            } finally {
                if (componentMountedRef.current) {
                    safeSetState(setIsRestarting, false);
                }
            }
        }
    }, [isProcessing, isRestarting, currentExercise, exerciseResults, safeSetState, initializeExerciseSession]);

    const handleExitExercise = useCallback(() => {
        if (isProcessing) {
            console.log("Exit ignored: processing in progress");
            return;
        }

        cancelPreviousRequest();

        safeSetState(setIsProcessing, true);

        if (componentMountedRef.current) {
            safeSetState(setCurrentExercise, null);
            safeSetState(setSessionCards, []);
            safeSetState(setCurrentQuestionIndex, 0);
            safeSetState(setSessionStats, { correct: 0, total: 0 });
            safeSetState(setSessionProgress, []);
            safeSetState(setShowExerciseResult, false);
            safeSetState(setExerciseResults, null);
            safeSetState(setCurrentQuestion, null);
            safeSetState(setQuestionLoading, false);
            safeSetState(setCurrentSessionProgress, { correct: 0, currentAnswered: 0 });
            safeSetState(setIsRestarting, false);
            safeSetState(setSessionUsedWordIds, []);
            safeSetState(setCurrentSessionExercises, []);
        }

        setTimeout(() => {
            if (componentMountedRef.current) {
                safeSetState(setIsProcessing, false);
            }
        }, 300);
    }, [isProcessing, cancelPreviousRequest, safeSetState]);

    const handleCardUpdate = useCallback((newCard) => {
        // Placeholder for card update
    }, []);

    // Обробник для кнопки міграції карток
    const handleMigrateFlashcards = useCallback(async () => {
        if (isMigrating || isProcessing || isRestarting) {
            console.log("Migration ignored: already processing");
            return;
        }

        setIsMigrating(true);

        try {
            console.log("🔄 Starting flashcard migration to latest version...");
            const result = await migrateFlashcardsToLatestVersion();

            console.log("✅ Migration completed:", result);

            setTimeout(() => {
                getLearningStats();
            }, 1000);

        } catch (error) {
            console.error("❌ Migration failed:", error);
        } finally {
            setIsMigrating(false);
        }
    }, [isMigrating, isProcessing, isRestarting, migrateFlashcardsToLatestVersion, getLearningStats]);

    // Exercise types data з новою вправою
    const coreExercisesData = [
        {
            id: 'multiple-choice',
            title: 'Обрати варіант',
            description: 'Оберіть правильне слово за поясненням',
            icon: Brain,
            color: 'from-purple-500 to-pink-500',
            difficulty: 'Середний',
            difficultyColor: 'text-blue-600',
            difficultyBg: 'bg-blue-600',
            time: '2-3 хв',
            minCards: 4,
            category: 'core',
            features: ['Швидке запам\'ятовування', 'Логічне мислення', 'Контекстне розуміння']
        },
        {
            id: 'sentence-completion',
            title: 'Доповни речення',
            description: 'Оберіть правильне слово для пропуску',
            icon: Type,
            color: 'from-emerald-500 to-teal-500',
            difficulty: 'Середний',
            difficultyColor: 'text-blue-600',
            difficultyBg: 'bg-blue-600',
            time: '2-4 хв',
            minCards: 4,
            category: 'core',
            features: ['Граматичний контекст', 'Розуміння структури', 'Швидке мислення']
        },
        {
            id: 'listen-and-fill',
            title: 'Слухання та письмо',
            description: 'Прослухайте речення та впишіть пропущене слово',
            icon: Headphones,
            color: 'from-blue-500 to-cyan-500',
            difficulty: 'Складний',
            difficultyColor: 'text-purple-600',
            difficultyBg: 'bg-purple-600',
            time: '3-5 хв',
            minCards: 1,
            category: 'core',
            features: ['Розвиток слуху', 'Правопис', 'Вимова']
        },
        {
            id: 'listen-and-choose',
            title: 'Прослухати та обрати',
            description: 'Прослухайте пояснення та оберіть правильне слово',
            icon: Volume2,
            color: 'from-indigo-500 to-purple-500',
            difficulty: 'Середній',
            difficultyColor: 'text-blue-600',
            difficultyBg: 'bg-blue-600',
            time: '2-4 хв',
            minCards: 4,
            category: 'core',
            features: ['Розвиток слуху', 'Логічне мислення', 'Концентрація уваги']
        }
    ];

    const advancedExercisesData = [
        {
            id: 'dialog',
            title: 'Інтерактивний діалог',
            description: 'Створіть свій шлях у розмові та покращте читання',
            icon: MessageCircle,
            color: 'from-indigo-500 to-purple-500',
            difficulty: 'Легкий',
            difficultyColor: 'text-green-600',
            difficultyBg: 'bg-green-600',
            time: '3-5 хв (3 питання)',
            minCards: 3,
            category: 'advanced',
            features: ['Інтерактивні рішення', 'Практика читання', 'Контекстне розуміння']
        },
        {
            id: 'reading-comprehension',
            title: 'Розуміння прочитаного',
            description: 'Прочитайте текст та оберіть правильний факт',
            icon: FileText,
            color: 'from-emerald-400 to-teal-400',
            difficulty: 'Складний',
            difficultyColor: 'text-purple-600',
            difficultyBg: 'bg-purple-600',
            time: '3-5 хв (3 питання)',
            minCards: 3,
            category: 'advanced',
            features: ['Читання в контексті', 'Аналіз фактів', 'Детальне розуміння']
        }
    ];

    // Quick practice suggestions БЕЗ ОРАНЖЕВОГО КОЛЬОРУ
    const quickPractice = [
        {
            title: 'Швидка розминка',
            description: '10 карток, основні вправи',
            icon: Zap,
            cards: 10,
            time: '5-7 хв',
            color: 'bg-gradient-to-t from-emerald-500 to-teal-500',
            exerciseType: 'quick-warmup'
        },
        {
            title: 'Інтенсивний режим',
            description: '20 карток, основні вправи',
            icon: Flame,
            cards: 20,
            time: '10-15 хв',
            color: 'bg-gradient-to-t from-purple-600 to-pink-600',
            exerciseType: 'intensive-mode'
        },
        {
            title: 'Марафон знань',
            description: '30 карток, основні вправи',
            icon: Medal,
            cards: 30,
            time: '15-25 хв',
            color: 'bg-gradient-to-b from-indigo-600 to-purple-600',
            exerciseType: 'knowledge-marathon'
        }
    ];

    // Відображення екрану результатів з лоадером restart
    if (showExerciseResult && exerciseResults) {
        const getGradientClass = (exerciseType) => {
            const gradients = {
                'quick-warmup': 'from-emerald-500 to-teal-500',
                'intensive-mode': 'from-purple-600 to-pink-600',
                'knowledge-marathon': 'from-indigo-600 to-purple-600',
                'mixed-practice': 'from-blue-500 to-purple-600',
                'multiple-choice': 'from-purple-600 to-pink-600',
                'sentence-completion': 'from-emerald-500 to-teal-500',
                'listen-and-fill': 'from-blue-400 to-cyan-500',
                'listen-and-choose': 'from-indigo-400 to-purple-400',
                'dialog': 'from-indigo-600 to-purple-600',
                'reading-comprehension': 'from-emerald-500 to-teal-500'
            };
            return gradients[exerciseType] || 'from-blue-400 to-purple-500';
        };

        return (
            <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
                <div className="max-w-5xl mx-auto">
                    <ExerciseResult
                        results={exerciseResults}
                        onRestart={handleRestartExercise}
                        onExit={handleExitExercise}
                        gradientClasses={getGradientClass(exerciseResults.exerciseType)}
                        isProcessing={isProcessing}
                        isRestarting={isRestarting}
                    />
                </div>
            </div>
        );
    }

    // Рендер компонента вправи
    if (currentExercise) {
        if (questionLoading || !currentQuestion) {
            return (
                <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
                    <div className="max-w-4xl mx-auto text-center py-12">
                        <div className="bg-white rounded-2xl shadow-md p-8">
                            <Trophy className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
                                {questionLoading ? 'Підготовка...' : 'Підготовка...'}
                            </h2>
                            <p className="text-gray-600 mb-6">
                                {currentExercise.loadTime === 'instant' ? 'Миттєво завантажено з кешу!' : 'Ініціалізація вправи'}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        // Прогрес з урахуванням реального стану
        const progressData = {
            current: currentQuestion.questionNumber,
            total: currentQuestion.totalQuestions,
            correct: currentSessionProgress.correct
        };

        const isLastQuestion = currentQuestion.questionNumber === currentQuestion.totalQuestions;

        const renderExerciseComponent = () => {
            switch (currentQuestion.exerciseType) {
                case 'multiple-choice':
                    return (
                        <MultipleChoiceExercise
                            rightOptionCard={currentQuestion.rightOptionCard}
                            optionCards={currentQuestion.optionCards}
                            onExit={handleQuestionResult}
                            progress={progressData}
                            isLastQuestion={isLastQuestion}
                            onRestart={handleRestartExercise}
                            isProcessing={isProcessing}
                            onProgressUpdate={handleProgressUpdate}
                        />
                    );
                case 'sentence-completion':
                    return (
                        <SentenceCompletionExercise
                            rightOptionCard={currentQuestion.rightOptionCard}
                            optionCards={currentQuestion.optionCards}
                            onExit={handleQuestionResult}
                            progress={progressData}
                            isLastQuestion={isLastQuestion}
                            onRestart={handleRestartExercise}
                            isProcessing={isProcessing}
                            onProgressUpdate={handleProgressUpdate}
                        />
                    );
                case 'listen-and-fill':
                    return (
                        <ListenAndFillExercise
                            rightOptionCard={currentQuestion.rightOptionCard}
                            onExit={handleQuestionResult}
                            progress={progressData}
                            isLastQuestion={isLastQuestion}
                            onRestart={handleRestartExercise}
                            isProcessing={isProcessing}
                            onProgressUpdate={handleProgressUpdate}
                        />
                    );
                case 'listen-and-choose':
                    return (
                        <ListenAndChooseExercise
                            rightOptionCard={currentQuestion.rightOptionCard}
                            optionCards={currentQuestion.optionCards}
                            onExit={handleQuestionResult}
                            progress={progressData}
                            isLastQuestion={isLastQuestion}
                            onRestart={handleRestartExercise}
                            isProcessing={isProcessing}
                            onProgressUpdate={handleProgressUpdate}
                        />
                    );
                case 'dialog':
                    return (
                        <DialogExercise
                            rightOptionCard={currentQuestion.rightOptionCard}
                            optionCards={currentQuestion.optionCards}
                            onExit={handleQuestionResult}
                            progress={progressData}
                            isLastQuestion={isLastQuestion}
                            onRestart={handleRestartExercise}
                            isProcessing={isProcessing}
                            onProgressUpdate={handleProgressUpdate}
                        />
                    );
                case 'reading-comprehension':
                    return (
                        <ReadingComprehensionExercise
                            rightOptionCard={currentQuestion.rightOptionCard}
                            optionCards={currentQuestion.optionCards}
                            onExit={handleQuestionResult}
                            progress={progressData}
                            isLastQuestion={isLastQuestion}
                            onRestart={handleRestartExercise}
                            isProcessing={isProcessing}
                            onProgressUpdate={handleProgressUpdate}
                            sessionUsedWordIds={sessionUsedWordIds}
                        />
                    );
                default:
                    return (
                        <div className="max-w-4xl mx-auto text-center py-12">
                            <p className="text-gray-600 mb-4">Ця вправа ще в розробці</p>
                            <button
                                onClick={() => setCurrentExercise(null)}
                                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                            >
                                Повернутися
                            </button>
                        </div>
                    );
            }
        };

        return (
            <div className="ml-64 min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8">
                {renderExerciseComponent()}
            </div>
        );
    }

    return (
        <div className="relative ml-64 min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
            {/* Hero Section */}
            <div className="bg-white border-b border-gray-200 relative overflow-hidden p-8">
                <div className="mx-auto flex items-center">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-10 h-10 rounded-lg flex items-center justify-center mr-3 shadow-md">
                        <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            Практика ⚡
                        </h1>
                        <p className="text-gray-600">
                            Покращуйте свої навички через миттєві інтерактивні вправи
                        </p>
                    </div>
                </div>

                {/* ДОДАНО: Індикатор оптимізації */}
                {categoryExercisesList.length > 0 && (
                    <div className="absolute top-4 right-4">
                        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                            <Zap className="w-4 h-4 mr-1" />
                            {categoryExercisesList.length} готових вправ
                        </div>
                    </div>
                )}
            </div>

            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Category Filter */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">Оберіть категорію</h2>
                            <button
                                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                                className="lg:hidden flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                <Filter className="w-5 h-5 mr-2" />
                                Фільтр
                            </button>
                        </div>

                        <div className={`${showCategoryFilter ? 'block' : 'hidden lg:block'}`}>
                            <div className="flex flex-wrap gap-5">
                                <button
                                    onClick={() => !isProcessing && !isRestarting && setSelectedCategory('all')}
                                    disabled={isProcessing || isRestarting}
                                    className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                        isProcessing || isRestarting
                                            ? 'cursor-not-allowed opacity-60'
                                            : 'cursor-pointer'
                                    } ${
                                        selectedCategory === 'all'
                                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-105'
                                            : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                                    }`}
                                >
                                    <Globe className="w-4 h-4 inline mr-2" />
                                    Всі картки
                                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-black/20">
                                        {flashcards.length}
                                    </span>
                                </button>

                                {(() => {
                                    const uncategorizedCount = flashcards.filter(c => !c.categoryId).length;
                                    const isDisabled = uncategorizedCount === 0 || isProcessing || isRestarting;

                                    return (
                                        <button
                                            onClick={() => !isDisabled && setSelectedCategory('uncategorized')}
                                            disabled={isDisabled}
                                            className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                                isDisabled
                                                    ? 'cursor-default opacity-60'
                                                    : 'cursor-pointer'
                                            } ${
                                                selectedCategory === 'uncategorized'
                                                    ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg transform scale-105'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                                            }`}
                                        >
                                            <BookOpen className="w-4 h-4 inline mr-2" />
                                            Без категорії
                                            <span className="ml-2 px-2 py-1 text-xs rounded-full bg-black/20">
                                                {uncategorizedCount}
                                            </span>
                                        </button>
                                    );
                                })()}

                                {categories.map(category => {
                                    const totalInCategory = category.flashcardsCount || 0;
                                    const isDisabled = totalInCategory === 0 || isProcessing || isRestarting;

                                    return (
                                        <button
                                            key={category._id}
                                            onClick={() => !isDisabled && setSelectedCategory(category._id)}
                                            disabled={isDisabled}
                                            className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                                isDisabled
                                                    ? 'cursor-default opacity-60'
                                                    : 'cursor-pointer'
                                            } ${
                                                selectedCategory === category._id
                                                    ? 'text-white shadow-lg transform scale-105'
                                                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                                            }`}
                                            style={{
                                                background: selectedCategory === category._id
                                                    ? `linear-gradient(135deg, ${category.color}, ${category.color}dd)`
                                                    : undefined
                                            }}
                                        >
                                            {category.name}
                                            <span className="ml-2 px-2 py-1 text-xs rounded-full bg-black/20">
                                                {totalInCategory}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* СЕКЦІЯ 1: Швидкий старт */}
                    <div className="space-y-8 mb-12">
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <Sparkles className="w-5 h-5 mr-2 text-emerald-500" />
                                Швидкий старт ⚡ (Миттєве завантаження)
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {quickPractice.map((practice, index) => {
                                    const isAvailable = categoryExercisesList.length > 0;

                                    return (
                                        <div
                                            key={index}
                                            onClick={() => {
                                                if (isAvailable && !isProcessing && !isRestarting) {
                                                    handleExerciseClick(practice.exerciseType);
                                                }
                                            }}
                                            className={`relative group ${
                                                isAvailable && !isProcessing && !isRestarting
                                                    ? 'cursor-pointer'
                                                    : 'cursor-not-allowed opacity-60'
                                            }`}
                                        >
                                            <div className={`${practice.color} rounded-2xl p-6 text-white shadow-md transition-all duration-300 ${
                                                isAvailable && !isProcessing && !isRestarting ? 'hover:shadow-lg transform hover:-translate-y-2' : ''
                                            }`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <practice.icon className="w-8 h-8" />
                                                    {isAvailable && !isProcessing && !isRestarting && (
                                                        <div className="flex items-center">
                                                            <Zap className="w-4 h-4 mr-1" />
                                                            <span className="text-xs">Миттєво</span>
                                                        </div>
                                                    )}
                                                    {isAvailable && !isProcessing && !isRestarting && (
                                                        <ArrowRight className="w-5 h-5 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                    )}
                                                </div>
                                                <h4 className="text-lg font-semibold mb-2">{practice.title}</h4>
                                                <p className="text-white/90 text-sm mb-4">{practice.description}</p>
                                                <div className="flex items-center text-sm">
                                                    <Clock className="w-4 h-4 mr-1" />
                                                    <span>{practice.time}</span>
                                                    <span className="mx-2">•</span>
                                                    <span>до {practice.cards} карток</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Рекомендація дня (Міксована практика) */}
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                                <Lightbulb className="w-5 h-5 mr-2 text-blue-500" />
                                Рекомендація дня
                            </h3>
                            <div className="bg-gradient-to-t from-blue-500 to-purple-600 rounded-2xl p-8 text-white shadow-md">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-2xl font-bold mb-2">
                                            Міксована практика ⚡
                                        </h4>
                                        <p className="text-blue-100 mb-4">
                                            Комбінація різних типів вправ для максимального ефекту (миттєве завантаження)
                                        </p>
                                        <div className="flex items-center space-x-4 text-sm">
                                            <div className="flex items-center">
                                                <Timer className="w-4 h-4 mr-1" />
                                                10-15 хв
                                            </div>
                                            <div className="flex items-center">
                                                <BookOpen className="w-4 h-4 mr-1" />
                                                15 карток
                                            </div>
                                            <div className="flex items-center">
                                                <TrendingUp className="w-4 h-4 mr-1" />
                                                Всі типи вправ
                                            </div>
                                            <div className="flex items-center">
                                                <Zap className="w-4 h-4 mr-1" />
                                                Миттєво
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => !isProcessing && !isRestarting && handleExerciseClick('mixed-practice')}
                                        disabled={categoryExercisesList.length < 3 || isProcessing || isRestarting}
                                        className={`bg-white/10 hover:bg-white/20 disabled:bg-white/10 text-white px-14 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center ${
                                            isProcessing || isRestarting || categoryExercisesList.length < 3
                                                ? 'disabled:cursor-not-allowed'
                                                : 'cursor-pointer'
                                        }`}
                                    >
                                        Почати
                                        <Play className="w-5 h-5 ml-2" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* СЕКЦІЯ 2: Основні вправи */}
                    <div className="mb-12">
                        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                            <Target className="w-5 h-5 mr-2 text-blue-500" />
                            Основні вправи ⚡ (Миттєве завантаження)
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-8">
                            {coreExercisesData.map((exercise) => {
                                const isAvailable = categoryExercisesList.length >= exercise.minCards;
                                const Icon = exercise.icon;

                                return (
                                    <div
                                        key={exercise.id}
                                        onClick={() => isAvailable && !isProcessing && !isRestarting && handleExerciseClick(exercise.id)}
                                        className={`group relative bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col justify-between ${
                                            isAvailable && !isProcessing && !isRestarting
                                                ? 'cursor-pointer hover:-translate-y-2'
                                                : 'opacity-60 cursor-not-allowed'
                                        }`}
                                    >
                                        <div>
                                            <div className={`absolute inset-0 bg-gradient-to-br ${exercise.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl`} />

                                            {/* ДОДАНО: Індикатор миттєвого завантаження */}
                                            <div className="absolute top-4 right-4">
                                                <div className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                                                    <Zap className="w-3 h-3 mr-1" />
                                                    Миттєво
                                                </div>
                                            </div>

                                            <div className={`w-16 h-16 bg-gradient-to-br ${exercise.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                                <Icon className="w-8 h-8 text-white" />
                                            </div>

                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-xl font-bold text-gray-900">{exercise.title}</h4>
                                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                            </div>

                                            <p className="text-gray-600 mb-6">{exercise.description}</p>
                                        </div>

                                        <div className="relative">
                                            <div className="flex items-center space-x-4 mb-6 text-sm">
                                                <div className={`flex items-center ${exercise.difficultyColor}`}>
                                                    <span className={`w-2 h-2 ${exercise.difficultyBg} rounded-full mr-2`} />
                                                    {exercise.difficulty}
                                                </div>
                                                <div className="flex items-center text-blue-600">
                                                    <Clock className="w-4 h-4 mr-1" />
                                                    {exercise.time}
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-6">
                                                {exercise.features.map((feature, index) => (
                                                    <div key={index} className="flex items-center text-sm text-gray-600">
                                                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-3" />
                                                        {feature}
                                                    </div>
                                                ))}
                                            </div>

                                            {isAvailable ? (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-500">
                                                        {categoryExercisesList.filter(ex => ex.exerciseType === exercise.id).length} вправ готово
                                                    </span>
                                                    <div className={`px-4 py-2 bg-gradient-to-r ${exercise.color} text-white rounded-lg text-sm font-medium`}>
                                                        Почати
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-pink-500">
                                                    Потрібно мінімум {exercise.minCards} карток
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* СЕКЦІЯ 3: Додаткові вправи */}
                    <div className="mb-12">
                        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                            <Layers className="w-5 h-5 mr-2 text-purple-500" />
                            Додаткові вправи (Мережеве завантаження)
                        </h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                            {advancedExercisesData.map((exercise) => {
                                const isAvailable = practiceCards.length >= exercise.minCards;
                                const Icon = exercise.icon;

                                return (
                                    <div
                                        key={exercise.id}
                                        onClick={() => isAvailable && !isProcessing && !isRestarting && handleExerciseClick(exercise.id)}
                                        className={`group relative bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col justify-between ${
                                            isAvailable && !isProcessing && !isRestarting
                                                ? 'cursor-pointer hover:-translate-y-2'
                                                : 'opacity-60 cursor-not-allowed'
                                        }`}
                                    >
                                        <div>
                                            <div className={`absolute inset-0 bg-gradient-to-br ${exercise.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl`} />

                                            {/* ДОДАНО: Індикатор мережевого завантаження */}
                                            <div className="absolute top-4 right-4">
                                                <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium flex items-center">
                                                    <Globe className="w-3 h-3 mr-1" />
                                                    Мережа
                                                </div>
                                            </div>

                                            <div className={`w-16 h-16 bg-gradient-to-br ${exercise.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                                <Icon className="w-8 h-8 text-white" />
                                            </div>

                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-xl font-bold text-gray-900">{exercise.title}</h4>
                                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                                            </div>

                                            <p className="text-gray-600 mb-6">{exercise.description}</p>
                                        </div>

                                        <div className="relative">
                                            <div className="flex items-center space-x-4 mb-6 text-sm">
                                                <div className={`flex items-center ${exercise.difficultyColor}`}>
                                                    <span className={`w-2 h-2 ${exercise.difficultyBg} rounded-full mr-2`} />
                                                    {exercise.difficulty}
                                                </div>
                                                <div className="flex items-center text-purple-600">
                                                    <Clock className="w-4 h-4 mr-1" />
                                                    {exercise.time}
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-6">
                                                {exercise.features.map((feature, index) => (
                                                    <div key={index} className="flex items-center text-sm text-gray-600">
                                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-3" />
                                                        {feature}
                                                    </div>
                                                ))}
                                            </div>

                                            {isAvailable ? (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-500">
                                                        {practiceCards.length} карток доступно
                                                    </span>
                                                    <div className={`px-4 py-2 bg-gradient-to-r ${exercise.color} text-white rounded-lg text-sm font-medium`}>
                                                        Почати
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-pink-500">
                                                    Потрібно мінімум {exercise.minCards} карток
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Кнопка оновлення до останньої версії */}
                    <div className="border-t border-gray-200 pt-8">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center mr-4">
                                        <Download className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                            Оновити до останньої версії
                                        </h4>
                                        <p className="text-sm text-gray-600">
                                            Оновіть всі ваші флешкартки для сумісності з новими функціями
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleMigrateFlashcards}
                                    disabled={isMigrating || isProcessing || isRestarting || flashcards.length === 0}
                                    className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                                        isMigrating || isProcessing || isRestarting || flashcards.length === 0
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg cursor-pointer'
                                    }`}
                                >
                                    {isMigrating ? (
                                        <>
                                            <Loader className="w-5 h-5 mr-2 animate-spin" />
                                            Оновлюю...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5 mr-2" />
                                            Оновити
                                        </>
                                    )}
                                </button>
                            </div>
                            {flashcards.length === 0 && (
                                <div className="mt-3 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                                    <span className="flex items-center">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Немає карток для оновлення
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PracticePage;