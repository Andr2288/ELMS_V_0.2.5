// backend/src/controllers/tts.controller.js - ВИПРАВЛЕНА ВЕРСІЯ

import OpenAI from "openai";
import crypto from "crypto";
import UserSettings from "../models/userSettings.model.js";

// ОНОВЛЕНО: Memory-safe cache з автоматичним cleanup
class AudioCache {
    constructor(maxSize = 100, maxAge = 3600000) { // 1 година
        this.cache = new Map();
        this.maxSize = maxSize;
        this.maxAge = maxAge;
        this.accessTime = new Map();

        // ДОДАНО: Автоматичний cleanup кожні 10 хвилин
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 600000); // 10 хвилин
    }

    set(key, value) {
        // Очищаємо старі записи якщо потрібно
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }

        this.cache.set(key, value);
        this.accessTime.set(key, Date.now());
    }

    get(key) {
        if (this.cache.has(key)) {
            // Перевіряємо чи не застарів запис
            const accessTime = this.accessTime.get(key);
            if (Date.now() - accessTime > this.maxAge) {
                this.delete(key);
                return undefined;
            }

            // Оновлюємо час доступу
            this.accessTime.set(key, Date.now());
            return this.cache.get(key);
        }
        return undefined;
    }

    has(key) {
        return this.cache.has(key) && (Date.now() - this.accessTime.get(key)) <= this.maxAge;
    }

    delete(key) {
        this.cache.delete(key);
        this.accessTime.delete(key);
    }

    evictOldest() {
        let oldestKey = null;
        let oldestTime = Date.now();

        for (const [key, time] of this.accessTime.entries()) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.delete(oldestKey);
        }
    }

    cleanup() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, time] of this.accessTime.entries()) {
            if (now - time > this.maxAge) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.delete(key));

        if (keysToDelete.length > 0) {
            console.log(`TTS Cache: Cleaned up ${keysToDelete.length} expired entries`);
        }
    }

    clear() {
        this.cache.clear();
        this.accessTime.clear();
    }

    get size() {
        return this.cache.size;
    }

    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            maxAge: this.maxAge,
            oldestEntry: this.accessTime.size > 0 ? Math.min(...this.accessTime.values()) : null
        };
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

// ОНОВЛЕНО: Memory-safe audio cache
const audioCache = new AudioCache();

// ДОДАНО: Map для відстеження активних запитів
const activeRequests = new Map();

// ДОДАНО: Cleanup при shutdown
process.on('SIGTERM', () => {
    console.log('TTS Controller: Cleaning up before shutdown');
    audioCache.destroy();
    activeRequests.clear();
});

process.on('SIGINT', () => {
    console.log('TTS Controller: Cleaning up before shutdown');
    audioCache.destroy();
    activeRequests.clear();
});

