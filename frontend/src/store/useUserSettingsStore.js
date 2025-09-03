// frontend/src/store/useUserSettingsStore.js - ДОДАНО ПІДТРИМКУ СОРТУВАННЯ

import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";

// Debounce utility function
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

export const useUserSettingsStore = create((set, get) => {
    let saveTimeout = null;

    // Debounced save function
    const debouncedSave = debounce(async (updateData) => {
        try {
            console.log('Settings: Saving debounced changes:', updateData);

            const response = await axiosInstance.put("/settings", updateData, {
                timeout: 10000
            });

            set({
                settings: response.data,
                isSaving: false
            });
            console.log("Settings: Auto-saved successfully");
        } catch (error) {
            if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
                console.error("Settings: Debounced save failed:", error);
                set({ isSaving: false });
                const message = error.response?.data?.message || "Помилка збереження";
                toast.error(message);
            }
        }
    }, 1000);

    return {
        settings: null,
        availableOptions: null,
        isLoading: false,
        isSaving: false,

        // Load user settings
        loadSettings: async () => {
            set({ isLoading: true });

            try {
                const response = await axiosInstance.get("/settings", {
                    timeout: 10000
                });

                set({
                    settings: response.data,
                    isLoading: false
                });

                return response.data;
            } catch (error) {
                if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
                    console.error("Error loading settings:", error);
                    set({ isLoading: false });
                }
                return null;
            }
        },

        // Load available options for dropdowns
        loadAvailableOptions: async () => {
            if (get().availableOptions) {
                return get().availableOptions;
            }

            try {
                const response = await axiosInstance.get("/settings/options", {
                    timeout: 5000
                });

                set({ availableOptions: response.data });
                return response.data;
            } catch (error) {
                if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
                    console.error("Error loading options:", error);
                }
                return null;
            }
        },

        // Auto-save з debouncing та optimistic updates
        updateSetting: async (path, value) => {
            const currentSettings = get().settings;
            if (!currentSettings) return;

            console.log(`Settings: Updating ${path} to:`, value);

            // OPTIMISTIC UPDATE: Негайно оновлюємо локальний стейт
            const newSettings = { ...currentSettings };
            const keys = path.split('.');
            let current = newSettings;

            // Navigate to the parent object
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }

            // Set the value
            current[keys[keys.length - 1]] = value;

            // Негайно оновлюємо UI
            set({
                settings: newSettings,
                isSaving: true
            });

            // Підготовуємо дані для збереження
            const updateData = {};
            const topLevelKey = keys[0];

            if (topLevelKey === 'ttsSettings') {
                updateData.ttsSettings = newSettings.ttsSettings;
            } else if (topLevelKey === 'generalSettings') {
                updateData.generalSettings = newSettings.generalSettings;
            } else if (topLevelKey === 'aiSettings') {
                updateData.aiSettings = newSettings.aiSettings;
            } else if (topLevelKey === 'apiKeySource') {
                updateData.apiKeySource = newSettings.apiKeySource;
            } else if (topLevelKey === 'userApiKey') {
                updateData.userApiKey = newSettings.userApiKey;
            }

            // DEBOUNCED SAVE: Зберігаємо з затримкою
            debouncedSave(updateData);
        },

        // Update multiple settings at once (for form submissions)
        updateSettings: async (settingsData) => {
            try {
                set({ isSaving: true });

                const response = await axiosInstance.put("/settings", settingsData, {
                    timeout: 15000
                });

                set({
                    settings: response.data,
                    isSaving: false
                });
                toast.success("Налаштування збережено!");

                return response.data;
            } catch (error) {
                if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
                    console.error("Error updating settings:", error);
                    set({ isSaving: false });
                    const message = error.response?.data?.message || "Помилка збереження";
                    toast.error(message);
                }
                throw error;
            }
        },

        // Reset settings to default
        resetSettings: async () => {
            try {
                set({ isSaving: true });

                const response = await axiosInstance.post("/settings/reset", {}, {
                    timeout: 10000
                });

                set({
                    settings: response.data,
                    isSaving: false
                });
                toast.success("Налаштування скинуто!");

                return response.data;
            } catch (error) {
                if (error.name !== 'AbortError' && error.name !== 'CanceledError') {
                    console.error("Error resetting settings:", error);
                    set({ isSaving: false });
                    toast.error("Помилка скидання налаштувань");
                }
                throw error;
            }
        },

        // Get current TTS settings
        getTTSSettings: () => {
            const settings = get().settings;
            return settings?.ttsSettings || {
                model: "tts-1",
                voice: "alloy",
                speed: 1.0,
                responseFormat: "mp3",
                voiceStyle: "neutral",
                customInstructions: ""
            };
        },

        // ОНОВЛЕНО: Get current general settings з підтримкою сортування
        getGeneralSettings: () => {
            const settings = get().settings;
            return settings?.generalSettings || {
                cacheAudio: true,
                defaultEnglishLevel: "B1",
                // ДОДАНО: Налаштування сортування за замовчуванням
                categorySortBy: "date",
                categorySortOrder: "desc",
                flashcardSortBy: "date",
                flashcardSortOrder: "desc"
            };
        },

        // Get current AI settings
        getAISettings: () => {
            const settings = get().settings;
            return settings?.aiSettings || {
                chatgptModel: "gpt-4.1-mini"
            };
        },

        // Get default English level
        getDefaultEnglishLevel: () => {
            const settings = get().getGeneralSettings();
            return settings.defaultEnglishLevel || "B1";
        },

        // Get ChatGPT model
        getChatGPTModel: () => {
            const settings = get().getAISettings();
            return settings.chatgptModel || "gpt-4.1-mini";
        },

        // ДОДАНО: Методи для роботи з налаштуваннями сортування категорій
        getCategorySortSettings: () => {
            const generalSettings = get().getGeneralSettings();
            return {
                sortBy: generalSettings.categorySortBy || "date",
                sortOrder: generalSettings.categorySortOrder || "desc"
            };
        },

        setCategorySortSettings: async (sortBy, sortOrder) => {
            await get().updateSetting('generalSettings.categorySortBy', sortBy);
            await get().updateSetting('generalSettings.categorySortOrder', sortOrder);
        },

        // ДОДАНО: Методи для роботи з налаштуваннями сортування карток
        getFlashcardSortSettings: () => {
            const generalSettings = get().getGeneralSettings();
            return {
                sortBy: generalSettings.flashcardSortBy || "date",
                sortOrder: generalSettings.flashcardSortOrder || "desc"
            };
        },

        setFlashcardSortSettings: async (sortBy, sortOrder) => {
            await get().updateSetting('generalSettings.flashcardSortBy', sortBy);
            await get().updateSetting('generalSettings.flashcardSortOrder', sortOrder);
        },

        // ДОДАНО: Отримання повної інформації про API ключі
        getApiKeyInfo: () => {
            const settings = get().settings;
            return settings?.apiKeyInfo || {
                effectiveSource: "system",
                available: ["system"],
                hasUserKey: false,
                hasSystemKey: true,
                selectedSource: "system"
            };
        },

        // ДОДАНО: Перевірка чи користувач має власний API ключ
        hasApiKey: () => {
            const apiInfo = get().getApiKeyInfo();
            return apiInfo.effectiveSource !== "none";
        },

        hasUserApiKey: () => {
            const apiInfo = get().getApiKeyInfo();
            return apiInfo.hasUserKey;
        },

        // Get voice style instructions
        getVoiceStyleInstruction: (style) => {
            const instructions = {
                neutral: "Speak naturally and clearly with neutral tone.",
                formal: "Voice: Clear, authoritative, and composed, projecting confidence and professionalism. Tone: Neutral and informative.",
                calm: "Voice Affect: Calm, composed, and reassuring; project quiet authority and confidence. Tone: Sincere and empathetic.",
                dramatic: "Voice Affect: Low, hushed, and suspenseful; convey tension and intrigue. Tone: Deeply serious and mysterious.",
                educational: "Voice: Clear and engaging, suitable for learning. Pace: Moderate and well-structured for comprehension."
            };
            return instructions[style] || instructions.neutral;
        },

        // Check if audio caching is enabled
        isCacheEnabled: () => {
            const settings = get().getGeneralSettings();
            return settings.cacheAudio;
        },

        // ДОДАНО: Utility methods для preferences
        getPreference: (path, defaultValue = null) => {
            const settings = get().settings;
            if (!settings) return defaultValue;

            const keys = path.split('.');
            let current = settings;

            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return defaultValue;
                }
            }

            return current !== undefined ? current : defaultValue;
        },

        setPreference: async (path, value) => {
            await get().updateSetting(path, value);
        },

        // ДОДАНО: Валідація налаштувань сортування
        validateSortSettings: (sortBy, sortOrder) => {
            const validSortBy = ['date', 'alphabet', 'flashcards', 'progress'];
            const validSortOrder = ['asc', 'desc'];

            const isValidSortBy = validSortBy.includes(sortBy);
            const isValidSortOrder = validSortOrder.includes(sortOrder);

            return {
                isValid: isValidSortBy && isValidSortOrder,
                errors: {
                    sortBy: isValidSortBy ? null : `Invalid sortBy: ${sortBy}. Valid options: ${validSortBy.join(', ')}`,
                    sortOrder: isValidSortOrder ? null : `Invalid sortOrder: ${sortOrder}. Valid options: ${validSortOrder.join(', ')}`
                }
            };
        },

        // ДОДАНО: Експорт/імпорт налаштувань
        exportSettings: () => {
            const settings = get().settings;
            if (!settings) return null;

            // Видаляємо чутливі дані
            const exportData = {
                ...settings,
                userApiKey: undefined, // Не експортуємо API ключі з безпеки
                apiKeyInfo: undefined
            };

            return JSON.stringify(exportData, null, 2);
        },

        importSettings: async (settingsJson) => {
            try {
                const importedSettings = JSON.parse(settingsJson);

                // Валідуємо імпортовані налаштування
                const validatedSettings = {
                    ttsSettings: importedSettings.ttsSettings || {},
                    generalSettings: importedSettings.generalSettings || {},
                    aiSettings: importedSettings.aiSettings || {}
                };

                await get().updateSettings(validatedSettings);
                toast.success("Налаштування імпортовано успішно!");

                return true;
            } catch (error) {
                console.error("Error importing settings:", error);
                toast.error("Помилка імпорту налаштувань");
                return false;
            }
        },

        // Utility to get complete settings with defaults
        getCompleteSettings: () => {
            const state = get();
            return {
                ttsSettings: state.getTTSSettings(),
                generalSettings: state.getGeneralSettings(),
                aiSettings: state.getAISettings()
            };
        },

        // ДОДАНО: Сервісні методи
        getSortDisplayName: (sortBy) => {
            const names = {
                date: "За датою",
                alphabet: "За алфавітом",
                flashcards: "За кількістю карток",
                progress: "За прогресом",
                status: "За статусом"
            };
            return names[sortBy] || sortBy;
        },

        getSortOrderDisplayName: (sortOrder) => {
            const names = {
                asc: "За зростанням",
                desc: "За спаданням"
            };
            return names[sortOrder] || sortOrder;
        },

        // ДОДАНО: Перевірка чи налаштування завантажені
        areSettingsLoaded: () => {
            return !!get().settings;
        },

        // ДОДАНО: Отримання статистики налаштувань
        getSettingsStats: () => {
            const settings = get().settings;
            if (!settings) return null;

            return {
                hasCustomTTSSettings: settings.ttsSettings?.model !== "tts-1" ||
                    settings.ttsSettings?.voice !== "alloy" ||
                    settings.ttsSettings?.speed !== 1.0,
                hasCustomSortingSettings: settings.generalSettings?.categorySortBy !== "date" ||
                    settings.generalSettings?.categorySortOrder !== "desc",
                hasUserApiKey: settings.apiKeyInfo?.hasUserKey || false,
                englishLevel: settings.generalSettings?.defaultEnglishLevel || "B1"
            };
        },

        // Clear store
        clearSettings: () => {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveTimeout = null;
            }

            set({
                settings: null,
                availableOptions: null,
                isSaving: false,
                isLoading: false
            });
        },

        // ДОДАНО: Методи для роботи з налаштуваннями за замовчуванням
        getDefaultSettings: () => {
            return {
                ttsSettings: {
                    model: "tts-1",
                    voice: "alloy",
                    speed: 1.0,
                    responseFormat: "mp3",
                    voiceStyle: "neutral",
                    customInstructions: ""
                },
                generalSettings: {
                    cacheAudio: true,
                    defaultEnglishLevel: "B1",
                    categorySortBy: "date",
                    categorySortOrder: "desc",
                    flashcardSortBy: "date",
                    flashcardSortOrder: "desc"
                },
                aiSettings: {
                    chatgptModel: "gpt-4.1-mini"
                }
            };
        },

        isSettingDefault: (path) => {
            const currentValue = get().getPreference(path);
            const defaultSettings = get().getDefaultSettings();

            const keys = path.split('.');
            let defaultValue = defaultSettings;

            for (const key of keys) {
                if (defaultValue && typeof defaultValue === 'object' && key in defaultValue) {
                    defaultValue = defaultValue[key];
                } else {
                    return false;
                }
            }

            return currentValue === defaultValue;
        }
    };
});