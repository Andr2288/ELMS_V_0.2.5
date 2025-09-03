// backend/src/middleware/rateLimiting.middleware.js - ВИПРАВЛЕНА ВЕРСІЯ
// ВИПРАВЛЕНО: Правильне отримання IP + оптимізація пам'яті

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// ДОДАНО: Безпечна функція для отримання IP адреси
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    const cloudflareIp = req.headers['cf-connecting-ip'];

    // Пріоритет: CloudFlare > X-Real-IP > X-Forwarded-For > req.ip
    let ip = cloudflareIp ||
        realIp ||
        (forwarded ? forwarded.split(',')[0].trim() : null) ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        'unknown';

    // Видаляємо IPv6 mapped IPv4 префікс
    ip = ip.replace(/^::ffff:/, '');

    // Валідація IP адреси
    if (ip === 'unknown' || !ip) {
        return 'fallback-ip';
    }

    return ip;
};

// ДОДАНО: Helper для безпечного отримання IP (підтримка IPv6)
const safeKeyGenerator = (req) => {
    // Використовуємо userId якщо є, інакше безпечний IP
    if (req.user?.id) {
        return `user:${req.user.id}`;
    }

    return getClientIp(req);
};

// ВИПРАВЛЕНО: Основний rate limiter з IPv6 підтримкою
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 1000, // Максимум 1000 запитів на IP за 15 хвилин
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // ВИПРАВЛЕНО: Безпечний keyGenerator з IPv6 підтримкою
    keyGenerator: safeKeyGenerator,
    // Пропускаємо rate limiting для health check
    skip: (req) => {
        return req.path === '/api/health';
    },
    // ДОДАНО: Відключаємо попередження
    validate: {
        keyGeneratorIpFallback: false
    }
});

// ВИПРАВЛЕНО: Strict rate limiter для OpenAI запитів
export const openaiLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 хвилин
    max: 50, // Максимум 50 OpenAI запитів на користувача за 5 хвилин
    message: {
        error: 'Too many AI requests, please slow down.',
        details: 'AI generation has rate limits to prevent abuse.',
        retryAfter: '5 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // ВИПРАВЛЕНО: Безпечний keyGenerator
    keyGenerator: safeKeyGenerator,
    validate: {
        keyGeneratorIpFallback: false
    }
});

// ВИПРАВЛЕНО: TTS specific rate limiter
export const ttsLimiter = rateLimit({
    windowMs: 2 * 60 * 1000, // 2 хвилини
    max: 30, // Максимум 30 TTS запитів на користувача за 2 хвилини
    message: {
        error: 'Too many TTS requests, please slow down.',
        details: 'Text-to-speech has rate limits to prevent abuse.',
        retryAfter: '2 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // ВИПРАВЛЕНО: Безпечний keyGenerator
    keyGenerator: safeKeyGenerator,
    validate: {
        keyGeneratorIpFallback: false
    }
});

// ВИПРАВЛЕНО: Auth specific rate limiter
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 10, // Максимум 10 спроб логіну за 15 хвилин
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // ВИПРАВЛЕНО: Тільки IP для auth (з IPv6 підтримкою)
    keyGenerator: (req) => getClientIp(req),
    validate: {
        keyGeneratorIpFallback: false
    }
});

// ВИПРАВЛЕНО: Slow down middleware з новим delayMs синтаксисом
export const slowDownMiddleware = slowDown({
    windowMs: 2 * 60 * 1000, // 2 хвилини
    delayAfter: 20, // Після 20 запитів почати уповільнення
    // ВИПРАВЛЕНО: Новий синтаксис для express-slow-down v2
    delayMs: () => 100, // Постійна затримка 100мс
    maxDelayMs: 2000, // Максимальна затримка 2 секунди
    // ВИПРАВЛЕНО: Безпечний keyGenerator
    keyGenerator: safeKeyGenerator,
    // ДОДАНО: Відключаємо попередження
    validate: {
        delayMs: false,
        keyGeneratorIpFallback: false
    }
});

// ДОДАНО: Альтернативний slow down з прогресивною затримкою
export const progressiveSlowDown = slowDown({
    windowMs: 2 * 60 * 1000,
    delayAfter: 10,
    // ВИПРАВЛЕНО: Прогресивна затримка (нова версія)
    delayMs: (used, req) => {
        const delayAfter = req.slowDown.limit;
        return (used - delayAfter) * 100; // Збільшуємо на 100мс кожен запит
    },
    maxDelayMs: 3000,
    keyGenerator: safeKeyGenerator,
    validate: {
        delayMs: false,
        keyGeneratorIpFallback: false
    }
});

