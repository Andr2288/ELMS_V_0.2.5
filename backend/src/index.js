// backend/src/index.js - ОНОВЛЕНО З ІНФОРМАЦІЄЮ ПРО ОПТИМІЗАЦІЮ ЗАВАНТАЖЕННЯ

import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

// Rate limiting middleware
import {
    generalLimiter,
    openaiLimiter,
    ttsLimiter,
    authLimiter,
    slowDownMiddleware,
    rateLimitLogger,
    dynamicLimiter,
    internalServiceBypass,
    conditionalLimiter
} from "./middleware/rateLimiting.middleware.js";

import authRoutes from "./routes/auth.route.js";
import flashcardRoutes from "./routes/flashcard.route.js";
import categoryRoutes from "./routes/category.route.js";
import ttsRoutes from "./routes/tts.route.js";
import userSettingsRoutes from "./routes/userSettings.route.js";
import openaiRoutes from "./routes/openai.route.js";
import database from "./lib/db.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Enhanced logging function
const logger = {
    log: (message, data = null) => {
        if (NODE_ENV === 'development') {
            console.log(`[${new Date().toISOString()}] ${message}`, data || '');
        }
    },
    warn: (message, data = null) => {
        console.warn(`[${new Date().toISOString()}] WARNING: ${message}`, data || '');
    },
    error: (message, data = null) => {
        console.error(`[${new Date().toISOString()}] ERROR: ${message}`, data || '');
    },
    info: (message, data = null) => {
        console.log(`[${new Date().toISOString()}] INFO: ${message}`, data || '');
    }
};

// Enhanced logging for environment
logger.info("Starting application with environment check:");
logger.log("- NODE_ENV:", NODE_ENV);
logger.log("- PORT:", PORT);
logger.log("- MONGODB_URI:", process.env.MONGODB_URI ? "Set" : "Not set");
logger.log("- OPENAI_API_KEY:", process.env.OPENAI_API_KEY ?
    `System key set (starts with: ${process.env.OPENAI_API_KEY.substring(0, 10)}...)` : "Not set");
logger.log("- JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "Not set");

// Security middleware (should be first)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.openai.com"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    threshold: 1024
}));

// Internal service bypass (перед rate limiting)
app.use(internalServiceBypass);

// Rate limiting logger
app.use(rateLimitLogger);

// General rate limiting з slow down
app.use(conditionalLimiter(slowDownMiddleware));
app.use(conditionalLimiter(generalLimiter));

// Basic middleware
app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (error) {
            logger.error("Invalid JSON in request body", {
                ip: req.ip,
                path: req.path,
                error: error.message
            });
            const err = new Error('Invalid JSON');
            err.status = 400;
            throw err;
        }
    }
}));

app.use(cookieParser());

// Enhanced CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000"
        ];

        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // В production додати реальні домени
        if (NODE_ENV === 'production') {
            // const productionOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
            // if (productionOrigins.includes(origin)) {
            //     return callback(null, true);
            // }
        }

        logger.warn("CORS: Blocked request from origin", { origin, ip: req?.ip });
        const msg = `CORS policy: Origin ${origin} is not allowed`;
        return callback(new Error(msg), false);
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-internal-token',
        'Cache-Control',
        'Pragma',
        'X-Requested-With',
        'Accept',
        'Origin'
    ]
};

app.use(cors(corsOptions));

// Request logging middleware (для development)
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            const logData = {
                method: req.method,
                path: req.path,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
                userAgent: req.get('User-Agent')?.substring(0, 100)
            };

            if (duration > 5000) {
                logger.warn("Slow request detected", logData);
            } else if (res.statusCode >= 400) {
                logger.warn("Request error", logData);
            } else {
                logger.log("Request completed", logData);
            }
        });

        next();
    });
}

// Routes з specific rate limiting
app.use("/api/auth", conditionalLimiter(authLimiter), authRoutes);
app.use("/api/flashcards", flashcardRoutes); // ПІДТРИМУЄ ВСІ ТИПИ ВПРАВ + ОПТИМІЗАЦІЮ
app.use("/api/categories", categoryRoutes);
app.use("/api/tts", conditionalLimiter(ttsLimiter), ttsRoutes);
app.use("/api/settings", userSettingsRoutes);
app.use("/api/openai", conditionalLimiter(openaiLimiter), openaiRoutes);

