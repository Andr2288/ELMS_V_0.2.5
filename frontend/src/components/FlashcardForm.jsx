// frontend/src/components/FlashcardForm.jsx - ДОДАНО ПІДТРИМКУ ПОЧАТКОВОГО ТЕКСТУ

import { useState, useEffect, useCallback, useRef } from "react";
import { Save, X, Folder, Settings, Sparkles, RotateCcw, AlertCircle, Loader, StickyNote, Zap, Plus, Trash2, BookOpen } from "lucide-react";
import { axiosInstance } from "../lib/axios.js";
import { useCategoryStore } from "../store/useCategoryStore.js";
import { useUserSettingsStore } from "../store/useUserSettingsStore.js";
import toast from "react-hot-toast";

const FlashcardForm = ({
                         isOpen,
                         onClose,
                         onSubmit,
                         editingCard,
                         isLoading,
                         preselectedCategoryId,
                         initialText, // ДОДАНО: початковий текст з пошуку
                       }) => {
  const { categories, getCategories, getCategoryById } = useCategoryStore();
  const {
    loadSettings,
    hasUserApiKey,
    getDefaultEnglishLevel,
    getChatGPTModel
  } = useUserSettingsStore();

  // State for form data
  const [formData, setFormData] = useState({
    text: "",
    transcription: "",
    translation: "",
    shortDescription: "",
    explanation: "",
    examples: ["", "", ""],
    notes: "",
    isAIGenerated: false,
    categoryId: "",
  });

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // AI states
  const [englishLevel, setEnglishLevel] = useState(null);
  const [aiError, setAiError] = useState(null);

  // Individual field generation states
  const [isGeneratingField, setIsGeneratingField] = useState({
    shortDescription: false,
    explanation: false,
    definition: false,
    examples: false,
    transcription: false,
    translation: false,
    translateToUkrainian: false
  });

  // Auto-save state for quick creation
  const [isQuickCreating, setIsQuickCreating] = useState(false);

  // Ref for auto-focus
  const textInputRef = useRef(null);

  // Load categories and settings when form opens
  useEffect(() => {
    if (isOpen) {
      getCategories();
      initializeSettings();

      // Auto-focus on text field after a small delay
      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, getCategories]);

  const initializeSettings = async () => {
    try {
      await loadSettings();
      setSettingsLoaded(true);
      setEnglishLevel(getDefaultEnglishLevel());
    } catch (error) {
      console.error("Failed to load settings:", error);
      setSettingsLoaded(true);
      setEnglishLevel("B1");
    }
  };

  // ОНОВЛЕНО: Ініціалізація форми з підтримкою початкового тексту
  useEffect(() => {
    if (editingCard) {
      // Обробляємо examples як масив
      let examples = ["", "", ""];
      if (editingCard.examples && Array.isArray(editingCard.examples)) {
        examples = [...editingCard.examples];
        // Доповнюємо до 3 елементів якщо менше
        while (examples.length < 3) {
          examples.push("");
        }
        // Обрізаємо до 3 елементів якщо більше
        examples = examples.slice(0, 3);
      } else if (editingCard.example) {
        // Зворотна сумісність зі старим форматом
        examples[0] = editingCard.example;
      }

      setFormData({
        text: editingCard.text || "",
        transcription: editingCard.transcription || "",
        translation: editingCard.translation || "",
        shortDescription: editingCard.shortDescription || "",
        explanation: editingCard.explanation || "",
        examples: examples,
        notes: editingCard.notes || "",
        isAIGenerated: editingCard.isAIGenerated || false,
        categoryId: editingCard.categoryId?._id || "",
      });
    } else {
      // ДОДАНО: Використовуємо initialText якщо він переданий
      setFormData({
        text: initialText || "", // ВИКОРИСТОВУЄМО ПОЧАТКОВИЙ ТЕКСТ
        transcription: "",
        translation: "",
        shortDescription: "",
        explanation: "",
        examples: ["", "", ""],
        notes: "",
        isAIGenerated: false,
        categoryId: preselectedCategoryId || "",
      });
    }
  }, [editingCard, isOpen, preselectedCategoryId, initialText]); // ДОДАНО initialText до залежностей

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.text.trim()) return;

    try {
      const submitData = {
        ...formData,
        categoryId: formData.categoryId || null,
        // Фільтруємо порожні приклади
        examples: formData.examples.filter(ex => ex.trim())
      };

      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleInputChange = (field, value) => {
    // Капіталізація першої букви для перекладу
    if (field === 'translation' && value) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Обробка зміни прикладів
  const handleExampleChange = (index, value) => {
    const newExamples = [...formData.examples];
    newExamples[index] = value;
    setFormData((prev) => ({
      ...prev,
      examples: newExamples,
    }));
  };

  // Додавання нового прикладу
  const addExample = () => {
    if (formData.examples.length < 5) { // Максимум 5 прикладів
      setFormData((prev) => ({
        ...prev,
        examples: [...prev.examples, ""]
      }));
    }
  };

  // Видалення прикладу
  const removeExample = (index) => {
    if (formData.examples.length > 1) { // Мінімум 1 приклад
      const newExamples = formData.examples.filter((_, i) => i !== index);
      setFormData((prev) => ({
        ...prev,
        examples: newExamples
      }));
    }
  };

  const handleClose = () => {
    onClose();
  };

  // Функція отримання контексту категорії для ШІ
  const getCategoryContextInfo = () => {
    const currentCategoryId = formData.categoryId;
    if (!currentCategoryId || currentCategoryId === 'uncategorized') {
      return null;
    }

    const category = getCategoryById(currentCategoryId);
    if (!category) {
      return null;
    }

    return {
      categoryId: category._id,
      categoryName: category.name,
      categoryDescription: category.description || ""
    };
  };

  // Генерація окремого поля з урахуванням категорії
  const generateField = async (fieldType) => {
    if (!formData.text.trim()) {
      toast.error("Введіть слово або фразу спочатку");
      return;
    }

    if (!englishLevel) {
      setEnglishLevel("B1");
    }

    setIsGeneratingField(prev => ({ ...prev, [fieldType]: true }));

    try {
      console.log(`Generating field: ${fieldType} for text: "${formData.text.trim()}"`);

      // Підготовка даних для API з урахуванням категорії
      const requestData = {
        text: formData.text.trim(),
        englishLevel: englishLevel,
        promptType: fieldType
      };

      // Додаємо інформацію про категорію якщо є
      const categoryContext = getCategoryContextInfo();
      if (categoryContext) {
        requestData.categoryId = categoryContext.categoryId;
        console.log(`Using category context: ${categoryContext.categoryName}`);
      }

      const response = await axiosInstance.post("/openai/generate-flashcard", requestData);

      const result = response.data.result;
      console.log(`Generated result for ${fieldType}:`, result);

      // Спеціальна обробка різних типів полів
      if (fieldType === "examples") {
        // Обробляємо масив прикладів
        if (Array.isArray(result)) {
          const newExamples = ["", "", ""];
          result.forEach((example, index) => {
            if (index < 3 && example) {
              newExamples[index] = example;
            }
          });
          setFormData(prev => ({
            ...prev,
            examples: newExamples,
            isAIGenerated: true
          }));
        } else {
          // Fallback якщо результат не масив
          setFormData(prev => ({
            ...prev,
            examples: [result || "", "", ""],
            isAIGenerated: true
          }));
        }
      } else if (fieldType === "translateToUkrainian") {
        // Спеціальна обробка для перекладу на українську
        setFormData(prev => ({
          ...prev,
          translation: result,
          isAIGenerated: true
        }));
      } else if (fieldType === "definition") {
        // Спеціальна обробка для детального пояснення
        setFormData(prev => ({
          ...prev,
          explanation: result,
          isAIGenerated: true
        }));
      } else {
        // Стандартна обробка для інших полів
        setFormData(prev => ({
          ...prev,
          [fieldType]: result,
          isAIGenerated: true
        }));
      }

      // Показуємо інформацію про використання контексту категорії
      if (categoryContext) {
        toast.success(`Згенеровано з урахуванням теми "${categoryContext.categoryName}"`);
      }

    } catch (error) {
      console.error(`Error generating ${fieldType}:`, error);

      // Детальна обробка помилок
      if (error.response?.status === 401) {
        toast.error("API ключ недійсний");
      } else if (error.response?.status === 402) {
        toast.error("Недостатньо кредитів OpenAI");
      } else if (error.response?.status === 429) {
        toast.error("Перевищено ліміт запитів OpenAI");
      } else if (error.response?.status === 500) {
        toast.error("OpenAI API не налаштований");
      } else {
        toast.error(`Помилка генерації ${getFieldName(fieldType).toLowerCase()}`);
      }
    } finally {
      setIsGeneratingField(prev => ({ ...prev, [fieldType]: false }));
    }
  };

  const getFieldName = (fieldType) => {
    const names = {
      shortDescription: "Короткий опис",
      explanation: "Детальне пояснення",
      definition: "Детальне пояснення",
      examples: "Приклади",
      transcription: "Транскрипцію",
      translation: "Переклад",
      translateToUkrainian: "Переклад"
    };
    return names[fieldType] || fieldType;
  };

  // Validate text field
  const validateTextField = () => {
    const text = formData.text.trim();

    if (!text) {
      toast.error("Введіть слово або фразу для створення картки");
      return false;
    }

    if (text.length < 1) {
      toast.error("Слово або фраза занадто коротка");
      return false;
    }

    if (text.length > 200) {
      toast.error("Слово або фраза занадто довга (максимум 200 символів)");
      return false;
    }

    return true;
  };

  function capitalizeFirstLetter(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Quick create flashcard with AI з урахуванням категорії
  const quickCreateFlashcard = async () => {
    if (!validateTextField()) {
      return;
    }

    if (!englishLevel) {
      setEnglishLevel("B1");
    }

    setIsQuickCreating(true);

    try {
      // Підготовка даних для API з урахуванням категорії
      const requestData = {
        text: formData.text.trim(),
        englishLevel: englishLevel,
        promptType: "completeFlashcard"
      };

      // Додаємо інформацію про категорію якщо є
      const categoryContext = getCategoryContextInfo();
      if (categoryContext) {
        requestData.categoryId = categoryContext.categoryId;
        console.log(`Quick create with category context: ${categoryContext.categoryName}`);
      }

      // Generate AI content
      const response = await axiosInstance.post("/openai/generate-flashcard", requestData);

      let aiContent = {};

      if (response.data.parsed) {
        aiContent = response.data.result;
      } else {
        // Fallback parsing if JSON parsing failed
        const rawText = response.data.raw;
        const translationMatch = rawText.match(/translation["']?\s*:\s*["']([^"']+)["']/i);
        const shortDescMatch = rawText.match(/shortDescription["']?\s*:\s*["']([^"']+)["']/i);
        const explanationMatch = rawText.match(/explanation["']?\s*:\s*["']([^"']+)["']/i);
        const transcriptionMatch = rawText.match(/transcription["']?\s*:\s*["']([^"']+)["']/i);
        const notesMatch = rawText.match(/notes["']?\s*:\s*["']([^"']+)["']/i);

        // Обробляємо examples
        let examples = [];
        const examplesMatch = rawText.match(/examples["']?\s*:\s*\[([\s\S]*?)\]/i);
        if (examplesMatch) {
          try {
            const examplesArray = JSON.parse(`[${examplesMatch[1]}]`);
            examples = examplesArray.map(ex => ex.replace(/^["']|["']$/g, '')).slice(0, 3);
          } catch (e) {
            console.log("Error parsing examples:", e);
            const exampleMatch = rawText.match(/example["']?\s*:\s*["']([^"']+)["']/i);
            if (exampleMatch) {
              examples = [exampleMatch[1]];
            }
          }
        }

        aiContent = {
          transcription: transcriptionMatch ? transcriptionMatch[1] : "",
          translation: translationMatch ? translationMatch[1] : "",
          shortDescription: shortDescMatch ? shortDescMatch[1] : "",
          explanation: explanationMatch ? explanationMatch[1] : "",
          examples: examples,
          notes: notesMatch ? notesMatch[1] : "",
        };
      }

      // Обробляємо examples в submitData
      let examples = [];
      if (aiContent.examples && Array.isArray(aiContent.examples)) {
        examples = aiContent.examples.filter(ex => ex && ex.trim());
      } else if (aiContent.example) {
        examples = [aiContent.example];
      }

      // Capitalize fields before saving
      aiContent.translation = capitalizeFirstLetter(aiContent.translation);
      aiContent.shortDescription = capitalizeFirstLetter(aiContent.shortDescription);
      aiContent.explanation = capitalizeFirstLetter(aiContent.explanation);
      aiContent.notes = capitalizeFirstLetter(aiContent.notes);

      // Prepare data for submission
      const submitData = {
        text: formData.text.trim(),
        transcription: aiContent.transcription || "",
        translation: aiContent.translation || "",
        shortDescription: aiContent.shortDescription || "",
        explanation: aiContent.explanation || "",
        examples: examples,
        notes: aiContent.notes || "",
        isAIGenerated: true,
        categoryId: formData.categoryId || null,
      };

      // Auto-save the flashcard
      await onSubmit(submitData);

      // Close the form
      onClose();

    } catch (error) {

      console.error("Error in quick create:", error);

      let errorMessage = "Помилка швидкого створення картки";

      if (error.response?.status === 401) {
        errorMessage = "API ключ недійсний. Перевірте налаштування";
      } else if (error.response?.status === 402) {
        errorMessage = "Недостатньо кредитів OpenAI";
      } else if (error.response?.status === 429) {
        errorMessage = "Перевищено ліміт запитів OpenAI";
      } else if (error.response?.status === 500) {
        errorMessage = "OpenAI API не налаштований";
      }

      toast.error(errorMessage);
    } finally {
      setIsQuickCreating(false);
    }
  };

  // Обробка клавіш
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (event) => {
      // ESC для закриття форми
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isQuickCreating) {
          handleClose();
        }
        return;
      }

      // Ctrl + Space для швидкого створення картки
      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        if (!isQuickCreating) {
          quickCreateFlashcard();
        }
        return;
      }

      const activeElement = document.activeElement;
      const isInputField =
          activeElement &&
          (activeElement.tagName === "INPUT" ||
              activeElement.tagName === "TEXTAREA" ||
              activeElement.tagName === "SELECT" ||
              activeElement.contentEditable === "true");

      if (isInputField) return;
    };

    window.addEventListener("keydown", handleKeyPress, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isOpen, formData.text, isQuickCreating]);

  if (!isOpen) return null;

  const selectedCategory = categories.find(
      (cat) => cat._id === formData.categoryId
  );

  // Отримуємо контекст категорії для відображення
  const categoryContextInfo = getCategoryContextInfo();

  return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900/60 via-blue-900/40 to-indigo-900/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col border border-gray-100">
          {/* Fixed Header */}
          <div className="sticky top-0 bg-white p-8 border-b border-blue-100 rounded-t-2xl z-10 flex-shrink-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {editingCard ? "Редагувати картку" : "Створити нову картку"}
                    {/* ДОДАНО: Показуємо якщо це з пошуку */}
                    {!editingCard && initialText && (
                        <span className="text-sm font-normal text-blue-600 block">
                            З пошуку: "{initialText}"
                        </span>
                    )}
                  </h2>
                  <div className="flex items-center space-x-4 mt-1">
                    {settingsLoaded && (
                        <p className="text-sm text-gray-600">
                          Рівень англійської: <span className="font-semibold text-blue-600">{englishLevel}</span>
                        </p>
                    )}
                  </div>
                </div>
              </div>
              <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 hover:bg-white/80 p-2 rounded-xl transition-all duration-200 hover:scale-110 cursor-pointer"
                  title="Закрити (Esc)"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Word/Text */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Слово/Фраза <span className="text-red-500">*</span>
                </label>
                <textarea
                    ref={textInputRef}
                    value={formData.text}
                    onChange={(e) => {
                      const value = e.target.value;
                      const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
                      handleInputChange("text", capitalized);
                    }}
                    placeholder="Введіть слово або фразу..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                    rows="1"
                    required
                    disabled={isQuickCreating}
                />

                {/* Quick creation indicator */}
                {isQuickCreating && (
                    <div className="mt-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                      <div className="text-sm text-green-700">
                        <p className="font-semibold">Швидке створення картки...</p>
                        <p className="text-xs">
                          Генерація ШІ контенту
                          {categoryContextInfo && (
                              <span> з урахуванням теми "{categoryContextInfo.categoryName}"</span>
                          )}
                          та автоматичне збереження
                        </p>
                      </div>
                    </div>
                )}
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Папка
                  {/* Підказка про вплив на ШІ генерацію */}
                  <span className="text-xs text-gray-500 ml-2 font-normal">
                    (впливає на точність ШІ перекладу та контексту)
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Folder className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                      value={formData.categoryId}
                      onChange={(e) =>
                          handleInputChange("categoryId", e.target.value)
                      }
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-all duration-200 hover:border-gray-300 text-gray-900"
                  >
                    <option value="">Без папки</option>
                    {categories.map((category) => (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                    ))}
                  </select>
                </div>
                {/* Додаткова інформація про категорію */}
                {categoryContextInfo && categoryContextInfo.categoryDescription && (
                    <p className="text-xs text-gray-600 mt-2 italic">
                      Опис теми: {categoryContextInfo.categoryDescription}
                    </p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Transcription with AI button */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Транскрипція
                      </label>
                      <button
                          type="button"
                          onClick={() => generateField("transcription")}
                          disabled={isGeneratingField.transcription || !formData.text.trim() || isQuickCreating}
                          className="text-xs bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 text-purple-700 px-3 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:transform-none"
                      >
                        {isGeneratingField.transcription ? (
                            <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                            <Zap className="w-3 h-3" />
                        )}
                        <span>ШІ</span>
                      </button>
                    </div>
                    <textarea
                        value={formData.transcription}
                        onChange={(e) =>
                            handleInputChange("transcription", e.target.value)
                        }
                        placeholder="[trænˈskrɪpʃən] - фонетична транскрипція"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono resize-none disabled:bg-gray-100 transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                        rows="3"
                        disabled={isQuickCreating}
                    />
                  </div>

                  {/* Translation with AI button */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Переклад
                      </label>
                      <button
                          type="button"
                          onClick={() => generateField("translateToUkrainian")}
                          disabled={isGeneratingField.translateToUkrainian || !formData.text.trim() || isQuickCreating}
                          className="text-xs bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 text-purple-700 px-3 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:transform-none"
                      >
                        {isGeneratingField.translateToUkrainian ? (
                            <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                            <Zap className="w-3 h-3" />
                        )}
                        <span>ШІ</span>
                      </button>
                    </div>
                    <textarea
                        value={formData.translation}
                        onChange={(e) => handleInputChange("translation", e.target.value)}
                        placeholder="Український переклад слова..."
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                        rows="3"
                        disabled={isQuickCreating}
                    />
                  </div>

                  {/* Short Description with AI button */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Короткий опис
                      </label>
                      <button
                          type="button"
                          onClick={() => generateField("shortDescription")}
                          disabled={isGeneratingField.shortDescription || !formData.text.trim() || isQuickCreating}
                          className="text-xs bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 text-purple-700 px-3 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:transform-none"
                      >
                        {isGeneratingField.shortDescription ? (
                            <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                            <Zap className="w-3 h-3" />
                        )}
                        <span>ШІ</span>
                      </button>
                    </div>
                    <textarea
                        value={formData.shortDescription}
                        onChange={(e) => handleInputChange("shortDescription", e.target.value)}
                        placeholder="Короткий опис слова для відображення в списку карток..."
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                        rows="3"
                        maxLength="200"
                        disabled={isQuickCreating}
                    />
                    <p className="text-xs text-gray-500 mt-2 flex items-center">
                      <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                      {formData.shortDescription.length}/200 символів. Використовується для відображення в сітці карток.
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Explanation with AI button */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Детальне пояснення
                      </label>
                      <button
                          type="button"
                          onClick={() => generateField("definition")}
                          disabled={isGeneratingField.definition || !formData.text.trim() || isQuickCreating}
                          className="text-xs bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 text-purple-700 px-3 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:transform-none"
                      >
                        {isGeneratingField.definition ? (
                            <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                            <Zap className="w-3 h-3" />
                        )}
                        <span>ШІ</span>
                      </button>
                    </div>
                    <textarea
                        value={formData.explanation}
                        onChange={(e) => handleInputChange("explanation", e.target.value)}
                        placeholder="Детальне пояснення значення, контексту використання..."
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                        rows="3"
                        disabled={isQuickCreating}
                    />
                  </div>

                  {/* Examples with AI button */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-semibold text-gray-700">
                        Приклади вживання
                      </label>
                      <button
                          type="button"
                          onClick={() => generateField("examples")}
                          disabled={isGeneratingField.examples || !formData.text.trim() || isQuickCreating}
                          className="text-xs bg-purple-100 hover:bg-purple-200 disabled:bg-gray-100 text-purple-700 px-3 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:transform-none"
                      >
                        {isGeneratingField.examples ? (
                            <Loader className="w-3 h-3 animate-spin" />
                        ) : (
                            <Zap className="w-3 h-3" />
                        )}
                        <span>ШІ (3 приклади)</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {formData.examples.map((example, index) => (
                          <div key={index} className="flex space-x-2">
                            <div className="flex-1">
                              <textarea
                                  value={example}
                                  onChange={(e) => handleExampleChange(index, e.target.value)}
                                  placeholder={`Приклад ${index + 1}...`}
                                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                                  rows="2"
                                  disabled={isQuickCreating}
                              />
                            </div>
                            {formData.examples.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeExample(index)}
                                    disabled={isQuickCreating}
                                    className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-all duration-200 disabled:opacity-50 transform hover:scale-110"
                                    title="Видалити приклад"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                          </div>
                      ))}

                      {formData.examples.length < 5 && (
                          <button
                              type="button"
                              onClick={addExample}
                              disabled={isQuickCreating}
                              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 bg-white hover:bg-blue-50"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Додати ще один приклад</span>
                          </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Особисті нотатки
                </label>
                <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Ваші особисті нотатки, підказки для запам'ятовування..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                    rows="3"
                    disabled={isQuickCreating}
                />
              </div>
            </form>
          </div>

          {/* Fixed Footer */}
          <div className="sticky bottom-0 bg-white p-8 border-t border-gray-200 rounded-b-2xl flex-shrink-0">
            <div className="flex space-x-4">
              <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isLoading || !formData.text.trim() || isQuickCreating}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-blue-400 disabled:to-blue-500 disabled:cursor-default text-white px-6 py-3 rounded-md font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100 cursor-pointer"
              >
                {isLoading || isQuickCreating ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>
                    {editingCard ? "Зберегти зміни" : "Створити картку"}
                  </span>
                    </>
                )}
              </button>
              <button
                  type="button"
                  onClick={handleClose}
                  disabled={isQuickCreating}
                  className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 disabled:from-gray-100 disabled:to-gray-100 text-gray-700 rounded-md font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none border border-gray-200"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default FlashcardForm;