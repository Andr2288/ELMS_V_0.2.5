// frontend/src/components/exercises/ListenAndFillExercise.jsx - ВИПРАВЛЕНА ВЕРСІЯ З МИТТЄВИМ ОНОВЛЕННЯМ ПРОГРЕСУ

import { useState, useEffect, useRef, useCallback } from "react";
import { useFlashcardStore } from "../../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../../store/useUserSettingsStore.js";
import { axiosInstance } from "../../lib/axios.js";
import ExerciseLayout from "../shared/ExerciseLayout.jsx";
import DetailedCardInfo from "../shared/DetailedCardInfo.jsx";
import {
    CheckCircle, XCircle, Volume2, Loader, VolumeX,
    Headphones, BookOpen
} from "lucide-react";
import toast from "react-hot-toast";

const ListenAndFillExercise = ({
                                   rightOptionCard,
                                   onExit,
                                   progress = null,
                                   isLastQuestion = false,
                                   onRestart,
                                   isProcessing = false,
                                   onProgressUpdate = null // ДОДАНО: Callback для оновлення прогресу
                               }) => {
    const { generateFieldContent, translateSentenceToUkrainian } = useFlashcardStore();
    const { getDefaultEnglishLevel } = useUserSettingsStore();

    const [exerciseData, setExerciseData] = useState(null);
    const [userAnswer, setUserAnswer] = useState("");
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showResult, setShowResult] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [updatedCard, setUpdatedCard] = useState(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [internalProcessing, setInternalProcessing] = useState(false);

    // Audio states
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioError, setAudioError] = useState(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);

    const currentSessionRef = useRef(null);
    const currentAudioRef = useRef(null);
    const audioRef = useRef(null);
    const inputRef = useRef(null);
    const currentCardIdRef = useRef(null);

    const hasAutoPlayedRef = useRef(false);
    const currentAudioUrlRef = useRef(null);

    const combinedProcessing = isProcessing || internalProcessing;
    const displayCard = updatedCard || rightOptionCard;
    const englishLevel = getDefaultEnglishLevel();

    if (!rightOptionCard) {
        return (
            <div className="text-center py-12">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                        Немає картки
                    </h3>
                    <p className="text-yellow-700">
                        Для цієї вправи потрібна картка.
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

        setExerciseData(null);
        setUserAnswer("");
        setSelectedAnswer(null);
        setIsCorrect(null);
        setIsLoading(true);
        setShowResult(false);
        setIsGenerating(false);
        setUpdatedCard(null);
        setIsTranslating(false);
        setInternalProcessing(false);
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
        setAudioError(null);
        setShowResult(false);
        setUpdatedCard(null);

        const newSessionId = `${card._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        currentSessionRef.current = newSessionId;

        console.log(`[${newSessionId}] Starting new session for card: "${card.text}"`);

        cleanupAudio();
        setIsPlayingAudio(false);

        setExerciseData(null);
        setUserAnswer("");
        setSelectedAnswer(null);
        setIsCorrect(null);

        try {
            console.log(`[${newSessionId}] Generating question for word: "${card.text}"`);

            const response = await generateFieldContent(
                card.text,
                englishLevel,
                "sentenceWithGap"
            );

            let exerciseData;

            if (typeof response === 'object' && response !== null) {
                exerciseData = response;
                console.log(`[${newSessionId}] Received exercise data from API:`, exerciseData);
            } else if (typeof response === 'string') {
                try {
                    exerciseData = JSON.parse(response);
                    console.log(`[${newSessionId}] Parsed exercise data from string:`, exerciseData);
                } catch (parseError) {
                    console.error(`[${newSessionId}] Failed to parse string response as JSON:`, parseError);
                    throw new Error("Invalid response format from AI");
                }
            } else {
                throw new Error("Invalid response type from AI");
            }

            if (!exerciseData || typeof exerciseData !== 'object') {
                throw new Error("Exercise data is not an object");
            }

            if (!exerciseData.displaySentence || !exerciseData.audioSentence || !exerciseData.correctForm) {
                console.error(`[${newSessionId}] Missing required fields:`, exerciseData);
                throw new Error("Missing required fields in exercise data");
            }

            if (!exerciseData.displaySentence.includes('____')) {
                console.error(`[${newSessionId}] Display sentence doesn't contain gap:`, exerciseData.displaySentence);
                throw new Error("Display sentence doesn't contain gap");
            }

            if (!exerciseData.hint) {
                exerciseData.hint = "";
            }

            console.log(`[${newSessionId}] Successfully validated exercise data:`, exerciseData);

            if (exerciseData.audioSentence) {
                console.log(`[${newSessionId}] Generating translation for: "${exerciseData.audioSentence}"`);
                const translation = await translateSentence(exerciseData.audioSentence);
                if (translation) {
                    exerciseData.sentenceTranslation = translation;
                    console.log(`[${newSessionId}] Translation added: "${translation}"`);
                }
            }

            setExerciseData(exerciseData);
            await new Promise(resolve => setTimeout(resolve, 100));

            if (currentSessionRef.current === newSessionId) {
                console.log(`[${newSessionId}] Generating audio for: "${exerciseData.audioSentence}"`);
                await generateAudio(exerciseData.audioSentence, card.text, newSessionId);
            } else {
                console.log(`[${newSessionId}] Session ID changed during generation (current: ${currentSessionRef.current}), skipping audio`);
            }

        } catch (error) {
            console.error(`[${newSessionId}] Error generating question:`, error);

            let fallbackData;

            if (card.examples && card.examples.length > 0) {
                const example = card.examples[0];
                const wordRegex = new RegExp(`\\b${card.text}\\b`, 'gi');
                const displaySentence = example.replace(wordRegex, '____');

                fallbackData = {
                    displaySentence: displaySentence,
                    audioSentence: example,
                    correctForm: card.text,
                    hint: ""
                };
            } else if (card.example) {
                const wordRegex = new RegExp(`\\b${card.text}\\b`, 'gi');
                fallbackData = {
                    displaySentence: card.example.replace(wordRegex, '____'),
                    audioSentence: card.example,
                    correctForm: card.text,
                    hint: ""
                };
            } else {
                fallbackData = {
                    displaySentence: `Complete this sentence: I need to ____ this word.`,
                    audioSentence: `Complete this sentence: I need to ${card.text} this word.`,
                    correctForm: card.text,
                    hint: ""
                };
            }

            console.log(`[${newSessionId}] Using fallback exercise data:`, fallbackData);

            if (fallbackData.audioSentence) {
                const translation = await translateSentence(fallbackData.audioSentence);
                if (translation) {
                    fallbackData.sentenceTranslation = translation;
                    console.log(`[${newSessionId}] Fallback translation added: "${translation}"`);
                }
            }

            setExerciseData(fallbackData);
            await new Promise(resolve => setTimeout(resolve, 100));

            if (currentSessionRef.current === newSessionId) {
                try {
                    await generateAudio(fallbackData.audioSentence, card.text, newSessionId);
                } catch (audioError) {
                    console.error(`[${newSessionId}] Audio generation also failed:`, audioError);
                    setAudioError("Помилка генерації аудіо");
                }
            } else {
                console.log(`[${newSessionId}] Session ID changed during fallback (current: ${currentSessionRef.current}), skipping audio`);
            }
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    };

    const generateAudio = async (sentence, targetWord = null, sessionId = null) => {
        const currentSessionId = sessionId || currentSessionRef.current;

        if (currentSessionRef.current !== currentSessionId) {
            console.log(`[${currentSessionId}] Session expired before audio generation started`);
            return;
        }

        setIsLoadingAudio(true);
        setAudioError(null);

        try {
            console.log(`[${currentSessionId}] Generating TTS for: "${sentence}"${targetWord ? ` (target word: ${targetWord})` : ''}`);

            const requestData = {
                text: sentence,
                timestamp: Date.now(),
                sessionId: currentSessionId,
                cardId: rightOptionCard?._id,
                exercise: 'listen-and-fill'
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

            console.log(`[${currentSessionId}] TTS audio generated successfully for: "${sentence}"`);

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
            } else if (error.code === 'ERR_FAILED') {
                errorMessage = "Запит не вдався - можливо проблема з сервером";
            } else if (error.message?.includes('CORS')) {
                errorMessage = "Помилка CORS - зверніться до адміністратора";
            } else if (error.response?.status === 401) {
                errorMessage = "API ключ недійсний або відсутній";
            } else if (error.response?.status === 402) {
                errorMessage = "Недостатньо кредитів OpenAI";
            } else if (error.response?.status === 429) {
                errorMessage = "Перевищено ліміт запитів";
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = "Перевищено час очікування";
            } else if (!navigator.onLine) {
                errorMessage = "Немає з'єднання з інтернетом";
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
        } else {
            console.warn(`[${currentSessionRef.current}] Cannot play audio: missing audio reference, URL, or already playing`);
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

    const checkAnswer = (answer, correctForm, originalWord) => {
        const normalizeText = (text) => {
            return text.toLowerCase().trim().replace(/[.,!?;:'"]/g, '');
        };

        const normalizedAnswer = normalizeText(answer);
        const normalizedCorrect = normalizeText(correctForm);
        const normalizedOriginal = normalizeText(originalWord);

        if (normalizedAnswer === normalizedCorrect) {
            return true;
        }

        if (normalizedAnswer === normalizedOriginal) {
            return true;
        }

        if (normalizedCorrect.includes(' ')) {
            return normalizedCorrect.split(' ').some(word =>
                word === normalizedAnswer
            );
        }

        return false;
    };

    const handleSubmitAnswer = () => {
        if (!userAnswer.trim() || selectedAnswer !== null || !exerciseData || combinedProcessing) return;

        const correct = checkAnswer(userAnswer, exerciseData.correctForm, rightOptionCard.text);
        setSelectedAnswer(userAnswer);
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
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !showResult && !combinedProcessing) {
            handleSubmitAnswer();
        }
    };

    const handleContinue = useCallback(() => {
        if (combinedProcessing) {
            console.log("Cannot continue: processing in progress");
            return;
        }

        console.log("Exercise continuing with result:", {
            isCorrect,
            rightOptionCard: rightOptionCard._id,
            exerciseType: 'listen-and-fill'
        });
        setInternalProcessing(true);

        cleanupAudio();

        const result = {
            completed: true,
            isCorrect: isCorrect,
            rightOptionCard: {
                ...rightOptionCard,
                exerciseType: 'listen-and-fill',
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

    useEffect(() => {
        if (!isLoading && inputRef.current && !combinedProcessing) {
            inputRef.current.focus();
        }
    }, [isLoading, combinedProcessing]);

    const handleCardUpdate = (newCard) => {
        setUpdatedCard(newCard);
    };

    return (
        <ExerciseLayout
            icon={Headphones}
            title="Слухання та письмо"
            description="Прослухайте речення та впишіть пропущене слово"
            gradientClasses="from-cyan-400 to-blue-400"
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
                                Яке слово ви чуєте на місці пропуску?
                            </h2>

                            <div className="bg-blue-100/80 rounded-xl p-6 border-l-4 border-blue-400 mb-6">
                                <div className="flex items-center justify-center mb-4">
                                    {isLoadingAudio ? (
                                        <div className="flex items-center text-blue-600">
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
                                                Аудіо недоступне, але ви можете читати речення текстом
                                            </div>
                                            <button
                                                onClick={() => generateAudio(exerciseData?.audioSentence)}
                                                disabled={combinedProcessing}
                                                className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm ${
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
                                                        : 'bg-blue-600 hover:bg-blue-700 cursor-pointer hover:scale-105'
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

                                {/* Show sentence text visually */}
                                {exerciseData?.displaySentence && (
                                    <div>
                                        <p className="text-lg text-gray-800 font-mono tracking-wide mb-3">
                                            {showResult ? (
                                                exerciseData.audioSentence.split(new RegExp(`(\\b${exerciseData.correctForm}\\b)`, 'gi')).map((part, index) =>
                                                    part.toLowerCase() === exerciseData.correctForm.toLowerCase() ? (
                                                        <mark key={index} className={`px-2 py-1 rounded font-bold ${
                                                            isCorrect ? 'bg-green-300 text-green-800' : 'bg-yellow-300 text-yellow-800'
                                                        }`}>
                                                            {part}
                                                        </mark>
                                                    ) : (
                                                        part
                                                    )
                                                )
                                            ) : (
                                                exerciseData.displaySentence
                                            )}
                                        </p>

                                        {showResult && exerciseData.sentenceTranslation && (
                                            <div className="mt-3 pt-3 border-t border-blue-200">
                                                <p className="text-sm text-gray-600 mb-1">Переклад речення:</p>
                                                <p className="text-base text-gray-700 italic">
                                                    {exerciseData.sentenceTranslation}
                                                </p>
                                            </div>
                                        )}

                                        {showResult && !exerciseData.sentenceTranslation && isTranslating && (
                                            <div className="mt-3 pt-3 border-t border-blue-200">
                                                <div className="flex items-center text-blue-600">
                                                    <Loader className="w-4 h-4 animate-spin mr-2" />
                                                    <span className="text-sm">Генерую переклад...</span>
                                                </div>
                                            </div>
                                        )}

                                        {showResult && !exerciseData.sentenceTranslation && !isTranslating && (
                                            <div className="mt-3 pt-3 border-t border-blue-200">
                                                <p className="text-sm text-gray-500 italic">
                                                    💭 Переклад тимчасово недоступний
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Answer Input */}
                        <div className="space-y-4">
                            <div className="max-w-md mx-auto">
                                <div className="relative">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        disabled={showResult || combinedProcessing}
                                        placeholder="Впишіть слово..."
                                        className={`w-full p-4 text-lg text-center rounded-xl border-2 transition-all duration-200 font-medium ${
                                            showResult
                                                ? isCorrect
                                                    ? 'border-green-500 bg-green-50 text-green-700'
                                                    : 'border-red-500 bg-red-50 text-red-700'
                                                : combinedProcessing
                                                    ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                                                    : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                                        }`}
                                    />
                                    {showResult && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            {isCorrect ? (
                                                <CheckCircle className="w-6 h-6 text-green-600" />
                                            ) : (
                                                <XCircle className="w-6 h-6 text-red-600" />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!showResult && (
                                <div className="text-center">
                                    <button
                                        onClick={handleSubmitAnswer}
                                        disabled={!userAnswer.trim() || combinedProcessing}
                                        className={`bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-8 rounded-xl font-medium transition-all ${
                                            combinedProcessing ? 'cursor-not-allowed' : ''
                                        }`}
                                    >
                                        Перевірити
                                    </button>
                                </div>
                            )}
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

export default ListenAndFillExercise;