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

        getGeneralSettings: () => {
            const settings = get().settings;
            return settings?.generalSettings || {
                cacheAudio: true,
                defaultEnglishLevel: "B1",
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

        // ДОДАНО: Методи для роботи з налаштуваннями сортування карток
        getFlashcardSortSettings: () => {
            const generalSettings = get().getGeneralSettings();
            return {
                sortBy: generalSettings.flashcardSortBy || "date",
                sortOrder: generalSettings.flashcardSortOrder || "desc"
            };
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
        }
    };
});