// frontend/src/components/exercises/MultipleChoiceExercise.jsx - ВИПРАВЛЕНА ВЕРСІЯ З МИТТЄВИМ ОНОВЛЕННЯМ ПРОГРЕСУ

import { useState, useEffect, useCallback } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import ExerciseLayout from "../shared/ExerciseLayout.jsx";
import DetailedCardInfo from "../shared/DetailedCardInfo.jsx";
import {
    CheckCircle, XCircle, Brain, Loader, BookOpen
} from "lucide-react";

const MultipleChoiceExercise = ({
                                    rightOptionCard,
                                    optionCards,
                                    onExit,
                                    progress = null, // { current, total, correct }
                                    isLastQuestion = false,
                                    onRestart,
                                    isProcessing = false,
                                    onProgressUpdate = null // ДОДАНО: Callback для оновлення прогресу
                                }) => {
    const { generateFieldContent } = useFlashcardStore();
    const { getDefaultEnglishLevel } = useUserSettingsStore();

    const [currentExplanation, setCurrentExplanation] = useState("");
    const [answerOptions, setAnswerOptions] = useState([]);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showResult, setShowResult] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [updatedCard, setUpdatedCard] = useState(null);
    const [internalProcessing, setInternalProcessing] = useState(false);

    // Комбінований стейт обробки
    const combinedProcessing = isProcessing || internalProcessing;

    const displayCard = updatedCard || rightOptionCard;
    const englishLevel = getDefaultEnglishLevel();

    // Check if we have required props
    if (!rightOptionCard || !optionCards || optionCards.length < 4) {
        return (
            <div className="text-center py-12">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                        Недостатньо варіантів
                    </h3>
                    <p className="text-yellow-700">
                        Для цієї вправи потрібно мінімум 4 варіанти відповіді.
                    </p>
                </div>
                <button
                    onClick={() => onExit({ completed: false })}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                >
                    Повернутися
                </button>
            </div>
        );
    }

    // Функція для повного reset стану
    const resetExerciseState = useCallback(() => {
        console.log(`Resetting exercise state for card: ${rightOptionCard?._id}`);

        // Скидаємо всі стани
        setCurrentExplanation("");
        setAnswerOptions([]);
        setSelectedAnswer(null);
        setIsCorrect(null);
        setIsLoading(true);
        setShowResult(false);
        setIsGenerating(false);
        setUpdatedCard(null);
        setInternalProcessing(false);
    }, [rightOptionCard?._id]);

    const generateQuestion = async (card) => {
        if (!card) return;

        setIsLoading(true);
        setIsGenerating(true);
        setUpdatedCard(null);

        try {
            setShowResult(false);

            console.log(`Generating question for word: "${card.text}"`);

            const explanation = await generateFieldContent(
                card.text,
                englishLevel,
                "exerciseExplanation"
            );

            const allOptions = optionCards.map(c => c.text);
            const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

            setCurrentExplanation(explanation);
            setAnswerOptions(shuffledOptions);
            setSelectedAnswer(null);
            setIsCorrect(null);

            console.log(`Question generated successfully for: "${card.text}"`);
        } catch (error) {
            console.error("Error generating question:", error);

            // Fallback explanation
            const fallbackExplanation = card.explanation ||
                card.shortDescription ||
                `A word or phrase: "${card.text}"`;

            setCurrentExplanation(fallbackExplanation);

            const allOptions = optionCards.map(c => c.text);
            setAnswerOptions(allOptions.sort(() => Math.random() - 0.5));
            setSelectedAnswer(null);
            setIsCorrect(null);
            setShowResult(false);

            console.log(`Using fallback explanation for: "${card.text}"`);
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    // useEffect з правильним cleanup та reset
    useEffect(() => {
        if (rightOptionCard) {
            console.log(`Exercise initialized for card: "${rightOptionCard.text}" - ID: ${rightOptionCard._id}`);

            // Повний reset стану перед новим питанням
            resetExerciseState();

            // Невелика затримка перед генерацією нового питання
            const timer = setTimeout(() => {
                generateQuestion(rightOptionCard);
            }, 100);

            return () => {
                clearTimeout(timer);
                // Cleanup при unmount або зміні картки
                console.log(`Cleaning up exercise for card: ${rightOptionCard._id}`);
            };
        }
    }, [rightOptionCard?._id, resetExerciseState]);

    // useEffect для cleanup при unmount компонента
    useEffect(() => {
        return () => {
            console.log("Component unmounting: cleaning up all state");
        };
    }, []);

    const handleAnswerSelect = (answer) => {
        if (selectedAnswer !== null || combinedProcessing) return;

        const correct = answer === rightOptionCard.text;
        setSelectedAnswer(answer);
        setIsCorrect(correct);
        setShowResult(true);

        // ДОДАНО: Миттєве оновлення прогресу
        if (onProgressUpdate && progress) {
            const updatedProgress = {
                ...progress,
                correct: progress.correct + (correct ? 1 : 0),
                currentAnswered: progress.current // Відповіли на поточне питання
            };
            onProgressUpdate(updatedProgress);
        }

        console.log(`Answer selected: "${answer}", correct: ${correct}`);
    };

    const handleContinue = useCallback(() => {
        if (combinedProcessing) {
            console.log("Cannot continue: processing in progress");
            return;
        }

        console.log("Exercise continuing with result:", {
            isCorrect,
            rightOptionCard: rightOptionCard._id,
            exerciseType: 'multiple-choice'
        });
        setInternalProcessing(true);

        const result = {
            completed: true,
            isCorrect: isCorrect,
            rightOptionCard: {
                ...rightOptionCard,
                exerciseType: 'multiple-choice',
                isMistakeWord: rightOptionCard.status === 'learning' || rightOptionCard.status === 'review'
            }
        };

        onExit(result);
    }, [combinedProcessing, isCorrect, rightOptionCard, onExit]);

    const handleRestartExercise = useCallback(() => {
        if (combinedProcessing) {
            console.log("Cannot restart: processing in progress");
            return;
        }

        console.log("Restarting exercise from current question");

        if (onRestart && typeof onRestart === 'function') {
            onRestart();
        }
    }, [combinedProcessing, onRestart]);

    const handleCardUpdate = (newCard) => {
        setUpdatedCard(newCard);
    };

    if (!rightOptionCard) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Немає картки для вправи</p>
                <button
                    onClick={() => onExit({ completed: false })}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
                >
                    Повернутися
                </button>
            </div>
        );
    }

    return (
        <ExerciseLayout
            icon={Brain}
            title="Обрати варіант"
            description="Оберіть правильне слово за поясненням"
            gradientClasses="from-pink-400 to-rose-400"
            onExit={onExit}
            progress={progress}
            onRestart={handleRestartExercise}
            onContinue={handleContinue}
            isLastQuestion={isLastQuestion}
            showResult={showResult}
            isProcessing={combinedProcessing}
        >
            {/* Question Content */}
            <div className="bg-white rounded-2xl shadow-md p-8 pb-10">
                {isLoading ? (
                    <div className="text-center py-12">
                        <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                        <p className="text-gray-600">
                            {isGenerating ? "Генерую нове пояснення..." : "Завантаження..."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-lg font-medium text-gray-700 mb-4">
                                Яке слово підходить до цього опису?
                            </h2>
                            <div className="bg-blue-100/80 rounded-xl p-6 border-l-4 border-blue-400">
                                <p className="text-lg text-gray-800 font-mono leading-relaxed">
                                    {currentExplanation}
                                </p>
                            </div>
                        </div>

                        {/* Answer Options */}
                        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
                            {answerOptions.map((option, index) => {
                                let buttonClass = "w-full p-6 text-center rounded-xl border-2 transition-all duration-200 font-medium text-lg ";

                                if (selectedAnswer === null) {
                                    buttonClass += combinedProcessing
                                        ? "border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                                        : "border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:shadow-lg hover:scale-102 cursor-pointer";
                                } else if (option === rightOptionCard.text) {
                                    buttonClass += "border-green-500 bg-green-50 text-green-700 shadow-lg";
                                } else if (option === selectedAnswer) {
                                    buttonClass += "border-red-500 bg-red-50 text-red-700 shadow-lg";
                                } else {
                                    buttonClass += "border-gray-200 bg-gray-50 text-gray-500";
                                }

                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleAnswerSelect(option)}
                                        disabled={selectedAnswer !== null || combinedProcessing}
                                        className={buttonClass}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="flex-1">{option}</span>
                                            {selectedAnswer !== null && (
                                                <span className="ml-3">
                                                    {option === rightOptionCard.text ? (
                                                        <CheckCircle className="w-6 h-6 text-green-600" />
                                                    ) : option === selectedAnswer ? (
                                                        <XCircle className="w-6 h-6 text-red-600" />
                                                    ) : null}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Detailed Card Info - ОНОВЛЕНО: передаємо isCorrect */}
            {showResult && (
                <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6">
                    <DetailedCardInfo
                        displayCard={displayCard}
                        onCardUpdate={handleCardUpdate}
                        isCorrect={isCorrect} // ДОДАНО: передача результату для керування станом згортання
                    />
                </div>
            )}
        </ExerciseLayout>
    );
};

export default MultipleChoiceExercise;