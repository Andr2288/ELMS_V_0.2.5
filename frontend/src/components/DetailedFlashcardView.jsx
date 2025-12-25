// frontend/src/components/DetailedFlashcardView.jsx - ВИПРАВЛЕНА ВЕРСІЯ З ШВИДШИМИ ПЕРЕХОДАМИ + ПІДТРИМКА ПОЧАТКОВОГО ІНДЕКСУ

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Volume2,
  Sparkles,
  StickyNote,
  RotateCcw,
  Loader
} from "lucide-react";
import { axiosInstance } from "../lib/axios.js";
import { useFlashcardStore } from "../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../store/useUserSettingsStore.js";
import toast from "react-hot-toast";
import ConfirmDeleteModal from "./ConfirmDeleteModal.jsx";

const DetailedFlashcardView = ({ flashcards, onEdit, initialCardIndex = 0 }) => { // ДОДАНО: initialCardIndex проп
  const { deleteFlashcard, updateFlashcard } = useFlashcardStore(); // ДОДАНО updateFlashcard
  const {
    loadSettings,
  } = useUserSettingsStore();

  const [currentIndex, setCurrentIndex] = useState(initialCardIndex); // ОНОВЛЕНО: використовуємо initialCardIndex
  const [isFlipped, setIsFlipped] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Delete confirmation modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cardToDelete, setCardToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Settings state
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // НОВИЙ СТАН: для регенерації прикладів
  const [isRegeneratingExamples, setIsRegeneratingExamples] = useState(false);
  const [updatedFlashcards, setUpdatedFlashcards] = useState(flashcards);

  // ВИПРАВЛЕННЯ: Використовуємо useRef для збереження поточного аудіо
  const currentAudioRef = useRef(null);
  const isPlayingRef = useRef(false);

  // ДОДАНО: Оновлюємо поточний індекс коли змінюється initialCardIndex
  useEffect(() => {
    if (initialCardIndex !== currentIndex) {
      setCurrentIndex(initialCardIndex);
      setIsFlipped(false); // Скидаємо стан перевороту при зміні картки
    }
  }, [initialCardIndex]);

  // Load user settings on component mount
  useEffect(() => {
    const initializeSettings = async () => {
      try {
        await loadSettings();
        setSettingsLoaded(true);
      } catch (error) {
        console.error("Failed to load settings:", error);
        setSettingsLoaded(true); // Continue with defaults
      }
    };

    initializeSettings();
  }, [loadSettings]);

  // Синхронізуємо updatedFlashcards з пропсами
  useEffect(() => {
    setUpdatedFlashcards(flashcards);
  }, [flashcards]);

  const processTextContent = (text) => {
    if (!text) return '';

    let processedText = text;

    processedText = processedText.replace(/\n\n/g, '</p><p class="mb-4 last:mb-0">');
    processedText = `<p class="mb-4 last:mb-0">${processedText}</p>`;

    return processedText;
  };

  // ВИПРАВЛЕННЯ: Стабільна функція зупинки аудіо
  const stopCurrentAudio = useCallback(() => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
      } catch (error) {
        console.warn("Error stopping audio:", error);
      }
    }
    isPlayingRef.current = false;
    setIsPlayingAudio(false);
  }, []); // БЕЗ ЗАЛЕЖНОСТЕЙ!

  const handleFlip = useCallback(() => {
    if (!isChanging) {
      setIsFlipped(!isFlipped);
    }
  }, [isChanging, isFlipped]);

  const nextCard = useCallback(() => {
    if (currentIndex < updatedFlashcards.length - 1 && !isChanging) {
      setIsChanging(true);
      setIsFlipped(false);
      stopCurrentAudio();
      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setIsChanging(false);
      }, 0);
    }
  }, [currentIndex, updatedFlashcards.length, isChanging, stopCurrentAudio]);

  const prevCard = useCallback(() => {
    if (currentIndex > 0 && !isChanging) {
      setIsChanging(true);
      setIsFlipped(false);
      stopCurrentAudio();
      setTimeout(() => {
        setCurrentIndex(currentIndex - 1);
        setIsChanging(false);
      }, 0);
    }
  }, [currentIndex, isChanging, stopCurrentAudio]);

  const goToCard = useCallback(
      (index) => {
        if (index !== currentIndex && !isChanging) {
          setIsChanging(true);
          setIsFlipped(false);
          stopCurrentAudio();
          setTimeout(() => {
            setCurrentIndex(index);
            setIsChanging(false);
          }, 0);
        }
      },
      [currentIndex, isChanging, stopCurrentAudio]
  );

  // ВИПРАВЛЕННЯ: Стабільна функція озвучки з правильною обробкою аудіо
  const speakText = useCallback(
      async (text, isAutoPlay = false) => {
        // Перевірки
        if (!text || isChanging || isPlayingRef.current) {
          console.log("Speech blocked:", { text: !!text, isChanging, isPlaying: isPlayingRef.current });
          return;
        }

        if (!settingsLoaded) {
          if (!isAutoPlay) {
            toast.error("Налаштування ще завантажуються...");
          }
          return;
        }

        try {
          // ВАЖЛИВО: Зупиняємо попереднє аудіо перед початком нового
          stopCurrentAudio();

          // Встановлюємо статус
          isPlayingRef.current = true;
          setIsPlayingAudio(true);

          console.log("Starting TTS for:", text.substring(0, 50));

          const response = await axiosInstance.post(
              "/tts/speech",
              { text: text.trim() }, // ВИПРАВЛЕННЯ: Обрізаємо текст
              {
                responseType: "blob",
                timeout: 30000,
              }
          );

          // Перевіряємо, чи ще актуальний цей запит
          if (!isPlayingRef.current) {
            console.log("TTS request cancelled");
            return;
          }

          const audioBlob = new Blob([response.data], { type: "audio/mpeg" });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);

          // Встановлюємо поточне аудіо
          currentAudioRef.current = audio;

          // Обробники подій для аудіо
          audio.onended = () => {
            console.log("Audio ended");
            isPlayingRef.current = false;
            setIsPlayingAudio(false);
            currentAudioRef.current = null;
            URL.revokeObjectURL(audioUrl);
          };

          audio.onerror = (error) => {
            console.error("Audio error:", error);
            isPlayingRef.current = false;
            setIsPlayingAudio(false);
            currentAudioRef.current = null;
            URL.revokeObjectURL(audioUrl);
            if (!isAutoPlay) {
              toast.error("Помилка відтворення звуку");
            }
          };

          audio.onabort = () => {
            console.log("Audio aborted");
            isPlayingRef.current = false;
            setIsPlayingAudio(false);
            currentAudioRef.current = null;
            URL.revokeObjectURL(audioUrl);
          };

          // Запускаємо відтворення
          await audio.play();
          console.log("Audio started playing");

        } catch (error) {

          // ВАЖЛИВО: Скидання стану при помилці
          isPlayingRef.current = false;
          setIsPlayingAudio(false);
          currentAudioRef.current = null;

          console.error("Error playing TTS:", error);

          if (!isAutoPlay) {
            if (error.response?.status === 401) {
              toast.error("API ключ недійсний. Перевірте налаштування", {
                duration: 4000,
                action: {
                  label: "Налаштування",
                  onClick: () => (window.location.href = "/settings"),
                },
              });
            } else if (error.response?.status === 402) {
              toast.error("Недостатньо кредитів OpenAI. Поповніть баланс");
            } else if (error.response?.status === 429) {
              toast.error("Перевищено ліміт запитів OpenAI. Спробуйте пізніше");
            } else if (error.response?.status === 503) {
              toast.error("Проблеми з підключенням до OpenAI API");
            } else if (error.response?.status === 500) {
              toast.error("OpenAI API не налаштований. Встановіть ключ в налаштуваннях");
            } else if (error.code === "ECONNABORTED") {
              toast.error("Тайм-аут запиту. Спробуйте ще раз");
            } else {
              toast.error("Помилка генерації озвучення");
            }
          }
        }
      },
      [isChanging, settingsLoaded, stopCurrentAudio] // МІНІМАЛЬНІ ЗАЛЕЖНОСТІ
  );

  // НОВА ФУНКЦІЯ: Регенерація прикладів
  const regenerateExamples = useCallback(async () => {
    const currentCard = updatedFlashcards[currentIndex];
    if (!currentCard || isRegeneratingExamples) {
      return;
    }

    setIsRegeneratingExamples(true);

    try {
      console.log("Regenerating examples for card:", currentCard._id);

      const response = await axiosInstance.post(`/openai/regenerate-examples/${currentCard._id}`);

      if (response.data.success) {
        const updatedCard = response.data.flashcard;

        // Оновлюємо локальний стан
        const newFlashcards = [...updatedFlashcards];
        newFlashcards[currentIndex] = updatedCard;
        setUpdatedFlashcards(newFlashcards);

        // Також оновлюємо в глобальному стейті
        await updateFlashcard(currentCard._id, {
          ...currentCard,
          examples: updatedCard.examples
        });
      } else {
        toast.error("Помилка генерації прикладів");
      }
    } catch (error) {
      console.error("Error regenerating examples:", error);

      if (error.response?.status === 401) {
        toast.error("API ключ недійсний. Перевірте налаштування");
      } else if (error.response?.status === 402) {
        toast.error("Недостатньо кредитів OpenAI");
      } else if (error.response?.status === 429) {
        toast.error("Перевищено ліміт запитів OpenAI");
      } else if (error.response?.status === 404) {
        toast.error("Картку не знайдено");
      } else {
        toast.error("Помилка генерації нових прикладів");
      }
    } finally {
      setIsRegeneratingExamples(false);
    }
  }, [currentIndex, updatedFlashcards, isRegeneratingExamples, updateFlashcard]);

  const handleDeleteClick = (card) => {
    setCardToDelete(card);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cardToDelete) return;

    setIsDeleting(true);
    try {
      await deleteFlashcard(cardToDelete._id);
      setShowDeleteModal(false);
      setCardToDelete(null);

      // Оновлюємо локальний стан
      const newFlashcards = updatedFlashcards.filter(card => card._id !== cardToDelete._id);
      setUpdatedFlashcards(newFlashcards);

      if (currentIndex >= newFlashcards.length && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (!isDeleting) {
      setShowDeleteModal(false);
      setCardToDelete(null);
    }
  };

  // ВИПРАВЛЕННЯ: Покращена обробка клавіш з перевіркою дублювання
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Перевіряємо модальні вікна
      const isModalOpen = document.querySelector('.fixed.inset-0.bg-gray-600\\/80');
      if (isModalOpen) return;

      // Перевіряємо поля вводу
      const activeElement = document.activeElement;
      const isInputField =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
              activeElement.tagName === "TEXTAREA" ||
              activeElement.contentEditable === "true");

      if (isInputField) return;

      const currentCard = updatedFlashcards[currentIndex];
      if (!currentCard) return;

      // Обробляємо клавіші
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevCard();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextCard();
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        handleFlip();
      } else if (
          event.key === "v" ||
          event.key === "V" ||
          event.key === "м" ||
          event.key === "М"
      ) {
        event.preventDefault();

        // ВИПРАВЛЕННЯ: Додаткові перевірки для озвучки
        if (currentCard?.text && !isPlayingRef.current && !isChanging) {
          console.log("Keyboard TTS triggered for:", currentCard.text);
          speakText(currentCard.text);
        } else {
          console.log("TTS blocked by conditions:", {
            hasText: !!currentCard?.text,
            isPlaying: isPlayingRef.current,
            isChanging
          });
        }
      } else if (
          (event.key === "r" || event.key === "R" || event.key === "к" || event.key === "К") &&
          !event.ctrlKey && !event.metaKey // НЕ перехоплюємо Ctrl+R (Windows/Linux) та Cmd+R (Mac)
      ) {
        // НОВА КЛАВІША: R для регенерації прикладів (тільки без Ctrl/Cmd)
        event.preventDefault();

        if (isFlipped && !isRegeneratingExamples && !isChanging) {
          if (currentCard && (currentCard.examples?.length > 0 || currentCard.example)) {
            regenerateExamples();
          }
        }
      } else if (
          event.key === "e" || event.key === "E" ||
          event.key === "у" || event.key === "У" // українська розкладка
      ) {
        // НОВА КЛАВІША: E для редагування картки
        event.preventDefault();
        if (!isChanging) {
          onEdit(currentCard);
        }
      } else if (event.key === "Delete") {
        // НОВА КЛАВІША: Del для видалення картки
        event.preventDefault();
        if (!isChanging) {
          handleDeleteClick(currentCard);
        }
      }
    };

    // ВАЖЛИВО: Додаємо обробник з passive: false для preventDefault
    window.addEventListener("keydown", handleKeyPress, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [prevCard, nextCard, handleFlip, speakText, currentIndex, updatedFlashcards, isChanging, isFlipped, isRegeneratingExamples, regenerateExamples]);

  // ВИПРАВЛЕННЯ: Очищення при зміні картки або демонтуванні
  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, [currentIndex, stopCurrentAudio]);

  // ВИПРАВЛЕННЯ: Очищення при демонтуванні компонента
  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  if (!updatedFlashcards || updatedFlashcards.length === 0) {
    return (
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500 text-lg">Немає карток для відображення</p>
        </div>
    );
  }

  // ДОДАНО: Перевірка валідного індексу
  const validCurrentIndex = Math.min(currentIndex, updatedFlashcards.length - 1);
  const currentCard = updatedFlashcards[validCurrentIndex];

  // НОВА ФУНКЦІЯ: Отримуємо приклади з картки (підтримуємо як новий формат, так і старий)
  const getExamples = (card) => {
    if (card.examples && Array.isArray(card.examples) && card.examples.length > 0) {
      return card.examples.filter(ex => ex && ex.trim());
    } else if (card.example && card.example.trim()) {
      return [card.example.trim()];
    }
    return [];
  };

  const examples = getExamples(currentCard);

  return (
      <div className="max-w-4xl mx-auto">
        {/* Main Card Container */}
        <div className="relative">
          {/* Card Actions */}
          <div className="absolute top-6 right-6 flex space-x-2 z-20">
            <button
                onClick={() => {
                  if (!isChanging) onEdit(currentCard);
                }}
                disabled={isChanging}
                className="bg-white/90 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-blue-600 p-2 rounded-full shadow-sm transition-colors"
                title="Редагувати (E)"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
                onClick={() => {
                  if (!isChanging) handleDeleteClick(currentCard);
                }}
                disabled={isChanging}
                className="bg-white/90 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-red-600 p-2 rounded-full shadow-sm transition-colors"
                title="Видалити (Del)"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          {/* Card Content */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden h-[380px] md:h-[458px] relative">
            {/* Front Side */}
            {!isFlipped && (
                <div
                    key={`front-${validCurrentIndex}`} // ОНОВЛЕНО: використовуємо validCurrentIndex
                    className={`h-full transition-all duration-150 ${
                        isChanging ? "opacity-70" : "opacity-100"
                    }`}
                >
                  <div className="bg-white h-full flex flex-col justify-center items-center p-8">
                    <div className="text-center space-y-3 w-full">
                      {currentCard.isAIGenerated && (
                          <div className="inline-flex items-center space-x-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                            <Sparkles className="w-3 h-3" />
                            <span>ШІ-генерація</span>
                          </div>
                      )}

                      <h2 className="text-3xl font-bold text-gray-900 mb-2 break-words max-w-md mx-auto">
                        {currentCard.text}
                      </h2>

                      {currentCard.transcription && (
                          <p className="text-base text-gray-600 font-mono mb-2">
                            {currentCard.transcription}
                          </p>
                      )}

                      <div className="py-3">
                        <button
                            type="button"
                            onClick={() => speakText(currentCard.text)}
                            disabled={
                                !currentCard.text ||
                                isPlayingAudio ||
                                isChanging ||
                                !settingsLoaded
                            }
                            className={`px-6 py-3 rounded-lg transition-all shadow-md ${
                                isPlayingAudio
                                    ? "bg-green-500 hover:bg-green-600 animate-pulse scale-105"
                                    : "bg-purple-500 hover:bg-purple-600 hover:scale-105"
                            } disabled:bg-gray-300 disabled:scale-100 text-white flex items-center space-x-2 mx-auto`}
                            title={
                              !settingsLoaded
                                  ? "Завантаження налаштувань..."
                                  : isPlayingAudio
                                      ? "Відтворення... (натисніть V щоб зупинити)"
                                      : "Прослухати (або натисніть V)"
                            }
                        >
                          <Volume2 className="w-5 h-5" />
                          <span>
                        {!settingsLoaded
                            ? "Завантаження..."
                            : isPlayingAudio
                                ? "Відтворення..."
                                : "Озвучити"}
                      </span>
                        </button>
                      </div>

                      <p className="text-gray-500 text-base">
                        Натисніть Пробіл / Enter, щоб побачити переклад
                      </p>

                      {/* Keyboard shortcuts hint */}
                      <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 mt-2">
                        <div className="flex items-center space-x-1">
                          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">E</kbd>
                          <span>редагувати</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center space-x-1">
                          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Del</kbd>
                          <span>видалити</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            )}

            {/* Back Side */}
            {isFlipped && (
                <div
                    key={`back-${validCurrentIndex}`} // ОНОВЛЕНО: використовуємо validCurrentIndex
                    className={`h-full transition-all duration-150 ${
                        isChanging ? "opacity-70" : "opacity-100"
                    }`}
                >
                  <div className="bg-white h-full flex flex-col overflow-hidden">
                    {/* Header - тільки AI badge */}
                    {currentCard.isAIGenerated && (
                        <div className="p-8 border-b border-gray-200 text-center">
                          <div className="inline-flex items-center space-x-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
                            <Sparkles className="w-3 h-3" />
                            <span>ШІ-генерація</span>
                          </div>
                        </div>
                    )}

                    {/* Content - Scrollable with proper padding */}
                    <div className="overflow-y-auto custom-scrollbar">
                      <div className="p-8 pb-10 space-y-6">
                        {/* Translation - Головний переклад */}
                        {currentCard.translation && (
                            <div className="text-center py-4">
                              <p className="text-2xl font-bold text-gray-900 leading-relaxed mb-2">
                                {currentCard.translation.charAt(0).toUpperCase() + currentCard.translation.slice(1)}
                              </p>
                              <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-gray-300 to-transparent mx-auto"></div>
                            </div>
                        )}

                        {/* Explanation */}
                        {currentCard.explanation && (
                            <div className="mb-10">
                              <h4 className="text-sm font-semibold text-blue-700 mb-5 uppercase tracking-wide">
                                Детальне пояснення
                              </h4>
                              <div
                                  className="bg-blue-100/80 rounded-lg p-8 py-4 border-l-4 border-blue-300 text-lg leading-7"
                                  dangerouslySetInnerHTML={{
                                    __html: processTextContent(currentCard.explanation)
                                  }}
                              />
                            </div>
                        )}

                        {/* Notes - після пояснення */}
                        {currentCard.notes && (
                            <div>
                              <h4 className="text-sm font-semibold text-rose-700 mb-3 uppercase tracking-wide flex items-center">
                                <StickyNote className="w-4 h-4 mr-1" />
                                Особисті нотатки
                              </h4>
                              <div className="bg-rose-50/80 rounded-lg p-4 border-l-4 border-rose-300">
                                <p className="text-gray-800 leading-relaxed text-lg">
                                  {currentCard.notes}
                                </p>
                              </div>
                            </div>
                        )}

                        {/* ОНОВЛЕНО: Examples - тепер з зеленим кольором замість жовтого */}
                        {examples.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide">
                                  Приклади використання
                                </h4>
                                {/* Кнопка регенерації прикладів */}
                                <button
                                    onClick={regenerateExamples}
                                    disabled={isRegeneratingExamples || isChanging}
                                    className="flex items-center space-x-1 text-xs bg-green-200/80 hover:bg-green-200 disabled:bg-gray-100 text-green-700 disabled:text-gray-500 px-4 py-3 rounded-md transition-colors"
                                    title="Згенерувати інші приклади (або натисніть R)"
                                >
                                  {isRegeneratingExamples ? (
                                      <Loader className="w-3 h-3 animate-spin" />
                                  ) : (
                                      <RotateCcw className="w-3 h-3" />
                                  )}
                                  <span>Інші приклади</span>
                                </button>
                              </div>

                              <div className="space-y-3">
                                {examples.map((example, index) => (
                                    <div key={index} className="bg-green-100/80 rounded-lg p-4 border-l-4 border-green-300">
                                      <p className="text-gray-800 italic leading-relaxed text-lg">
                                        "{example}"
                                      </p>
                                    </div>
                                ))}
                              </div>
                            </div>
                        )}

                        {/* Якщо немає жодної додаткової інформації */}
                        {!currentCard.translation &&
                            !currentCard.explanation &&
                            examples.length === 0 &&
                            !currentCard.notes && (
                                <div className="flex items-center justify-center h-full min-h-[200px]">
                                  <div className="text-center text-gray-500">
                                    <p className="text-lg mb-2">Додаткової інформації немає</p>
                                    <p className="text-sm">Відредагуйте картку, щоб додати пояснення або приклади</p>
                                  </div>
                                </div>
                            )}
                      </div>
                    </div>
                  </div>
                </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-4 max-w-4xl mx-auto">
          {/* Left button */}
          <button
              onClick={prevCard}
              disabled={validCurrentIndex === 0 || isChanging} // ОНОВЛЕНО: використовуємо validCurrentIndex
              className="flex items-center space-x-2 px-5 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-lg transition-colors min-w-[140px] cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Попередня</span>
          </button>

          {/* Center dots - обмежуємо кількість видимих точок */}
          <div className="flex space-x-1 overflow-hidden max-w-md">
            {updatedFlashcards.length <= 20 ? (
                // Показуємо всі точки якщо карток мало
                updatedFlashcards.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToCard(index)}
                        disabled={isChanging}
                        className={`w-3 h-3 rounded-full transition-colors disabled:cursor-not-allowed flex-shrink-0 ${
                            index === validCurrentIndex // ОНОВЛЕНО: використовуємо validCurrentIndex
                                ? "bg-blue-600"
                                : "bg-gray-300 hover:bg-gray-400"
                        }`}
                    />
                ))
            ) : (
                // Показуємо компактну версію для великої кількості карток
                <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {validCurrentIndex + 1} / {updatedFlashcards.length} {/* ОНОВЛЕНО: використовуємо validCurrentIndex */}
                </span>
                  <div className="w-80 bg-gray-300 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                        style={{ width: `${((validCurrentIndex + 1) / updatedFlashcards.length) * 100}%` }} // ОНОВЛЕНО: використовуємо validCurrentIndex
                    ></div>
                  </div>
                </div>
            )}
          </div>

          {/* Right button */}
          <button
              onClick={nextCard}
              disabled={validCurrentIndex === updatedFlashcards.length - 1 || isChanging} // ОНОВЛЕНО: використовуємо validCurrentIndex
              className="flex items-center space-x-2 px-5 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white rounded-lg transition-colors min-w-[140px] cursor-pointer"
          >
            <span>Наступна</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmDeleteModal
            isOpen={showDeleteModal}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
            cardText={cardToDelete?.text}
            isDeleting={isDeleting}
        />
      </div>
  );
};

export default DetailedFlashcardView;