// Middleware для логування rate limit hits
export const rateLimitLogger = (req, res, next) => {
    const originalSend = res.send;

    res.send = function(data) {
        // Логуємо якщо response містить rate limit помилку
        if (res.statusCode === 429) {
            console.warn(`Rate limit exceeded:`, {
                ip: req.ip,
                userId: req.user?.id,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
        }

        return originalSend.call(this, data);
    };

    next();
};

// ВИПРАВЛЕНО: Dynamic rate limiting з безпечним keyGenerator
class DynamicRateLimiter {
    constructor() {
        this.cpuThreshold = 80;
        this.memoryThreshold = 85;
        this.currentLoad = 0;
        this.baseMax = 1000;

        // Моніторинг навантаження кожні 30 секунд
        setInterval(() => {
            this.updateSystemLoad();
        }, 30000);
    }

    updateSystemLoad() {
        try {
            const memUsage = process.memoryUsage();
            const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            this.currentLoad = memPercent;

            // ДОДАНО: Логування тільки при високому навантаженні
            if (memPercent > 70) {
                console.warn(`⚠️  High memory usage: ${memPercent.toFixed(1)}%`);

                // ДОДАНО: Форсуємо garbage collection при дуже високому навантаженні
                if (memPercent > 90 && global.gc) {
                    console.warn('🧹 Running garbage collection...');
                    global.gc();
                }
            }
        } catch (error) {
            console.error('Error checking system load:', error);
        }
    }

    getAdjustedLimit() {
        // ПОКРАЩЕНО: Більш агресивне обмеження при високому навантаженні
        if (this.currentLoad > 95) {
            return Math.floor(this.baseMax * 0.1); // Критично - тільки 10%
        } else if (this.currentLoad > this.memoryThreshold) {
            return Math.floor(this.baseMax * 0.2); // Дуже високо - 20%
        } else if (this.currentLoad > this.cpuThreshold) {
            return Math.floor(this.baseMax * 0.5); // Високо - 50%
        } else if (this.currentLoad > 60) {
            return Math.floor(this.baseMax * 0.8); // Помірно - 80%
        }
        return this.baseMax;
    }

    middleware() {
        return rateLimit({
            windowMs: 15 * 60 * 1000,
            max: (req) => this.getAdjustedLimit(),
            message: {
                error: 'Server is under high load, please try again later.',
                retryAfter: '15 minutes'
            },
            // ВИПРАВЛЕНО: Безпечний keyGenerator
            keyGenerator: safeKeyGenerator,
            validate: {
                keyGeneratorIpFallback: false
            }
        });
    }
}

// Instance динамічного rate limiter
export const dynamicLimiter = new DynamicRateLimiter();

// Middleware для bypass rate limiting для внутрішніх сервісів
export const internalServiceBypass = (req, res, next) => {
    const internalToken = req.headers['x-internal-token'];
    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

    if (internalToken && expectedToken && internalToken === expectedToken) {
        req.bypassRateLimit = true;
    }

    next();
};

// Conditional rate limiter що поважає bypass
export const conditionalLimiter = (limiter) => {
    return (req, res, next) => {
        if (req.bypassRateLimit) {
            return next();
        }
        return limiter(req, res, next);
    };
};

// ДОДАНО: Аварійний middleware при критичному навантаженні пам'яті
export const emergencyMemoryProtection = (req, res, next) => {
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (memPercent > 95) {
        console.error(`🚨 CRITICAL: Memory at ${memPercent.toFixed(1)}% - Rejecting request`);
        return res.status(503).json({
            error: 'Server temporarily unavailable due to high memory usage',
            retryAfter: '30 seconds'
        });
    }

    next();
};

// ДОДАНО: Комплексний rate limiter для різних endpoints
export const createEndpointLimiter = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000,
        max = 100,
        message = 'Too many requests',
        skipSuccessfulRequests = false,
        skipFailedRequests = false
    } = options;

    return rateLimit({
        windowMs,
        max,
        message: {
            error: message,
            retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: safeKeyGenerator,
        skipSuccessfulRequests,
        skipFailedRequests,
        validate: {
            keyGeneratorIpFallback: false
        }
    });
};

// ДОДАНО: Експорт всіх лімітерів разом
export const rateLimiters = {
    general: generalLimiter,
    openai: openaiLimiter,
    tts: ttsLimiter,
    auth: authLimiter,
    slowDown: slowDownMiddleware,
    progressiveSlowDown,
    dynamic: dynamicLimiter.middleware(),
    createCustom: createEndpointLimiter
};

export default {
    generalLimiter,
    openaiLimiter,
    ttsLimiter,
    authLimiter,
    slowDownMiddleware,
    progressiveSlowDown,
    rateLimitLogger,
    dynamicLimiter,
    internalServiceBypass,
    conditionalLimiter,
    createEndpointLimiter,
    emergencyMemoryProtection, // ДОДАНО
    rateLimiters,
    getClientIp // ДОДАНО: Корисна функція для експорту
};