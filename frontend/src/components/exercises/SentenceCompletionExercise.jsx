// frontend/src/components/exercises/SentenceCompletionExercise.jsx - ВИПРАВЛЕНА ВЕРСІЯ З МИТТЄВИМ ОНОВЛЕННЯМ ПРОГРЕСУ

import { useState, useEffect, useCallback } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import ExerciseLayout from "../shared/ExerciseLayout.jsx";
import DetailedCardInfo from "../shared/DetailedCardInfo.jsx";
import {
    CheckCircle, XCircle, Type, Loader
} from "lucide-react";

const SentenceCompletionExercise = ({
                                        rightOptionCard,
                                        optionCards,
                                        onExit,
                                        progress = null,
                                        isLastQuestion = false,
                                        onRestart,
                                        isProcessing = false,
                                        onProgressUpdate = null // ДОДАНО: Callback для оновлення прогресу
                                    }) => {
    const { generateFieldContent, translateSentenceToUkrainian } = useFlashcardStore();
    const { getDefaultEnglishLevel } = useUserSettingsStore();

    const [sentenceData, setSentenceData] = useState(null);
    const [answerOptions, setAnswerOptions] = useState([]);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showResult, setShowResult] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [updatedCard, setUpdatedCard] = useState(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [internalProcessing, setInternalProcessing] = useState(false);

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

    const resetExerciseState = useCallback(() => {
        console.log(`Resetting exercise state for card: ${rightOptionCard?._id}`);

        setSentenceData(null);
        setAnswerOptions([]);
        setSelectedAnswer(null);
        setIsCorrect(null);
        setIsLoading(true);
        setShowResult(false);
        setIsGenerating(false);
        setUpdatedCard(null);
        setIsTranslating(false);
        setInternalProcessing(false);
    }, [rightOptionCard?._id]);

    const formatWordBasedOnCorrectForm = (word, correctForm) => {
        if (!word || typeof word !== 'string') return word;

        const isFirstLetterCapital = correctForm && correctForm.charAt(0) === correctForm.charAt(0).toUpperCase();

        if (isFirstLetterCapital) {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }

        return word.toLowerCase();
    };

    const translateSentence = async (sentence) => {
        if (!sentence || isTranslating) return null;

        setIsTranslating(true);
        console.log(`Translating sentence: "${sentence}"`);

        try {
            const translation = await translateSentenceToUkrainian(sentence, englishLevel);
            console.log(`Translation result: "${translation}"`);
            return translation;
        } catch (error) {
            console.error("Error translating sentence:", error);
            return null;
        } finally {
            setIsTranslating(false);
        }
    };

    const generateQuestion = async (card) => {
        if (!card) return;

        setIsLoading(true);
        setIsGenerating(true);
        setUpdatedCard(null);

        try {
            setShowResult(false);

            console.log(`Generating sentence for word: "${card.text}"`);

            const sentenceResult = await generateFieldContent(
                card.text,
                englishLevel,
                "sentenceWithGap"
            );

            if (!sentenceResult || !sentenceResult.displaySentence || !sentenceResult.correctForm) {
                throw new Error("Invalid sentence data from AI");
            }

            if (!sentenceResult.displaySentence.includes('____')) {
                console.error(`Display sentence doesn't contain gap:`, sentenceResult.displaySentence);
                throw new Error("Display sentence doesn't contain gap");
            }

            if (!sentenceResult.hint) {
                sentenceResult.hint = "";
            }

            console.log(`Successfully validated exercise data:`, sentenceResult);

            if (sentenceResult.audioSentence) {
                console.log(`Generating translation for: "${sentenceResult.audioSentence}"`);
                const translation = await translateSentence(sentenceResult.audioSentence);
                if (translation) {
                    sentenceResult.sentenceTranslation = translation;
                    console.log(`Translation added: "${translation}"`);
                }
            }

            const correctForm = sentenceResult.correctForm;

            const wrongOptions = optionCards
                .filter(optionCard => optionCard._id !== card._id)
                .slice(0, 3)
                .map(optionCard => formatWordBasedOnCorrectForm(optionCard.text, correctForm));

            const allOptions = [...wrongOptions, correctForm];
            const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

            setSentenceData(sentenceResult);
            setAnswerOptions(shuffledOptions);
            setSelectedAnswer(null);
            setIsCorrect(null);

            console.log(`Sentence generated successfully for: "${card.text}"`);
            console.log(`Correct form: "${correctForm}", Options:`, shuffledOptions);
        } catch (error) {
            console.error("Error generating sentence:", error);

            let fallbackSentence = null;

            if (card.examples && card.examples.length > 0) {
                const example = card.examples[0];
                const wordRegex = new RegExp(`\\b${card.text}\\b`, 'gi');
                fallbackSentence = {
                    displaySentence: example.replace(wordRegex, '____'),
                    audioSentence: example,
                    correctForm: card.text,
                    hint: ""
                };
            } else if (card.example) {
                const wordRegex = new RegExp(`\\b${card.text}\\b`, 'gi');
                fallbackSentence = {
                    displaySentence: card.example.replace(wordRegex, '____'),
                    audioSentence: card.example,
                    correctForm: card.text,
                    hint: ""
                };
            } else {
                fallbackSentence = {
                    displaySentence: `I need to ____ this word.`,
                    audioSentence: `I need to ${card.text} this word.`,
                    correctForm: card.text,
                    hint: ""
                };
            }

            if (fallbackSentence.audioSentence) {
                const translation = await translateSentence(fallbackSentence.audioSentence);
                if (translation) {
                    fallbackSentence.sentenceTranslation = translation;
                    console.log(`Fallback translation added: "${translation}"`);
                }
            }

            const correctForm = fallbackSentence.correctForm;
            const wrongOptions = optionCards
                .filter(optionCard => optionCard._id !== card._id)
                .slice(0, 3)
                .map(optionCard => formatWordBasedOnCorrectForm(optionCard.text, correctForm));

            const allOptions = [...wrongOptions, correctForm];
            const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

            setSentenceData(fallbackSentence);
            setAnswerOptions(shuffledOptions);
            setSelectedAnswer(null);
            setIsCorrect(null);
            setShowResult(false);

            console.log(`Using fallback sentence for: "${card.text}"`);
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (rightOptionCard) {
            console.log(`Exercise initialized for card: "${rightOptionCard.text}" - ID: ${rightOptionCard._id}`);

            resetExerciseState();

            const timer = setTimeout(() => {
                generateQuestion(rightOptionCard);
            }, 100);

            return () => {
                clearTimeout(timer);
                console.log(`Cleaning up exercise for card: ${rightOptionCard._id}`);
            };
        }
    }, [rightOptionCard?._id, resetExerciseState]);

    useEffect(() => {
        return () => {
            console.log("Component unmounting: cleaning up all state");
        };
    }, []);

    const handleAnswerSelect = (answer) => {
        if (selectedAnswer !== null || combinedProcessing) return;

        const correct = answer.toLowerCase() === (sentenceData?.correctForm || rightOptionCard.text).toLowerCase();
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
            exerciseType: 'sentence-completion'
        });
        setInternalProcessing(true);

        const result = {
            completed: true,
            isCorrect: isCorrect,
            rightOptionCard: {
                ...rightOptionCard,
                exerciseType: 'sentence-completion',
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

    const correctAnswer = sentenceData?.correctForm || rightOptionCard.text;

    return (
        <ExerciseLayout
            icon={Type}
            title="Доповни речення"
            description="Оберіть правильне слово для пропуску"
            gradientClasses="from-emerald-400 to-teal-400"
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
                            {isGenerating ? "Генерую речення..." : "Завантаження..."}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-lg font-medium text-gray-700 mb-4">
                                Яке слово підходить для пропуску?
                            </h2>
                            <div className="bg-green-100/80 rounded-xl p-6 border-l-4 border-emerald-400">
                                <p className="text-xl text-gray-800 leading-relaxed font-mono tracking-wide mb-3">
                                    {showResult ? (
                                        sentenceData?.audioSentence ?
                                            sentenceData.audioSentence.split(new RegExp(`(\\b${correctAnswer}\\b)`, 'gi')).map((part, index) =>
                                                part.toLowerCase() === correctAnswer.toLowerCase() ? (
                                                    <mark key={index} className={`px-2 py-1 rounded font-bold ${
                                                        isCorrect ? 'bg-green-300 text-green-800' : 'bg-yellow-300 text-yellow-800'
                                                    }`}>
                                                        {part}
                                                    </mark>
                                                ) : (
                                                    part
                                                )
                                            )
                                            : `Complete this sentence: I need to ${correctAnswer} this word.`
                                    ) : (
                                        sentenceData?.displaySentence || `Complete this sentence: I need to ____ this word.`
                                    )}
                                </p>

                                {showResult && sentenceData?.sentenceTranslation && (
                                    <div className="mt-3 pt-3 border-t border-emerald-200">
                                        <p className="text-sm text-gray-600 mb-1">Переклад речення:</p>
                                        <p className="text-base text-gray-700 italic">
                                            {sentenceData.sentenceTranslation}
                                        </p>
                                    </div>
                                )}

                                {showResult && !sentenceData?.sentenceTranslation && isTranslating && (
                                    <div className="mt-3 pt-3 border-t border-emerald-200">
                                        <div className="flex items-center text-emerald-600">
                                            <Loader className="w-4 h-4 animate-spin mr-2" />
                                            <span className="text-sm">Генерую переклад...</span>
                                        </div>
                                    </div>
                                )}

                                {showResult && !sentenceData?.sentenceTranslation && !isTranslating && (
                                    <div className="mt-3 pt-3 border-t border-emerald-200">
                                        <p className="text-sm text-gray-500 italic">
                                            💭 Переклад тимчасово недоступний
                                        </p>
                                    </div>
                                )}

                                {sentenceData?.hint && !showResult && (
                                    <p className="text-sm text-emerald-600 mt-3 italic">
                                        Підказка: {sentenceData.hint}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Answer Options */}
                        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
                            {answerOptions.map((option, index) => {
                                let buttonClass = "w-full p-6 text-center rounded-xl border-2 transition-all duration-200 font-medium text-lg ";

                                if (selectedAnswer === null) {
                                    buttonClass += combinedProcessing
                                        ? "border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                                        : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-700 hover:shadow-lg hover:scale-102 cursor-pointer";
                                } else if (option.toLowerCase() === correctAnswer.toLowerCase()) {
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
                                                    {option.toLowerCase() === correctAnswer.toLowerCase() ? (
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

export default SentenceCompletionExercise;