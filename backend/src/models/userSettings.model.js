// backend/src/models/userSettings.model.js - ДОДАНО СОРТУВАННЯ

import mongoose from "mongoose";

const userSettingsSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // API Key Management
        apiKeySource: {
            type: String,
            enum: ["system", "user"],
            default: "system",
        },
        userApiKey: {
            type: String,
            default: null,
        },

        // TTS Settings
        ttsSettings: {
            model: {
                type: String,
                default: "tts-1",
                enum: ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"],
            },
            voice: {
                type: String,
                default: "alloy",
                enum: ["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"],
            },
            speed: {
                type: Number,
                default: 1.0,
                min: 0.25,
                max: 4.0,
            },
            responseFormat: {
                type: String,
                default: "mp3",
                enum: ["mp3", "opus", "aac", "flac"],
            },
            voiceStyle: {
                type: String,
                default: "neutral",
                enum: ["neutral", "formal", "calm", "dramatic", "educational"],
            },
            customInstructions: {
                type: String,
                default: "",
                maxlength: 500,
            },
        },

        // General Settings
        generalSettings: {
            cacheAudio: {
                type: Boolean,
                default: true,
            },
            defaultEnglishLevel: {
                type: String,
                default: "B1",
                enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
            },
            // ДОДАНО: Налаштування сортування категорій
            categorySortBy: {
                type: String,
                default: "date",
                enum: ["date", "alphabet", "flashcards", "progress"],
            },
            categorySortOrder: {
                type: String,
                default: "desc",
                enum: ["asc", "desc"],
            },
            // ДОДАНО: Налаштування сортування карток
            flashcardSortBy: {
                type: String,
                default: "date",
                enum: ["date", "alphabet", "progress", "status"],
            },
            flashcardSortOrder: {
                type: String,
                default: "desc",
                enum: ["asc", "desc"],
            }
        },

        // AI Settings
        aiSettings: {
            chatgptModel: {
                type: String,
                default: "gpt-4.1-mini",
                enum: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o"],
            },
        }
    },
    {
        timestamps: true,
    }
);

// Index for performance
userSettingsSchema.index({ userId: 1 });

// ДОДАНО: Метод для отримання ефективного API ключа
userSettingsSchema.methods.getEffectiveApiKey = function() {
    if (this.apiKeySource === "user" && this.userApiKey) {
        return this.userApiKey;
    }
    return process.env.OPENAI_API_KEY || null;
};

// ДОДАНО: Метод для отримання інформації про API ключ
userSettingsSchema.methods.getApiKeyInfo = function() {
    const hasUserKey = !!(this.userApiKey && this.userApiKey.trim());
    const hasSystemKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

    let effectiveSource = "system";
    let available = [];

    if (hasSystemKey) {
        available.push("system");
    }

    if (hasUserKey) {
        available.push("user");
        if (this.apiKeySource === "user") {
            effectiveSource = "user";
        }
    }

    if (!hasSystemKey && !hasUserKey) {
        effectiveSource = "none";
    }
    else if (this.apiKeySource === "user" && !hasUserKey) {
        effectiveSource = "system";
    }

    return {
        effectiveSource,
        available,
        hasUserKey,
        hasSystemKey,
        selectedSource: this.apiKeySource
    };
};

// ДОДАНО: Метод для встановлення користувацького API ключа
userSettingsSchema.methods.setUserApiKey = function(apiKey) {
    if (apiKey && apiKey.trim()) {
        this.userApiKey = apiKey.trim();
        this.apiKeySource = "user";
    } else {
        this.userApiKey = null;
        this.apiKeySource = "system";
    }
};

// ДОДАНО: Метод для видалення користувацького API ключа
userSettingsSchema.methods.clearUserApiKey = function() {
    this.userApiKey = null;
    this.apiKeySource = "system";
};

// ДОДАНО: Метод для перевірки валідності API ключа
userSettingsSchema.methods.isApiKeyValid = function(apiKey = null) {
    const keyToCheck = apiKey || this.getEffectiveApiKey();

    if (!keyToCheck) {
        return false;
    }

    return keyToCheck.startsWith('sk-') && keyToCheck.length > 20;
};

// ДОДАНО: Методи для роботи з сортуванням
userSettingsSchema.methods.getCategorySortSettings = function() {
    return {
        sortBy: this.generalSettings?.categorySortBy || "date",
        sortOrder: this.generalSettings?.categorySortOrder || "desc"
    };
};

userSettingsSchema.methods.getFlashcardSortSettings = function() {
    return {
        sortBy: this.generalSettings?.flashcardSortBy || "date",
        sortOrder: this.generalSettings?.flashcardSortOrder || "desc"
    };
};

userSettingsSchema.methods.setCategorySortSettings = function(sortBy, sortOrder) {
    if (!this.generalSettings) {
        this.generalSettings = {};
    }
    this.generalSettings.categorySortBy = sortBy;
    this.generalSettings.categorySortOrder = sortOrder;
};

userSettingsSchema.methods.setFlashcardSortSettings = function(sortBy, sortOrder) {
    if (!this.generalSettings) {
        this.generalSettings = {};
    }
    this.generalSettings.flashcardSortBy = sortBy;
    this.generalSettings.flashcardSortOrder = sortOrder;
};

// Default voice style instructions
userSettingsSchema.statics.getVoiceStyleInstructions = function(style) {
    const instructions = {
        neutral: "Speak naturally and clearly with neutral tone.",
        formal: "Voice: Clear, authoritative, and composed, projecting confidence and professionalism. Tone: Neutral and informative, maintaining a balance between formality and approachability.",
        calm: "Voice Affect: Calm, composed, and reassuring; project quiet authority and confidence. Tone: Sincere, empathetic, and gently authoritative.",
        dramatic: "Voice Affect: Low, hushed, and suspenseful; convey tension and intrigue. Tone: Deeply serious and mysterious, maintaining an undercurrent of unease.",
        educational: "Voice: Clear and engaging, suitable for learning. Pace: Moderate and well-structured for comprehension."
    };
    return instructions[style] || instructions.neutral;
};

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);
export default UserSettings;