const generateSpeech = async (req, res) => {
    let requestId = null;

    try {
        const { text, timestamp, sessionId, cardId, exercise } = req.body;
        const userId = req.user._id;

        if (!text) {
            return res.status(400).json({ message: "Text is required" });
        }

        // ДОДАНО: Встановлюємо CORS заголовки явно (якщо потрібно)
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With');

        // ДОДАНО: Унікальний ID для запиту
        requestId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[${requestId}] TTS Request - User: ${userId}, Session: ${sessionId}, Card: ${cardId}, Exercise: ${exercise}`);

        // ДОДАНО: Реєструємо активний запит
        activeRequests.set(requestId, {
            userId,
            sessionId,
            startTime: Date.now(),
            aborted: false
        });

        // Get user settings first
        let userSettings = await UserSettings.findOne({ userId });

        // Create default settings if none exist
        if (!userSettings) {
            userSettings = new UserSettings({
                userId,
                apiKeySource: "system",
                ttsSettings: {
                    model: "tts-1",
                    voice: "alloy",
                    speed: 1.0,
                    responseFormat: "mp3",
                    voiceStyle: "neutral",
                    customInstructions: ""
                }
            });
            await userSettings.save();
        }

        const effectiveApiKey = userSettings.getEffectiveApiKey();
        const apiKeyInfo = userSettings.getApiKeyInfo();

        if (!effectiveApiKey) {
            return res.status(500).json({
                message: "No OpenAI API key available",
                details: "Please configure an API key in Settings",
                apiKeyInfo
            });
        }

        console.log(`[${requestId}] TTS: Using ${apiKeyInfo.effectiveSource} API key`);

        // Validate API key format
        if (!effectiveApiKey.startsWith('sk-')) {
            return res.status(500).json({
                message: "Invalid OpenAI API key format",
                apiKeyInfo
            });
        }

        // ОНОВЛЕНО: Enhanced cache key з proper hashing
        const cacheKeyData = {
            text: text.toLowerCase().trim(),
            model: userSettings.ttsSettings.model,
            voice: userSettings.ttsSettings.voice,
            speed: Math.round(userSettings.ttsSettings.speed * 100) / 100,
            style: userSettings.ttsSettings.voiceStyle,
            custom: userSettings.ttsSettings.customInstructions,
            exercise: exercise || 'general'
        };

        const settingsHash = crypto.createHash('sha256')
            .update(JSON.stringify(cacheKeyData))
            .digest('hex')
            .substring(0, 32);

        console.log(`[${requestId}] TTS Cache Key: ${settingsHash}`);

        // ОНОВЛЕНО: Кешування тільки для загальних запитів
        const shouldUseCache = userSettings.generalSettings.cacheAudio &&
            (!exercise || exercise === 'general') &&
            audioCache.has(settingsHash);

        if (shouldUseCache) {
            console.log(`[${requestId}] Using cached audio`);
            const cachedAudio = audioCache.get(settingsHash);

            // ДОДАНО: Очищаємо запит з активних
            activeRequests.delete(requestId);

            res.set({
                'Content-Type': 'audio/mpeg',
                'Content-Length': cachedAudio.length,
                'Cache-Control': 'public, max-age=86400',
                'X-Audio-Source': 'cache',
                'X-API-Key-Source': apiKeyInfo.effectiveSource,
                'X-Session-Id': sessionId || 'no-session',
                'X-Request-Id': requestId
            });
            return res.send(cachedAudio);
        }

        // ДОДАНО: Перевіряємо чи запит не було скасовано
        const requestInfo = activeRequests.get(requestId);
        if (!requestInfo || requestInfo.aborted) {
            console.log(`[${requestId}] Request was aborted before OpenAI call`);
            return res.status(409).json({ message: "Request was cancelled" });
        }

        console.log(`[${requestId}] Generating new TTS using ${apiKeyInfo.effectiveSource} API key`);

        // ДОДАНО: AbortController для cancellation
        const abortController = new AbortController();

        // ДОДАНО: Timeout для OpenAI запиту
        const timeoutId = setTimeout(() => {
            console.log(`[${requestId}] Request timeout, aborting`);
            abortController.abort();
        }, 30000);

        // Initialize OpenAI with effective API key and timeout
        const openai = new OpenAI({
            apiKey: effectiveApiKey,
            timeout: 30000
        });

        // Prepare TTS parameters
        const ttsParams = {
            model: userSettings.ttsSettings.model,
            voice: userSettings.ttsSettings.voice,
            input: text.substring(0, 4096), // Limit text length
            response_format: userSettings.ttsSettings.responseFormat,
            speed: Math.max(0.25, Math.min(4.0, userSettings.ttsSettings.speed)) // Clamp speed
        };

        // Add custom instructions for advanced models
        if (userSettings.ttsSettings.model === "gpt-4o-mini-tts") {
            let instructions = UserSettings.getVoiceStyleInstructions(userSettings.ttsSettings.voiceStyle);

            if (userSettings.ttsSettings.customInstructions) {
                instructions += "\n\nAdditional instructions: " + userSettings.ttsSettings.customInstructions;
            }

            ttsParams.instructions = instructions;
        }

        try {
            // ОНОВЛЕНО: Generate speech з abort signal
            const mp3Response = await openai.audio.speech.create(ttsParams, {
                signal: abortController.signal
            });

            clearTimeout(timeoutId);

            // ДОДАНО: Перевіряємо чи запит ще активний
            const currentRequestInfo = activeRequests.get(requestId);
            if (!currentRequestInfo || currentRequestInfo.aborted) {
                console.log(`[${requestId}] Request was aborted during OpenAI processing`);
                return res.status(409).json({ message: "Request was cancelled" });
            }

            const buffer = Buffer.from(await mp3Response.arrayBuffer());

            console.log(`[${requestId}] TTS generated successfully. Buffer size: ${buffer.length}`);

            // ОНОВЛЕНО: Memory-safe caching
            const shouldCache = userSettings.generalSettings.cacheAudio &&
                audioCache.size < audioCache.maxSize &&
                (!exercise || exercise === 'general') &&
                buffer.length < 5 * 1024 * 1024; // Не кешуємо файли більше 5MB

            if (shouldCache) {
                audioCache.set(settingsHash, buffer);
                console.log(`[${requestId}] Audio cached. Cache size: ${audioCache.size}`);
            } else if (exercise && exercise !== 'general') {
                console.log(`[${requestId}] Not caching audio for exercise: ${exercise}`);
            }

            // ДОДАНО: Очищаємо запит з активних
            activeRequests.delete(requestId);

            res.set({
                'Content-Type': 'audio/mpeg',
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=86400',
                'X-Audio-Source': 'generated',
                'X-API-Key-Source': apiKeyInfo.effectiveSource,
                'X-TTS-Model': userSettings.ttsSettings.model,
                'X-TTS-Voice': userSettings.ttsSettings.voice,
                'X-Session-Id': sessionId || 'no-session',
                'X-Exercise': exercise || 'general',
                'X-Request-Id': requestId
            });

            return res.send(buffer);

        } catch (openaiError) {
            clearTimeout(timeoutId);

            // ДОДАНО: Обробка cancellation
            if (openaiError.name === 'AbortError') {
                console.log(`[${requestId}] OpenAI request was aborted`);
                return res.status(409).json({ message: "Request was cancelled" });
            }

            throw openaiError;
        }

    } catch (error) {
        console.log(`[${requestId}] Error in generateSpeech controller:`, error.message);

        // ДОДАНО: Очищаємо активний запит при помилці
        if (requestId) {
            activeRequests.delete(requestId);
        }

        // Enhanced error handling
        let errorResponse = {
            message: "Error generating speech",
            details: "Internal server error occurred while generating speech"
        };

        if (error.status === 401 || error.message?.includes('Incorrect API key')) {
            errorResponse = {
                message: "Invalid OpenAI API key",
                details: "API key may be expired, invalid, or have insufficient permissions",
                action: "Check your API key in Settings"
            };
        } else if (error.status === 429 || error.message?.includes('rate limit')) {
            errorResponse = {
                message: "OpenAI API rate limit exceeded",
                details: "Too many requests to OpenAI API",
                action: "Please try again later"
            };
        } else if (error.status === 402 || error.message?.includes('quota')) {
            errorResponse = {
                message: "OpenAI API quota exceeded",
                details: "Insufficient credits or billing issue",
                action: "Please check your OpenAI billing"
            };
        } else if (error.status === 400) {
            errorResponse = {
                message: "Invalid request to OpenAI API",
                details: error.message,
                action: "Check your TTS settings"
            };
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorResponse = {
                message: "Cannot connect to OpenAI API",
                details: "Network connectivity issue",
                action: "Check your internet connection"
            };
        }

        return res.status(error.status || 500).json(errorResponse);
    }
};

// Test TTS with current user settings and API key
const testTTSWithCurrentSettings = async (req, res) => {
    try {
        const userId = req.user._id;

        const userSettings = await UserSettings.findOne({ userId });
        if (!userSettings) {
            return res.status(400).json({
                success: false,
                message: "User settings not found",
                details: "Please configure your settings first"
            });
        }

        const effectiveApiKey = userSettings.getEffectiveApiKey();
        const apiKeyInfo = userSettings.getApiKeyInfo();

        if (!effectiveApiKey) {
            return res.status(400).json({
                success: false,
                message: "No API key available",
                details: "Configure a user or system API key",
                apiKeyInfo
            });
        }

        console.log("Testing TTS with current settings...");

        const openai = new OpenAI({
            apiKey: effectiveApiKey,
            timeout: 15000 // Коротший timeout для тесту
        });

        // Use user's TTS settings
        const ttsParams = {
            model: userSettings.ttsSettings.model,
            voice: userSettings.ttsSettings.voice,
            input: "Test TTS functionality",
            response_format: userSettings.ttsSettings.responseFormat,
            speed: userSettings.ttsSettings.speed
        };

        const mp3 = await openai.audio.speech.create(ttsParams);
        const buffer = Buffer.from(await mp3.arrayBuffer());

        console.log("TTS test successful. Audio size:", buffer.length);

        return res.status(200).json({
            success: true,
            message: "TTS працює з поточними налаштуваннями!",
            details: `Тест успішний. Використовується ${apiKeyInfo.effectiveSource === 'user' ? 'ваш особистий' : 'системний'} ключ.`,
            audio_size: buffer.length,
            settings_used: ttsParams,
            apiKeyInfo
        });
    } catch (error) {
        console.log("TTS test failed:", error.message);

        let errorDetails = {
            success: false,
            message: "TTS test failed",
            error: error.message
        };

        if (error.status === 401) {
            errorDetails.message = "Invalid API key for TTS";
        } else if (error.status === 402) {
            errorDetails.message = "Insufficient credits for TTS";
        } else if (error.status === 429) {
            errorDetails.message = "TTS rate limit exceeded";
        }

        return res.status(error.status || 500).json(errorDetails);
    }
};

// ОНОВЛЕНО: Clear audio cache з improved statistics
const clearAudioCache = async (req, res) => {
    try {
        const cacheStats = audioCache.getStats();

        // ДОДАНО: Очищаємо також активні запити старші 5 хвилин
        const now = Date.now();
        const staleRequests = [];
        for (const [requestId, requestInfo] of activeRequests.entries()) {
            if (now - requestInfo.startTime > 300000) { // 5 хвилин
                staleRequests.push(requestId);
            }
        }

        staleRequests.forEach(requestId => {
            const requestInfo = activeRequests.get(requestId);
            if (requestInfo) {
                requestInfo.aborted = true;
            }
            activeRequests.delete(requestId);
        });

        audioCache.clear();

        console.log(`Audio cache cleared. Was holding ${cacheStats.size} entries. Cleaned up ${staleRequests.length} stale requests.`);

        return res.status(200).json({
            message: "Audio cache cleared",
            statistics: {
                cleared_entries: cacheStats.size,
                cleared_stale_requests: staleRequests.length,
                cache_stats: cacheStats
            }
        });
    } catch (error) {
        console.log("Error clearing cache:", error.message);
        return res.status(500).json({ message: "Error clearing cache" });
    }
};

// ОНОВЛЕНО: Enhanced cache statistics
const getCacheStats = async (req, res) => {
    try {
        const cacheStats = audioCache.getStats();

        // ДОДАНО: Статистика активних запитів
        const activeRequestsStats = {
            total: activeRequests.size,
            byUser: {},
            oldestRequest: null
        };

        const now = Date.now();
        let oldestTime = now;

        for (const [requestId, requestInfo] of activeRequests.entries()) {
            const userId = requestInfo.userId.toString();
            activeRequestsStats.byUser[userId] = (activeRequestsStats.byUser[userId] || 0) + 1;

            if (requestInfo.startTime < oldestTime) {
                oldestTime = requestInfo.startTime;
                activeRequestsStats.oldestRequest = {
                    id: requestId,
                    age: now - requestInfo.startTime,
                    userId: userId
                };
            }
        }

        return res.status(200).json({
            cache_statistics: cacheStats,
            active_requests: activeRequestsStats,
            memory_usage: {
                cache_entries: cacheStats.size,
                active_requests: activeRequests.size,
                estimated_memory_mb: Math.round((cacheStats.size * 50 + activeRequests.size * 1) / 1024) // Приблизна оцінка
            }
        });
    } catch (error) {
        console.log("Error getting cache stats:", error.message);
        return res.status(500).json({ message: "Error getting cache statistics" });
    }
};

// Check available models with current API key
const checkAvailableModels = async (req, res) => {
    try {
        const userId = req.user._id;
        const userSettings = await UserSettings.findOne({ userId });

        if (!userSettings) {
            return res.status(400).json({
                success: false,
                message: "User settings not found"
            });
        }

        const effectiveApiKey = userSettings.getEffectiveApiKey();
        const apiKeyInfo = userSettings.getApiKeyInfo();

        if (!effectiveApiKey) {
            return res.status(400).json({
                success: false,
                message: "No API key available",
                apiKeyInfo
            });
        }

        const openai = new OpenAI({
            apiKey: effectiveApiKey,
            timeout: 10000
        });

        const modelsResponse = await openai.models.list();

        const models = Array.isArray(modelsResponse.data)
            ? modelsResponse.data
            : (modelsResponse.data?.data || modelsResponse);

        if (!Array.isArray(models)) {
            return res.status(200).json({
                success: true,
                message: "Models retrieved but in unexpected format",
                raw_response: modelsResponse,
                apiKeyInfo
            });
        }

        const ttsModels = models.filter(model => {
            const id = typeof model === 'string' ? model : model.id;
            return id && (
                id.includes('tts') ||
                id.includes('speech') ||
                id === 'tts-1' ||
                id === 'tts-1-hd'
            );
        });

        const modelIds = models.map(m => typeof m === 'string' ? m : m.id);

        return res.status(200).json({
            success: true,
            message: "Models retrieved successfully",
            total_models: models.length,
            tts_models: ttsModels.map(m => typeof m === 'string' ? m : m.id),
            all_models: modelIds.slice(0, 10),
            apiKeyInfo
        });
    } catch (error) {
        console.log("Models check failed:", error.message);

        let errorDetails = {
            success: false,
            message: "Failed to get models",
            error: error.message
        };

        if (error.status === 401) {
            errorDetails.message = "Invalid API key for models access";
        } else if (error.status === 402) {
            errorDetails.message = "Insufficient credits for models access";
        }

        return res.status(error.status || 500).json(errorDetails);
    }
};

// ДОДАНО: Функція для скасування активних запитів користувача
const cancelUserRequests = async (req, res) => {
    try {
        const userId = req.user._id.toString();
        let cancelledCount = 0;

        for (const [requestId, requestInfo] of activeRequests.entries()) {
            if (requestInfo.userId.toString() === userId) {
                requestInfo.aborted = true;
                activeRequests.delete(requestId);
                cancelledCount++;
            }
        }

        return res.status(200).json({
            success: true,
            message: `Cancelled ${cancelledCount} active requests`,
            cancelled_requests: cancelledCount
        });
    } catch (error) {
        console.log("Error cancelling user requests:", error.message);
        return res.status(500).json({ message: "Error cancelling requests" });
    }
};

export default {
    generateSpeech,
    testTTSWithCurrentSettings,
    clearAudioCache,
    getCacheStats,
    checkAvailableModels,
    cancelUserRequests // ДОДАНО
};