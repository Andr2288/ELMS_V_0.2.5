// frontend/src/components/shared/ExerciseResult.jsx - ОНОВЛЕНО З ПІДТРИМКОЮ LISTEN-AND-CHOOSE

import {
    Trophy, RefreshCw, Home, Award, BarChart3, Star,
    CheckCircle, Clock, BookOpen, Activity, Zap, Flame,
    MessageCircle, FileText, ChevronDown, ChevronUp,
    Target, Brain, Type, Headphones, Eye, Users,
    Sparkles, ArrowRight, Layers, AlertCircle, Volume2
} from "lucide-react";
import { useState } from "react";

const ExerciseResult = ({
                            results, // { correct, total, exerciseType, sessionProgress, timeSpent, allCategoryWords?, selectedCategory? }
                            onRestart,
                            onExit,
                            gradientClasses = "from-blue-400 to-purple-500",
                            isProcessing = false,
                            isRestarting = false // ДОДАНО: стан перезапуску
                        }) => {

    const [showProgressTable, setShowProgressTable] = useState(false);

    if (!results) return null;

    // ДОДАНО: Показуємо лоадер при перезапуску
    if (isRestarting) {
        return (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className={`px-8 py-10 text-white`}>
                    <div className="text-center">
                        <Trophy className="w-16 h-16 mx-auto text-white mb-6 animate-spin" />
                        <h2 className="text-3xl font-bold mb-3">
                            Підготовка нової вправи...
                        </h2>
                        <p className="text-xl text-white/90">
                            Ініціалізація вправи
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Спеціальна логіка для інтерактивного діалогу
    const isInteractiveDialog = results.exerciseType === 'dialog';

    // Спеціальна логіка для reading comprehension
    const isReadingComprehension = results.exerciseType === 'reading-comprehension';

    // Для інтерактивного діалогу "правильність" завжди 100%, оскільки немає помилок
    const percentage = isInteractiveDialog ? 100 : Math.round((results.correct / results.total) * 100);

    // Повідомлення для інтерактивного діалогу
    let message, icon;

    if (isInteractiveDialog) {
        message = "Чудово! Ви успішно пройшли інтерактивний діалог і покращили навички читання!";
        icon = MessageCircle;
    } else if (percentage >= 90) {
        message = "Чудово! Ви досягли відмінного результату!";
        icon = Trophy;
    } else if (percentage >= 70) {
        message = "Дуже добре! Ви успішно впоралися з більшістю завдань.";
        icon = Award;
    } else if (percentage >= 50) {
        message = "Непогано! Ви на правильному шляху.";
        icon = Star;
    } else {
        message = "Продовжуйте практикуватися! Кожна спроба покращує ваші навички.";
        icon = Zap;
    }

    // ОНОВЛЕНО: Додано listen-and-choose до списку вправ
    const exerciseNames = {
        'multiple-choice': 'Обрати варіант',
        'sentence-completion': 'Доповни речення',
        'listen-and-fill': 'Слухання та письмо',
        'listen-and-choose': 'Прослухати та обрати', // ДОДАНО: нова вправа
        'dialog': 'Інтерактивний діалог',
        'reading-comprehension': 'Розуміння прочитаного',
        'quick-warmup': 'Швидка розминка',
        'intensive-mode': 'Інтенсивний режим',
        'knowledge-marathon': 'Марафон знань',
        'mixed-practice': 'Міксована практика'
    };

    const exerciseName = exerciseNames[results.exerciseType] || 'Практика';

    // Спеціальні повідомлення з урахуванням всіх типів вправ
    const getSpecialMessage = () => {
        if (results.exerciseType === 'dialog') {
            return "Фантастично! Ви навчилися приймати рішення в англійських розмовах і покращили розуміння контексту!";
        }

        if (results.exerciseType === 'reading-comprehension') {
            if (percentage >= 90) {
                return "Чудово! Ви відмінно розумієте прочитані тексти!";
            } else if (percentage >= 70) {
                return "Відмінно! Ваші навички читання на високому рівні.";
            } else if (percentage >= 50) {
                return "Добре! Продовжуйте практикувати читання для покращення.";
            } else {
                return "Читання потребує практики. Зверніть увагу на деталі тексту.";
            }
        }

        // ДОДАНО: Спеціальні повідомлення для listen-and-choose
        if (results.exerciseType === 'listen-and-choose') {
            if (percentage >= 90) {
                return "Відмінно! Ваш слух і розуміння на найвищому рівні!";
            } else if (percentage >= 70) {
                return "Чудово! Ви добре розумієте англійську на слух.";
            } else if (percentage >= 50) {
                return "Гарна робота! Продовжуйте тренувати слух для кращих результатів.";
            } else {
                return "Слухання потребує практики. Приділіть більше уваги аудіо-матеріалам.";
            }
        }

        if (results.exerciseType === 'quick-warmup') {
            if (percentage >= 90) {
                return "Фантастично! Ви майстерно справилися з різними типами вправ!";
            } else if (percentage >= 70) {
                return "Відмінна розминка! Ви показали гарні результати в усіх вправах.";
            } else if (percentage >= 50) {
                return "Добра розминка! Продовжуйте практикуватися для кращих результатів.";
            } else {
                return "Розминка завершена! Різні типи вправ допоможуть покращити навички.";
            }
        }

        if (results.exerciseType === 'intensive-mode') {
            if (percentage >= 90) {
                return "Неймовірно! Ви блискуче впоралися з інтенсивним режимом!";
            } else if (percentage >= 70) {
                return "Відмінно! Інтенсивна практика дала свої результати.";
            } else if (percentage >= 50) {
                return "Гарна робота! Інтенсивний режим допомагає швидше вчитися.";
            } else {
                return "Інтенсивний режим завершено! Регулярна практика покращить результати.";
            }
        }

        if (results.exerciseType === 'knowledge-marathon') {
            if (percentage >= 90) {
                return "Вражаючий результат! Ви успішно завершили марафон знань!";
            } else if (percentage >= 70) {
                return "Чудово! Ваша витривалість і знання на високому рівні.";
            } else if (percentage >= 50) {
                return "Марафон завершено! Ви показали хорошу стійкість у навчанні.";
            } else {
                return "Марафон знань завершено! Довга практика розвиває концентрацію.";
            }
        }

        if (results.exerciseType === 'mixed-practice') {
            if (percentage >= 90) {
                return "Фантастично! Ви відмінно впоралися з міксованою практикою!";
            } else if (percentage >= 70) {
                return "Чудово! Різноманітні вправи показали ваш високий рівень.";
            } else if (percentage >= 50) {
                return "Добра робота! Міксована практика допомагає комплексному розвитку.";
            } else {
                return "Міксована практика завершена! Різні типи вправ розвивають всі навички.";
            }
        }

        return message;
    };

    const finalMessage = getSpecialMessage();
    const Icon = icon;

    // ОНОВЛЕНО: Функція для отримання іконки типу вправи (додано нову вправу)
    const getExerciseIcon = (exerciseType) => {
        const icons = {
            'multiple-choice': Brain,
            'sentence-completion': Type,
            'listen-and-fill': Headphones,
            'listen-and-choose': Volume2, // ДОДАНО: іконка для нової вправи
            'dialog': MessageCircle,
            'reading-comprehension': FileText
        };
        return icons[exerciseType] || Target;
    };

    // Функція для отримання назви статусу
    const getStatusName = (status) => {
        return status === 'learning' ? 'Вивчається' : 'Вивчено';
    };

    // Функція для отримання кольору статусу
    const getStatusColor = (status) => {
        return status === 'learning'
            ? 'text-blue-600 bg-blue-100'
            : 'text-green-600 bg-green-100';
    };

    // Функція для отримання кольору прогресу
    const getProgressColor = (progress) => {
        if (progress === 100) return 'text-green-600';
        if (progress >= 66) return 'text-blue-600';
        if (progress >= 33) return 'text-purple-600';
        return 'text-pink-600';
    };

    // Функція для отримання назви категорії
    const getCategoryDisplayName = (selectedCategory) => {
        if (!selectedCategory || selectedCategory === 'all') return 'всіх категорій';
        if (selectedCategory === 'uncategorized') return 'без категорії';
        return '';
    };

    // Підрахунок статистики для reading comprehension
    const getSessionStatistics = () => {
        // Для reading comprehension показуємо статистику всієї категорії
        if (isReadingComprehension && results.allCategoryWords) {
            const allWords = results.allCategoryWords;
            const sessionWordIds = (results.sessionProgress || [])
                .filter(progress => progress.exerciseType === 'reading-comprehension')
                .map(progress => progress.flashcardId);

            const sessionWords = allWords.filter(word =>
                sessionWordIds.includes(word.flashcardId || word._id)
            );

            return {
                totalUniqueWords: allWords.length,
                sessionWords: sessionWords.length,
                readingComprehensionWords: allWords.filter(word =>
                    word.progressInfo?.exercises?.readingComprehension ||
                    word.isReadingComprehensionExercise
                ).length,
                coreExerciseWords: 0,
                dialogWords: 0,
                totalWordInstances: sessionWords.length
            };
        }

        // Для всіх інших вправ використовуємо стандартну логіку
        if (!results.sessionProgress || results.sessionProgress.length === 0) {
            return {
                totalUniqueWords: 0,
                readingComprehensionWords: 0,
                coreExerciseWords: 0,
                dialogWords: 0,
                totalWordInstances: 0
            };
        }

        const uniqueWords = new Map();
        let readingComprehensionWords = 0;
        let coreExerciseWords = 0;
        let dialogWords = 0;

        results.sessionProgress.forEach(wordProgress => {
            const wordId = wordProgress.flashcardId || wordProgress._id;

            if (!uniqueWords.has(wordId)) {
                uniqueWords.set(wordId, wordProgress);
            }

            if (wordProgress.exerciseType === 'reading-comprehension') {
                readingComprehensionWords++;
            } else if (['sentence-completion', 'multiple-choice', 'listen-and-fill', 'listen-and-choose'].includes(wordProgress.exerciseType)) { // ОНОВЛЕНО: додано нову вправу
                coreExerciseWords++;
            } else if (wordProgress.exerciseType === 'dialog') {
                dialogWords++;
            }
        });

        return {
            totalUniqueWords: uniqueWords.size,
            totalWordInstances: results.sessionProgress.length,
            readingComprehensionWords,
            coreExerciseWords,
            dialogWords
        };
    };

    const sessionStats = getSessionStatistics();

    // Для reading comprehension показуємо ВСІ слова категорії з актуальними статусами
    const wordsToDisplay = (() => {
        if (isReadingComprehension && results.allCategoryWords) {
            return results.allCategoryWords.map(word => {
                const wasInSession = (results.sessionProgress || []).some(progress =>
                    (progress.flashcardId || progress._id) === (word.flashcardId || word._id) &&
                    progress.exerciseType === 'reading-comprehension'
                );

                return {
                    flashcardId: word.flashcardId || word._id,
                    _id: word.flashcardId || word._id,
                    text: word.text,
                    exerciseType: 'reading-comprehension',
                    isCorrect: wasInSession ? results.correct > 0 : null,
                    progressInfo: word.progressInfo || {
                        status: word.status || 'learning',
                        progress: word.status === 'review' ? 100 :
                            Math.round(([
                                word.isSentenceCompletionExercise || word.progressInfo?.exercises?.sentenceCompletion,
                                word.isMultipleChoiceExercise || word.progressInfo?.exercises?.multipleChoice,
                                word.isListenAndFillExercise || word.progressInfo?.exercises?.listenAndFill,
                                word.isListenAndChooseExercise || word.progressInfo?.exercises?.listenAndChoose // ДОДАНО: нова вправа
                            ].filter(Boolean).length / 4) * 100), // ОНОВЛЕНО: тепер 4 основні вправи
                        exercises: {
                            sentenceCompletion: word.isSentenceCompletionExercise || word.progressInfo?.exercises?.sentenceCompletion || false,
                            multipleChoice: word.isMultipleChoiceExercise || word.progressInfo?.exercises?.multipleChoice || false,
                            listenAndFill: word.isListenAndFillExercise || word.progressInfo?.exercises?.listenAndFill || false,
                            listenAndChoose: word.isListenAndChooseExercise || word.progressInfo?.exercises?.listenAndChoose || false, // ДОДАНО: нова вправа
                            readingComprehension: word.isReadingComprehensionExercise || word.progressInfo?.exercises?.readingComprehension || false
                        }
                    },
                    categoryId: word.categoryId,
                    isInCurrentSession: wasInSession
                };
            });
        } else {
            return results.sessionProgress || [];
        }
    })();

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${gradientClasses} px-8 py-10 text-white`}>
                <div className="text-center">
                    <div className="mb-6">
                        <Icon className="w-16 h-16 mx-auto text-white" />
                    </div>
                    <h2 className="text-3xl font-bold mb-3">
                        {results.exerciseType === 'dialog' ? 'Інтерактивний діалог завершено!' :
                            results.exerciseType === 'reading-comprehension' ? 'Читання завершено!' :
                                results.exerciseType === 'quick-warmup' ? 'Розминку завершено!' :
                                    results.exerciseType === 'intensive-mode' ? 'Інтенсивний режим завершено!' :
                                        results.exerciseType === 'knowledge-marathon' ? 'Марафон знань завершено!' :
                                            results.exerciseType === 'mixed-practice' ? 'Міксовану практику завершено!' :
                                                results.exerciseType === 'listen-and-choose' ? 'Вправу прослухати та обрати завершено!' : // ДОДАНО
                                                    'Вправу завершено!'}
                    </h2>
                    <p className="text-xl text-white/90">{finalMessage}</p>
                </div>
            </div>

            {/* Results */}
            <div className="p-8">
                {/* Спеціальне відображення для інтерактивного діалогу */}
                {isInteractiveDialog ? (
                    <div className="flex justify-center items-center mb-8">
                        <div className="relative w-48 h-48">
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                    <Users className="w-16 h-16 text-indigo-600 mx-auto mb-3" />
                                    <span className="text-4xl font-bold text-indigo-600">100%</span>
                                    <p className="text-sm text-gray-500">Завершено</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center items-center mb-8">
                        <div className="relative w-48 h-48">
                            <div className="absolute inset-0 rounded-full bg-gray-100"></div>
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                                <circle
                                    className="text-gray-200"
                                    strokeWidth="10"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="40"
                                    cx="50"
                                    cy="50"
                                />
                                <circle
                                    className={`${percentage >= 70 ? 'text-green-500' : percentage >= 50 ? 'text-blue-500' : 'text-purple-500'}`}
                                    strokeWidth="10"
                                    strokeDasharray={`${percentage * 2.51}, 251`}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="40"
                                    cx="50"
                                    cy="50"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                    <span className="text-4xl font-bold">{percentage}%</span>
                                    <p className="text-sm text-gray-500">
                                        {isInteractiveDialog ? 'Завершено' : 'Успішність'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Статистика */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {isInteractiveDialog ? (
                        <>
                            <div className="bg-indigo-50 rounded-xl p-4 text-center">
                                <MessageCircle className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Діалогових кроків</p>
                                <p className="text-2xl font-bold text-indigo-600">{results.total || 0}</p>
                            </div>

                            <div className="bg-purple-50 rounded-xl p-4 text-center">
                                <Eye className="w-5 h-5 text-purple-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Практика читання</p>
                                <p className="text-lg font-bold text-purple-600">Інтерактивна</p>
                            </div>

                            <div className="bg-green-50 rounded-xl p-4 text-center">
                                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Статус</p>
                                <p className="text-2xl font-bold text-green-600">Завершено</p>
                            </div>
                        </>
                    ) : results.exerciseType === 'reading-comprehension' ? (
                        <>
                            <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                <FileText className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Слів у категорії</p>
                                <p className="text-2xl font-bold text-emerald-600">{sessionStats.totalUniqueWords}</p>
                            </div>

                            <div className="bg-blue-50 rounded-xl p-4 text-center">
                                <BookOpen className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Текстів прочитано</p>
                                <p className="text-2xl font-bold text-blue-600">{results.total}</p>
                            </div>

                            <div className="bg-purple-50 rounded-xl p-4 text-center">
                                <BarChart3 className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Успішність</p>
                                <p className="text-2xl font-bold text-purple-600">{percentage}%</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-blue-50 rounded-xl p-4 text-center">
                                <CheckCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Правильних відповідей</p>
                                <p className="text-2xl font-bold text-blue-600">{results.correct} з {results.total}</p>
                            </div>

                            <div className="bg-purple-50 rounded-xl p-4 text-center">
                                <BarChart3 className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 mb-1">Тип вправи</p>
                                <p className="text-lg font-bold text-purple-600">{exerciseName}</p>
                            </div>

                            {results.timeSpent ? (
                                <div className="bg-green-50 rounded-xl p-4 text-center">
                                    <Clock className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600 mb-1">Витрачений час</p>
                                    <p className="text-2xl font-bold text-green-600">{results.timeSpent}</p>
                                </div>
                            ) : (
                                <div className="bg-green-50 rounded-xl p-4 text-center">
                                    <Activity className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                    <p className="text-sm text-gray-600 mb-1">Навчальна активність</p>
                                    <p className="text-2xl font-bold text-green-600">+{Math.round(percentage / 10)} XP</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Таблиця прогресу */}
                {wordsToDisplay && wordsToDisplay.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-6 mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                <Target className="w-5 h-5 mr-2 text-blue-600" />
                                {isReadingComprehension ? (
                                    <>
                                        Прогрес слів у категорії
                                    </>
                                ) : (
                                    <>
                                        Прогрес слів у сесії
                                        {results.exerciseType === 'reading-comprehension' && (
                                            <span className="ml-2 text-sm text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                                                {sessionStats.totalUniqueWords} унікальних із {sessionStats.totalWordInstances}
                                            </span>
                                        )}
                                    </>
                                )}
                            </h3>
                            <button
                                onClick={() => setShowProgressTable(!showProgressTable)}
                                className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                            >
                                {showProgressTable ? 'Сховати' : 'Показати'}
                                {showProgressTable ? (
                                    <ChevronUp className="w-4 h-4 ml-1" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 ml-1" />
                                )}
                            </button>
                        </div>

                        {showProgressTable && (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Слово</th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">
                                            {isReadingComprehension ? 'Категорія' : 'Вправа'}
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold text-gray-700">
                                            {isReadingComprehension ? 'Поточна сесія' : 'Результат'}
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Статус</th>
                                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Прогрес</th>
                                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Основні вправи</th>
                                        <th className="text-center py-3 px-4 font-semibold text-gray-700">Додаткові вправи</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {wordsToDisplay.map((wordProgress, index) => {
                                        const ExerciseIcon = getExerciseIcon(wordProgress.exerciseType);
                                        const progress = wordProgress.progressInfo?.progress || 0;
                                        const exercises = wordProgress.progressInfo?.exercises || {};

                                        const isFromCurrentSession = wordProgress.isInCurrentSession;
                                        const rowClasses = isReadingComprehension && isFromCurrentSession
                                            ? "border-b border-emerald-100 hover:bg-emerald-50 bg-emerald-50/50 transition-colors"
                                            : "border-b border-gray-100 hover:bg-white transition-colors";

                                        return (
                                            <tr key={`${wordProgress.flashcardId || wordProgress._id}-${index}`} className={rowClasses}>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-gray-900 flex items-center">
                                                        {wordProgress.text}
                                                        {isReadingComprehension && isFromCurrentSession && (
                                                            <span className="ml-2 w-2 h-2 bg-emerald-500 rounded-full" title="Використано в поточній сесії"></span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {isReadingComprehension ? (
                                                        <div className="text-sm text-gray-600">
                                                            {wordProgress.categoryId?.name || 'Без категорії'}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center">
                                                            <ExerciseIcon className="w-4 h-4 mr-2 text-gray-500" />
                                                            <span className="text-sm text-gray-600">
                                                                {exerciseNames[wordProgress.exerciseType]}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {isReadingComprehension ? (
                                                        isFromCurrentSession ? (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                                В сесії
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )
                                                    ) : wordProgress.exerciseType === 'dialog' ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                            <MessageCircle className="w-3 h-3 mr-1" />
                                                            Завершено
                                                        </span>
                                                    ) : wordProgress.exerciseType === 'reading-comprehension' ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                            <FileText className="w-3 h-3 mr-1" />
                                                            {wordProgress.isCorrect ? 'Правильно' : 'Помилка'}
                                                        </span>
                                                    ) : wordProgress.isCorrect ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            <CheckCircle className="w-3 h-3 mr-1" />
                                                            Правильно
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                                                            ✗ Помилка
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                        getStatusColor(wordProgress.progressInfo?.status || 'learning')
                                                    }`}>
                                                        {getStatusName(wordProgress.progressInfo?.status || 'learning')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                                            <div
                                                                className={`h-2 rounded-full ${
                                                                    progress === 100 ? 'bg-green-500' :
                                                                        progress >= 66 ? 'bg-blue-500' :
                                                                            progress >= 33 ? 'bg-purple-500' : 'bg-pink-500'
                                                                }`}
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-sm font-medium ${getProgressColor(progress)}`}>
                                                            {progress}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex justify-center space-x-1">
                                                        <div
                                                            className={`w-4 h-4 rounded-sm ${
                                                                exercises.sentenceCompletion ? 'bg-green-500' : 'bg-gray-200'
                                                            }`}
                                                            title="Доповни речення"
                                                        />
                                                        <div
                                                            className={`w-4 h-4 rounded-sm ${
                                                                exercises.multipleChoice ? 'bg-green-500' : 'bg-gray-200'
                                                            }`}
                                                            title="Обрати варіант"
                                                        />
                                                        <div
                                                            className={`w-4 h-4 rounded-sm ${
                                                                exercises.listenAndFill ? 'bg-green-500' : 'bg-gray-200'
                                                            }`}
                                                            title="Слухання та письмо"
                                                        />
                                                        {/* ДОДАНО: Індикатор для нової вправи */}
                                                        <div
                                                            className={`w-4 h-4 rounded-sm ${
                                                                exercises.listenAndChoose ? 'bg-green-500' : 'bg-gray-200'
                                                            }`}
                                                            title="Прослухати та обрати"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex justify-center space-x-1">
                                                        <div
                                                            className={`w-4 h-4 rounded-sm ${
                                                                exercises.readingComprehension ? 'bg-purple-500' : 'bg-gray-200'
                                                            }`}
                                                            title="Розуміння прочитаного"
                                                        />
                                                        <div
                                                            className="w-4 h-4 rounded-sm bg-indigo-200"
                                                            title="Діалог (завжди доступний)"
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Controls */}
                <div className="flex justify-between">
                    <button
                        onClick={() => !isProcessing && !isRestarting && onExit()}
                        disabled={isProcessing || isRestarting}
                        className={`px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium transition-all flex items-center ${
                            isProcessing || isRestarting
                                ? 'opacity-60 cursor-not-allowed'
                                : 'cursor-pointer'
                        }`}
                    >
                        <Home className="w-5 h-5 mr-2" />
                        На головну
                    </button>

                    <button
                        onClick={() => !isProcessing && !isRestarting && onRestart()}
                        disabled={isProcessing || isRestarting}
                        className={`px-6 py-3 bg-gradient-to-r ${gradientClasses} text-white rounded-xl font-medium transition-all flex items-center ${
                            isProcessing || isRestarting
                                ? 'opacity-60 cursor-not-allowed'
                                : 'hover:shadow-lg cursor-pointer'
                        }`}
                    >
                        <RefreshCw className="w-5 h-5 mr-2" />
                        {results.exerciseType === 'dialog' ? 'Новий діалог' :
                            results.exerciseType === 'reading-comprehension' ? 'Нові тексти' :
                                results.exerciseType === 'quick-warmup' ? 'Нова розминка' :
                                    results.exerciseType === 'intensive-mode' ? 'Новий інтенсив' :
                                        results.exerciseType === 'knowledge-marathon' ? 'Новий марафон' :
                                            results.exerciseType === 'mixed-practice' ? 'Нова практика' :
                                                results.exerciseType === 'listen-and-choose' ? 'Спробувати ще раз' : // ДОДАНО
                                                    'Спробувати ще раз'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExerciseResult;