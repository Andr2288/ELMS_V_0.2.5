// backend/src/controllers/userSettings.controller.js - ДОДАНО ПІДТРИМКУ СОРТУВАННЯ

import UserSettings from "../models/userSettings.model.js";

const getUserSettings = async (req, res) => {
    try {
        const userId = req.user._id;

        let settings = await UserSettings.findOne({ userId });

        // Create default settings if none exist
        if (!settings) {
            settings = new UserSettings({
                userId,
                apiKeySource: "system",
                userApiKey: null,
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
                    // ДОДАНО: Налаштування сортування за замовчуванням
                    categorySortBy: "date",
                    categorySortOrder: "desc",
                    flashcardSortBy: "date",
                    flashcardSortOrder: "desc"
                },
                aiSettings: {
                    chatgptModel: "gpt-4.1-mini"
                }
            });
            await settings.save();
        } else {
            // ДОДАНО: Міграція існуючих налаштувань для додавання полів сортування
            let needsUpdate = false;

            if (!settings.generalSettings) {
                settings.generalSettings = {};
                needsUpdate = true;
            }

            if (!settings.generalSettings.categorySortBy) {
                settings.generalSettings.categorySortBy = "date";
                needsUpdate = true;
            }

            if (!settings.generalSettings.categorySortOrder) {
                settings.generalSettings.categorySortOrder = "desc";
                needsUpdate = true;
            }

            if (!settings.generalSettings.flashcardSortBy) {
                settings.generalSettings.flashcardSortBy = "date";
                needsUpdate = true;
            }

            if (!settings.generalSettings.flashcardSortOrder) {
                settings.generalSettings.flashcardSortOrder = "desc";
                needsUpdate = true;
            }

            if (needsUpdate) {
                await settings.save();
                console.log(`Migrated sorting settings for user ${userId}`);
            }
        }

        // Додаємо інформацію про API ключі (без розкриття самих ключів)
        const settingsObj = settings.toObject();
        const apiKeyInfo = settings.getApiKeyInfo();

        // Видаляємо сам ключ з відповіді для безпеки
        delete settingsObj.userApiKey;

        // Додаємо інформацію про API ключі
        settingsObj.apiKeyInfo = apiKeyInfo;

        return res.status(200).json(settingsObj);
    } catch (error) {
        console.log("Error in getUserSettings controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// Auto-save settings - no manual save needed
const updateUserSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const updateData = req.body;

        let settings = await UserSettings.findOne({ userId });

        if (!settings) {
            settings = new UserSettings({ userId });
        }

        // Update API key settings
        if (updateData.apiKeySource !== undefined) {
            settings.apiKeySource = updateData.apiKeySource;
        }

        // Оновлення користувацького API ключа (окремо для безпеки)
        if (updateData.userApiKey !== undefined) {
            if (updateData.userApiKey && updateData.userApiKey.trim()) {
                settings.setUserApiKey(updateData.userApiKey);
            } else {
                settings.clearUserApiKey();
            }
        }

        // Update TTS settings
        if (updateData.ttsSettings) {
            if (updateData.ttsSettings.model) settings.ttsSettings.model = updateData.ttsSettings.model;
            if (updateData.ttsSettings.voice) settings.ttsSettings.voice = updateData.ttsSettings.voice;
            if (updateData.ttsSettings.speed !== undefined) settings.ttsSettings.speed = updateData.ttsSettings.speed;
            if (updateData.ttsSettings.responseFormat) settings.ttsSettings.responseFormat = updateData.ttsSettings.responseFormat;
            if (updateData.ttsSettings.voiceStyle) settings.ttsSettings.voiceStyle = updateData.ttsSettings.voiceStyle;
            if (updateData.ttsSettings.customInstructions !== undefined) settings.ttsSettings.customInstructions = updateData.ttsSettings.customInstructions;
        }

        // ОНОВЛЕНО: Update general settings з підтримкою сортування
        if (updateData.generalSettings) {
            if (updateData.generalSettings.cacheAudio !== undefined) settings.generalSettings.cacheAudio = updateData.generalSettings.cacheAudio;
            if (updateData.generalSettings.defaultEnglishLevel) settings.generalSettings.defaultEnglishLevel = updateData.generalSettings.defaultEnglishLevel;

            // ДОДАНО: Оновлення налаштувань сортування категорій
            if (updateData.generalSettings.categorySortBy !== undefined) {
                const validCategorySortBy = ["date", "alphabet", "flashcards", "progress"];
                if (validCategorySortBy.includes(updateData.generalSettings.categorySortBy)) {
                    settings.generalSettings.categorySortBy = updateData.generalSettings.categorySortBy;
                }
            }

            if (updateData.generalSettings.categorySortOrder !== undefined) {
                const validSortOrder = ["asc", "desc"];
                if (validSortOrder.includes(updateData.generalSettings.categorySortOrder)) {
                    settings.generalSettings.categorySortOrder = updateData.generalSettings.categorySortOrder;
                }
            }

            // ДОДАНО: Оновлення налаштувань сортування карток
            if (updateData.generalSettings.flashcardSortBy !== undefined) {
                const validFlashcardSortBy = ["date", "alphabet", "progress", "status"];
                if (validFlashcardSortBy.includes(updateData.generalSettings.flashcardSortBy)) {
                    settings.generalSettings.flashcardSortBy = updateData.generalSettings.flashcardSortBy;
                }
            }

            if (updateData.generalSettings.flashcardSortOrder !== undefined) {
                const validSortOrder = ["asc", "desc"];
                if (validSortOrder.includes(updateData.generalSettings.flashcardSortOrder)) {
                    settings.generalSettings.flashcardSortOrder = updateData.generalSettings.flashcardSortOrder;
                }
            }
        }

        // Update AI settings
        if (updateData.aiSettings) {
            if (!settings.aiSettings) settings.aiSettings = {};
            if (updateData.aiSettings.chatgptModel) settings.aiSettings.chatgptModel = updateData.aiSettings.chatgptModel;
        }

        // Auto-save immediately
        await settings.save();

        // Повертаємо оновлені налаштування без API ключа
        const settingsObj = settings.toObject();
        const apiKeyInfo = settings.getApiKeyInfo();

        delete settingsObj.userApiKey;
        settingsObj.apiKeyInfo = apiKeyInfo;

        return res.status(200).json(settingsObj);
    } catch (error) {
        console.log("Error in updateUserSettings controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

const resetUserSettings = async (req, res) => {
    try {
        const userId = req.user._id;

        await UserSettings.findOneAndDelete({ userId });

        // ОНОВЛЕНО: Create new default settings з підтримкою сортування
        const defaultSettings = new UserSettings({
            userId,
            apiKeySource: "system",
            userApiKey: null,
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
                // ДОДАНО: Налаштування сортування за замовчуванням
                categorySortBy: "date",
                categorySortOrder: "desc",
                flashcardSortBy: "date",
                flashcardSortOrder: "desc"
            },
            aiSettings: {
                chatgptModel: "gpt-4.1-mini"
            }
        });
        await defaultSettings.save();

        // Повертаємо налаштування без API ключа
        const settingsObj = defaultSettings.toObject();
        const apiKeyInfo = defaultSettings.getApiKeyInfo();

        delete settingsObj.userApiKey;
        settingsObj.apiKeyInfo = apiKeyInfo;

        return res.status(200).json(settingsObj);
    } catch (error) {
        console.log("Error in resetUserSettings controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// ОНОВЛЕНО: Додано нові опції для сортування
const getAvailableOptions = async (req, res) => {
    try {
        return res.status(200).json({
            models: [
                { id: "tts-1", name: "TTS-1 (Standard)", description: "Fast, good quality" },
                { id: "tts-1-hd", name: "TTS-1 HD", description: "Higher quality, slower" },
                { id: "gpt-4o-mini-tts", name: "GPT-4o Mini TTS", description: "Advanced model with custom instructions" }
            ],
            voices: [
                { id: "alloy", name: "Alloy", description: "Neutral, versatile" },
                { id: "ash", name: "Ash", description: "Clear, professional" },
                { id: "coral", name: "Coral", description: "Warm, friendly" },
                { id: "echo", name: "Echo", description: "Deep, resonant" },
                { id: "fable", name: "Fable", description: "Expressive, storytelling" },
                { id: "onyx", name: "Onyx", description: "Strong, confident" },
                { id: "nova", name: "Nova", description: "Bright, energetic" },
                { id: "sage", name: "Sage", description: "Wise, calm" },
                { id: "shimmer", name: "Shimmer", description: "Gentle, soothing" }
            ],
            voiceStyles: [
                { id: "neutral", name: "Нейтральний", description: "Природна та чітка вимова" },
                { id: "formal", name: "Офіційний", description: "Професійний та авторитетний" },
                { id: "calm", name: "Спокійний", description: "Заспокійливий та впевнений" },
                { id: "dramatic", name: "Драматичний", description: "Напружений та інтригуючий" },
                { id: "educational", name: "Навчальний", description: "Чіткий та зрозумілий для навчання" }
            ],
            responseFormats: [
                { id: "mp3", name: "MP3", description: "Standard quality, widely supported" },
                { id: "opus", name: "Opus", description: "Good compression, modern format" },
                { id: "aac", name: "AAC", description: "High quality, Apple preferred" },
                { id: "flac", name: "FLAC", description: "Lossless quality, large files" }
            ],
            englishLevels: [
                { id: "A1", name: "A1 - Початковий", description: "Базові слова та фрази" },
                { id: "A2", name: "A2 - Елементарний", description: "Прості повсякденні вирази" },
                { id: "B1", name: "B1 - Середній", description: "Спілкування на знайомі теми" },
                { id: "B2", name: "B2 - Вище середнього", description: "Вільне спілкування з носіями" },
                { id: "C1", name: "C1 - Просунутий", description: "Складні тексти та абстрактні теми" },
                { id: "C2", name: "C2 - Вільне володіння", description: "Майже як носій мови" }
            ],
            chatgptModels: [
                { id: "gpt-4.1", name: "GPT-4.1", description: "Найпотужніша модель, найкраща якість результатів" },
                { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Оптимальне співвідношення якості та вартості (рекомендовано)" },
                { id: "gpt-4o", name: "GPT-4o", description: "Швидка та ефективна модель з хорошою якістю" }
            ],
            apiKeySources: [
                { id: "system", name: "Системний ключ", description: "Використовувати системний API ключ (за замовчуванням)" },
                { id: "user", name: "Особистий ключ", description: "Використовувати ваш власний OpenAI API ключ" }
            ],
            // ДОДАНО: Опції сортування
            categorySortOptions: [
                { id: "date", name: "За датою створення", description: "Сортування за датою створення категорії" },
                { id: "alphabet", name: "За алфавітом", description: "Сортування за назвою категорії" },
                { id: "flashcards", name: "За кількістю карток", description: "Сортування за кількістю карток в категорії" },
                { id: "progress", name: "За прогресом", description: "Сортування за відсотком завершення" }
            ],
            flashcardSortOptions: [
                { id: "date", name: "За датою створення", description: "Сортування за датою створення картки" },
                { id: "alphabet", name: "За алфавітом", description: "Сортування за текстом картки" },
                { id: "progress", name: "За прогресом", description: "Сортування за прогресом вивчення" },
                { id: "status", name: "За статусом", description: "Сортування за статусом (вивчення/повторення)" }
            ],
            sortOrderOptions: [
                { id: "asc", name: "За зростанням", description: "Від меншого до більшого" },
                { id: "desc", name: "За спаданням", description: "Від більшого до меншого" }
            ]
        });
    } catch (error) {
        console.log("Error in getAvailableOptions controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// Тестування API ключа
const testApiKey = async (req, res) => {
    try {
        const { apiKey } = req.body;

        if (!apiKey || !apiKey.trim()) {
            return res.status(400).json({
                success: false,
                message: "API ключ не вказано"
            });
        }

        // Базова перевірка формату
        if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
            return res.status(400).json({
                success: false,
                message: "Неправильний формат API ключа"
            });
        }

        // Тут можна додати реальний тест API ключа через OpenAI
        // Поки що просто перевіряємо формат

        return res.status(200).json({
            success: true,
            message: "API ключ має правильний формат",
            details: "Ключ буде перевірено при першому використанні"
        });
    } catch (error) {
        console.log("Error in testApiKey controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// Видалення користувацького API ключа
const clearUserApiKey = async (req, res) => {
    try {
        const userId = req.user._id;

        let settings = await UserSettings.findOne({ userId });

        if (!settings) {
            return res.status(404).json({ message: "Налаштування не знайдено" });
        }

        settings.clearUserApiKey();
        await settings.save();

        const settingsObj = settings.toObject();
        const apiKeyInfo = settings.getApiKeyInfo();

        delete settingsObj.userApiKey;
        settingsObj.apiKeyInfo = apiKeyInfo;

        return res.status(200).json({
            success: true,
            message: "Особистий API ключ видалено",
            settings: settingsObj
        });
    } catch (error) {
        console.log("Error in clearUserApiKey controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// ДОДАНО: Отримання статистики налаштувань
const getSettingsStats = async (req, res) => {
    try {
        const userId = req.user._id;

        const settings = await UserSettings.findOne({ userId });

        if (!settings) {
            return res.status(404).json({ message: "Налаштування не знайдено" });
        }

        const stats = {
            hasCustomTTSSettings: settings.ttsSettings?.model !== "tts-1" ||
                settings.ttsSettings?.voice !== "alloy" ||
                settings.ttsSettings?.speed !== 1.0,
            hasCustomSortingSettings: settings.generalSettings?.categorySortBy !== "date" ||
                settings.generalSettings?.categorySortOrder !== "desc" ||
                settings.generalSettings?.flashcardSortBy !== "date" ||
                settings.generalSettings?.flashcardSortOrder !== "desc",
            hasUserApiKey: !!settings.userApiKey,
            englishLevel: settings.generalSettings?.defaultEnglishLevel || "B1",
            sortingPreferences: {
                categories: {
                    sortBy: settings.generalSettings?.categorySortBy || "date",
                    sortOrder: settings.generalSettings?.categorySortOrder || "desc"
                },
                flashcards: {
                    sortBy: settings.generalSettings?.flashcardSortBy || "date",
                    sortOrder: settings.generalSettings?.flashcardSortOrder || "desc"
                }
            }
        };

        return res.status(200).json(stats);
    } catch (error) {
        console.log("Error in getSettingsStats controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// ДОДАНО: Масове оновлення налаштувань сортування для всіх користувачів (міграція)
const migrateAllUsersSettings = async (req, res) => {
    try {
        // Цей endpoint має бути доступний тільки адміністраторам
        // В реальному додатку тут має бути перевірка ролей

        const usersToUpdate = await UserSettings.find({
            $or: [
                { 'generalSettings.categorySortBy': { $exists: false } },
                { 'generalSettings.categorySortOrder': { $exists: false } },
                { 'generalSettings.flashcardSortBy': { $exists: false } },
                { 'generalSettings.flashcardSortOrder': { $exists: false } }
            ]
        });

        let updatedCount = 0;

        for (const settings of usersToUpdate) {
            let needsUpdate = false;

            if (!settings.generalSettings) {
                settings.generalSettings = {};
                needsUpdate = true;
            }

            if (!settings.generalSettings.categorySortBy) {
                settings.generalSettings.categorySortBy = "date";
                needsUpdate = true;
            }

            if (!settings.generalSettings.categorySortOrder) {
                settings.generalSettings.categorySortOrder = "desc";
                needsUpdate = true;
            }

            if (!settings.generalSettings.flashcardSortBy) {
                settings.generalSettings.flashcardSortBy = "date";
                needsUpdate = true;
            }

            if (!settings.generalSettings.flashcardSortOrder) {
                settings.generalSettings.flashcardSortOrder = "desc";
                needsUpdate = true;
            }

            if (needsUpdate) {
                await settings.save();
                updatedCount++;
            }
        }

        return res.status(200).json({
            success: true,
            message: `Міграція завершена. Оновлено ${updatedCount} користувачів.`,
            details: {
                totalFound: usersToUpdate.length,
                updated: updatedCount
            }
        });
    } catch (error) {
        console.log("Error in migrateAllUsersSettings controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export default {
    getUserSettings,
    updateUserSettings,
    resetUserSettings,
    getAvailableOptions,
    testApiKey,
    clearUserApiKey,
    getSettingsStats,      // ДОДАНО
    migrateAllUsersSettings // ДОДАНО (для адміністрування)
};