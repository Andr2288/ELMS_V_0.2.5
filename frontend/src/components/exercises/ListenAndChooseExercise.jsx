// frontend/src/components/exercises/ListenAndChooseExercise.jsx - НОВА ОСНОВНА ВПРАВА

import { useState, useEffect, useRef, useCallback } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import { axiosInstance } from "../../lib/axios.js";
import ExerciseLayout from "../shared/ExerciseLayout.jsx";
import DetailedCardInfo from "../shared/DetailedCardInfo.jsx";
import {
    CheckCircle, XCircle, Volume2, Loader, VolumeX,
    Eye, EyeOff, Headphones, Brain
} from "lucide-react";
import toast from "react-hot-toast";

const ListenAndChooseExercise = ({
                                     rightOptionCard,
                                     optionCards,
                                     onExit,
                                     progress = null,
                                     isLastQuestion = false,
                                     onRestart,
                                     isProcessing = false,
                                     onProgressUpdate = null
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
    const [showExplanationText, setShowExplanationText] = useState(false);

    // Audio states
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioError, setAudioError] = useState(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);

    const currentSessionRef = useRef(null);
    const currentAudioRef = useRef(null);
    const audioRef = useRef(null);
    const currentCardIdRef = useRef(null);

    const hasAutoPlayedRef = useRef(false);
    const currentAudioUrlRef = useRef(null);

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

        setCurrentExplanation("");
        setAnswerOptions([]);
        setSelectedAnswer(null);
        setIsCorrect(null);
        setIsLoading(true);
        setShowResult(false);
        setIsGenerating(false);
        setUpdatedCard(null);
        setInternalProcessing(false);
        setShowExplanationText(false);
        setIsPlayingAudio(false);
        setAudioError(null);
        setIsLoadingAudio(false);

        currentSessionRef.current = null;
        hasAutoPlayedRef.current = false;
        currentAudioUrlRef.current = null;
    }, [rightOptionCard?._id]);

    const cleanupAudio = useCallback(() => {
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
        }
        setAudioUrl(null);
        hasAutoPlayedRef.current = false;
        currentAudioUrlRef.current = null;
    }, [audioUrl]);

    const generateQuestion = async (card) => {
        if (!card) return;

        setIsLoading(true);
        setIsGenerating(true);
        setAudioError(null);
        setShowResult(false);
        setUpdatedCard(null);
        setShowExplanationText(false);

        const newSessionId = `${card._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        currentSessionRef.current = newSessionId;

        console.log(`[${newSessionId}] Starting new session for card: "${card.text}"`);

        cleanupAudio();
        setIsPlayingAudio(false);

        setCurrentExplanation("");
        setAnswerOptions([]);
        setSelectedAnswer(null);
        setIsCorrect(null);

        try {
            console.log(`[${newSessionId}] Generating explanation for word: "${card.text}"`);

            const explanation = await generateFieldContent(
                card.text,
                englishLevel,
                "exerciseExplanation"
            );

            if (currentSessionRef.current !== newSessionId) {
                console.log(`[${newSessionId}] Session expired during generation`);
                return;
            }

            console.log(`[${newSessionId}] Generated explanation: "${explanation}"`);

            const allOptions = optionCards.map(c => c.text);
            const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

            setCurrentExplanation(explanation);
            setAnswerOptions(shuffledOptions);
            setSelectedAnswer(null);
            setIsCorrect(null);

            // Generate audio for the explanation
            await generateAudio(explanation, card.text, newSessionId);

            console.log(`[${newSessionId}] Question generated successfully for: "${card.text}"`);
        } catch (error) {
            console.error(`[${newSessionId}] Error generating question:`, error);

            // Fallback explanation
            const fallbackExplanation = card.explanation ||
                card.shortDescription ||
                `A word or phrase: "${card.text}"`;

            if (currentSessionRef.current === newSessionId) {
                setCurrentExplanation(fallbackExplanation);

                const allOptions = optionCards.map(c => c.text);
                setAnswerOptions(allOptions.sort(() => Math.random() - 0.5));
                setSelectedAnswer(null);
                setIsCorrect(null);
                setShowResult(false);

                console.log(`[${newSessionId}] Using fallback explanation for: "${card.text}"`);

                // Try to generate audio for fallback
                try {
                    await generateAudio(fallbackExplanation, card.text, newSessionId);
                } catch (audioError) {
                    console.error(`[${newSessionId}] Audio generation also failed:`, audioError);
                    setAudioError("Помилка генерації аудіо");
                }
            }
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    const generateAudio = async (text, targetWord = null, sessionId = null) => {
        const currentSessionId = sessionId || currentSessionRef.current;

        if (currentSessionRef.current !== currentSessionId) {
            console.log(`[${currentSessionId}] Session expired before audio generation started`);
            return;
        }

        setIsLoadingAudio(true);
        setAudioError(null);

        try {
            console.log(`[${currentSessionId}] Generating TTS for explanation: "${text}"${targetWord ? ` (target word: ${targetWord})` : ''}`);

            const requestData = {
                text: text,
                timestamp: Date.now(),
                sessionId: currentSessionId,
                cardId: rightOptionCard?._id,
                exercise: 'listen-and-choose'
            };

            const response = await axiosInstance.post('/tts/speech',
                requestData,
                {
                    responseType: 'blob',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (currentSessionRef.current !== currentSessionId) {
                console.log(`[${currentSessionId}] Session ID changed during audio generation, ignoring result`);
                return;
            }

            const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
            const newAudioUrl = URL.createObjectURL(audioBlob);

            console.log(`[${currentSessionId}] TTS audio generated successfully`);

            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }

            setAudioUrl(newAudioUrl);
            currentAudioUrlRef.current = newAudioUrl;
            hasAutoPlayedRef.current = false;

        } catch (error) {
            console.error(`[${currentSessionId}] Error generating audio:`, error);

            let errorMessage = "Помилка генерації аудіо";

            if (error.code === 'ERR_NETWORK') {
                errorMessage = "Помилка мережі - перевірте з'єднання";
            } else if (error.response?.status === 401) {
                errorMessage = "API ключ недійсний або відсутній";
            } else if (error.response?.status === 402) {
                errorMessage = "Недостатньо кредитів OpenAI";
            } else if (error.response?.status === 429) {
                errorMessage = "Перевищено ліміт запитів";
            }

            if (currentSessionRef.current === currentSessionId) {
                setAudioError(errorMessage);
            }
        } finally {
            if (currentSessionRef.current === currentSessionId) {
                setIsLoadingAudio(false);
            }
        }
    };

    const playAudio = useCallback(() => {
        if (audioRef.current && audioUrl && !combinedProcessing && !isPlayingAudio) {
            console.log(`[${currentSessionRef.current}] Playing audio manually...`);
            setIsPlayingAudio(true);
            audioRef.current.currentTime = 0;
            audioRef.current.play()
                .then(() => {
                    console.log(`[${currentSessionRef.current}] Audio playback started successfully`);
                })
                .catch(error => {
                    console.error(`[${currentSessionRef.current}] Error playing audio:`, error);
                    setAudioError("Помилка відтворення аудіо");
                    setIsPlayingAudio(false);
                });
        }
    }, [audioUrl, combinedProcessing, isPlayingAudio]);

    const handleAudioEnded = () => {
        console.log(`[${currentSessionRef.current}] Audio playback ended`);
        setIsPlayingAudio(false);
    };

    const handleAudioError = (e) => {
        console.error(`[${currentSessionRef.current}] Audio playback error:`, e);
        setIsPlayingAudio(false);
        setAudioError("Помилка відтворення аудіо");
    };

    useEffect(() => {
        const cardId = rightOptionCard?._id;
        if (cardId && cardId !== currentCardIdRef.current) {
            console.log(`Exercise initialized for card: "${rightOptionCard.text}" - ID: ${cardId}`);

            currentCardIdRef.current = cardId;
            cleanupAudio();
            resetExerciseState();

            const timer = setTimeout(() => {
                generateQuestion(rightOptionCard);
            }, 100);

            return () => {
                clearTimeout(timer);
            };
        }
    }, [rightOptionCard?._id]);

    useEffect(() => {
        return () => {
            console.log("Component unmounting: cleaning up all state");
            cleanupAudio();
            currentCardIdRef.current = null;
        };
    }, []);

    useEffect(() => {
        return () => {
            if (audioUrl) {
                console.log("Cleaning up audio URL on change");
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    // Auto-play audio when available
    useEffect(() => {
        if (audioUrl &&
            audioRef.current &&
            !isPlayingAudio &&
            !audioError &&
            !combinedProcessing &&
            !hasAutoPlayedRef.current &&
            currentAudioUrlRef.current === audioUrl) {

            console.log(`[${currentSessionRef.current}] Auto-playing new audio (first time)`);

            hasAutoPlayedRef.current = true;

            const autoPlayTimer = setTimeout(() => {
                if (audioUrl &&
                    audioRef.current &&
                    !isPlayingAudio &&
                    !combinedProcessing &&
                    currentAudioUrlRef.current === audioUrl) {

                    console.log(`[${currentSessionRef.current}] Executing auto-play`);
                    setIsPlayingAudio(true);
                    audioRef.current.currentTime = 0;
                    audioRef.current.play()
                        .then(() => {
                            console.log(`[${currentSessionRef.current}] Auto-play started successfully`);
                        })
                        .catch(error => {
                            console.error(`[${currentSessionRef.current}] Auto-play failed:`, error);
                            setIsPlayingAudio(false);
                        });
                }
            }, 500);

            return () => clearTimeout(autoPlayTimer);
        }
    }, [audioUrl]);

    const handleAnswerSelect = (answer) => {
        if (selectedAnswer !== null || combinedProcessing) return;

        const correct = answer === rightOptionCard.text;
        setSelectedAnswer(answer);
        setIsCorrect(correct);
        setShowResult(true);

        // Миттєве оновлення прогресу
        if (onProgressUpdate && progress) {
            const updatedProgress = {
                ...progress,
                correct: progress.correct + (correct ? 1 : 0),
                currentAnswered: progress.current
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
            exerciseType: 'listen-and-choose'
        });
        setInternalProcessing(true);

        cleanupAudio();

        const result = {
            completed: true,
            isCorrect: isCorrect,
            rightOptionCard: {
                ...rightOptionCard,
                exerciseType: 'listen-and-choose',
                isMistakeWord: rightOptionCard.status === 'learning' || rightOptionCard.status === 'review'
            }
        };

        onExit(result);
    }, [combinedProcessing, isCorrect, rightOptionCard, onExit, cleanupAudio]);

    const handleRestartExercise = useCallback(() => {
        if (combinedProcessing) {
            console.log("Cannot restart: processing in progress");
            return;
        }

        console.log("Restarting exercise from current question");
        cleanupAudio();

        if (onRestart && typeof onRestart === 'function') {
            onRestart();
        }
    }, [combinedProcessing, onRestart, cleanupAudio]);

    const handleCardUpdate = (newCard) => {
        setUpdatedCard(newCard);
    };

    const toggleExplanationText = () => {
        setShowExplanationText(!showExplanationText);
    };

    return (
        <ExerciseLayout
            icon={Headphones}
            title="Прослухати та обрати"
            description="Прослухайте пояснення та оберіть правильне слово"
            gradientClasses="from-indigo-400 to-purple-400"
            onExit={onExit}
            progress={progress}
            onRestart={handleRestartExercise}
            onContinue={handleContinue}
            isLastQuestion={isLastQuestion}
            showResult={showResult}
            isProcessing={combinedProcessing}
        >
            {/* Audio element */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={handleAudioEnded}
                    onError={handleAudioError}
                    preload="auto"
                />
            )}

            {/* Question Content */}
            <div className="bg-white rounded-2xl shadow-md p-8 pb-10">
                {isLoading ? (
                    <div className="text-center py-12">
                        <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                        <p className="text-gray-600">
                            {isGenerating ? "Генерую завдання..." : "Завантаження..."}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Audio Controls */}
                        <div className="text-center mb-8">
                            <h2 className="text-lg font-medium text-gray-700 mb-4">
                                Прослухайте пояснення та оберіть правильне слово
                            </h2>

                            <div className="bg-indigo-100/80 rounded-xl p-6 border-l-4 border-indigo-400 mb-6">
                                <div className="flex items-center justify-center mb-4">
                                    {isLoadingAudio ? (
                                        <div className="flex items-center text-indigo-600">
                                            <Loader className="w-6 h-6 animate-spin mr-2" />
                                            <span>Генерую аудіо...</span>
                                        </div>
                                    ) : audioError ? (
                                        <div className="text-center">
                                            <div className="flex items-center justify-center text-red-600 mb-4">
                                                <VolumeX className="w-6 h-6 mr-2" />
                                                <span>{audioError}</span>
                                            </div>
                                            <div className="text-sm text-gray-600 mb-4">
                                                Аудіо недоступне, натисніть кнопку нижче щоб побачити текст
                                            </div>
                                            <button
                                                onClick={() => generateAudio(currentExplanation)}
                                                disabled={combinedProcessing}
                                                className={`bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm ${
                                                    combinedProcessing ? 'opacity-60 cursor-not-allowed' : ''
                                                }`}
                                            >
                                                Спробувати знову
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={playAudio}
                                            disabled={!audioUrl || isPlayingAudio || combinedProcessing}
                                            className={`flex items-center justify-center w-16 h-16 rounded-full text-white font-medium transition-all transform ${
                                                combinedProcessing || !audioUrl
                                                    ? 'bg-gray-400 cursor-not-allowed'
                                                    : isPlayingAudio
                                                        ? 'bg-green-500 cursor-not-allowed'
                                                        : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer hover:scale-105'
                                            }`}
                                        >
                                            {isPlayingAudio ? (
                                                <div className="flex space-x-1">
                                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                                                </div>
                                            ) : (
                                                <Volume2 className="w-8 h-8" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Show/Hide text button */}
                                <div className="text-center mb-4">
                                    <button
                                        onClick={toggleExplanationText}
                                        disabled={combinedProcessing}
                                        className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            combinedProcessing
                                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                : 'bg-indigo-200 hover:bg-indigo-300 text-indigo-800 cursor-pointer'
                                        }`}
                                    >
                                        {showExplanationText ? (
                                            <>
                                                <EyeOff className="w-4 h-4 mr-2" />
                                                Сховати текст
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4 mr-2" />
                                                Показати текст
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Show explanation text if toggled */}
                                {showExplanationText && currentExplanation && (
                                    <div className="mt-4 pt-4 border-t border-indigo-200">
                                        <p className="text-sm text-gray-600 mb-2">Текст пояснення:</p>
                                        <p className="text-lg text-gray-800 font-mono tracking-wide">
                                            {currentExplanation}
                                        </p>
                                    </div>
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
                                        : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 hover:shadow-lg hover:scale-102 cursor-pointer";
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

            {/* Detailed Card Info */}
            {showResult && (
                <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6">
                    <DetailedCardInfo
                        displayCard={displayCard}
                        onCardUpdate={handleCardUpdate}
                        isCorrect={isCorrect}
                    />
                </div>
            )}
        </ExerciseLayout>
    );
};

export default ListenAndChooseExercise;