// ОНОВЛЕНО: Enhanced health check endpoint з інформацією про оптимізацію
app.get("/api/health", (req, res) => {
    const healthCheck = {
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        version: "5.0.0", // ОНОВЛЕНО: нова версія з оптимізацією завантаження
        features: {
            mongodb: process.env.MONGODB_URI ? "configured" : "not configured",
            system_openai: process.env.OPENAI_API_KEY ? "configured" : "not configured",
            jwt: process.env.JWT_SECRET ? "configured" : "not configured",
            user_settings: "enabled",
            ai_flashcards: "enabled",
            learning_system: "enabled", // Повна система навчання
            core_exercises: "enabled", // sentence-completion, multiple-choice, listen-and-fill, listen-and-choose
            additional_exercises: "enabled", // dialog, reading-comprehension
            flashcard_migration: "enabled", // Підтримка міграції карток
            rate_limiting: "enabled",
            security_headers: "enabled",
            // ДОДАНО: Нові функції оптимізації
            instant_loading: "enabled", // ⚡ Миттєве завантаження для core вправ
            exercise_caching: "enabled", // 🎯 Кешування списку вправ на frontend
            smart_prioritization: "enabled", // 🧠 Розумна пріоритизація learning/review карток
            optimized_randomization: "enabled" // 🎲 Оптимізована рандомізація
        },
        exercise_types: {
            core: [
                "sentence-completion",
                "multiple-choice",
                "listen-and-fill",
                "listen-and-choose"
            ], // ⚡ Миттєве завантаження
            additional: [
                "dialog",
                "reading-comprehension"
            ], // 🌐 Мережеве завантаження
            total_supported: 6
        },
        performance: {
            // ДОДАНО: Інформація про продуктивність
            instant_exercises: "4 types", // Core вправи завантажуються миттєво
            network_exercises: "2 types", // Advanced вправи використовують мережу
            loading_modes: {
                instant: "⚡ <100ms - core exercises from frontend cache",
                network: "🌐 ~2-5s - advanced exercises from backend API"
            },
            optimization_strategy: "Frontend pre-generation + smart prioritization"
        },
        system: {
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
            }
        }
    };

    res.status(200).json(healthCheck);
});

// Metrics endpoint (для моніторингу)
app.get("/api/metrics", (req, res) => {
    const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        activeConnections: req.socket.server._connections || 0
    };

    res.status(200).json(metrics);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close((err) => {
        if (err) {
            logger.error('Error during server shutdown', err);
            process.exit(1);
        }

        logger.info('HTTP server closed.');

        // Close database connection
        database.disconnect?.()
            .then(() => {
                logger.info('Database connection closed.');
                process.exit(0);
            })
            .catch((err) => {
                logger.error('Error closing database connection', err);
                process.exit(1);
            });
    });

    // Force close after 30 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

// Enhanced error handler з proper logging
app.use((err, req, res, next) => {
    const errorDetails = {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    };

    // Log всі помилки
    logger.error("Unhandled error", errorDetails);

    // Don't leak error details in production
    if (NODE_ENV === 'production') {
        res.status(err.status || 500).json({
            message: "Internal Server Error",
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(err.status || 500).json({
            message: err.message,
            stack: err.stack,
            path: req.path,
            timestamp: new Date().toISOString()
        });
    }
});

// Enhanced 404 handler
app.use((req, res) => {
    logger.warn("404 - Route not found", {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    res.status(404).json({
        message: "Route not found",
        path: req.path,
        timestamp: new Date().toISOString()
    });
});

// Process error handlers
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`Express server listening on port ${PORT}`);
    logger.info(`Health check available at: http://localhost:${PORT}/api/health`);
    logger.info(`Metrics available at: http://localhost:${PORT}/api/metrics`);
    logger.info("🚀 ОПТИМІЗОВАНА СИСТЕМА НАВЧАННЯ ЗАПУЩЕНА:");
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // ДОДАНО: Інформація про нові функції оптимізації
    logger.info("⚡ МИТТЄВЕ ЗАВАНТАЖЕННЯ:");
    logger.info("  ✓ Основні вправи: <100ms (frontend cache)");
    logger.info("  ✓ Швидка розминка: миттєво");
    logger.info("  ✓ Інтенсивний режим: миттєво");
    logger.info("  ✓ Марафон знань: миттєво");
    logger.info("  ✓ Міксована практика: миттєво");

    logger.info("🧠 РОЗУМНА СИСТЕМА:");
    logger.info("  ✓ Пріоритизація: Learning > Review");
    logger.info("  ✓ Автоматична генерація списків вправ");
    logger.info("  ✓ Оптимізована рандомізація");

    logger.info("🌐 МЕРЕЖЕВІ ВПРАВИ:");
    logger.info("  ✓ Reading Comprehension: ~2-5s");
    logger.info("  ✓ Інтерактивний діалог: ~2-5s");

    logger.info("📊 ПІДТРИМУВАНІ ФУНКЦІЇ:");
    logger.info("- Security headers (Helmet)");
    logger.info("- Response compression");
    logger.info("- Advanced rate limiting");
    logger.info("- Request/Error logging");
    logger.info("- Graceful shutdown handling");
    logger.info("- User settings management");
    logger.info("- Personal OpenAI API keys");
    logger.info("- Advanced TTS configuration");
    logger.info("- AI-powered flashcard generation");

    logger.info("🎯 СИСТЕМА ВПРАВ (6 типів):");
    logger.info("  ⚡ Основні (миттєве завантаження):");
    logger.info("    • sentence-completion");
    logger.info("    • multiple-choice");
    logger.info("    • listen-and-fill");
    logger.info("    • listen-and-choose");
    logger.info("  🌐 Додаткові (мережеве завантаження):");
    logger.info("    • dialog");
    logger.info("    • reading-comprehension");

    logger.info("- Flashcard migration to latest version");
    logger.info("- Performance monitoring");
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    database.connectDB();
});

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));