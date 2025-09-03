// backend/src/controllers/openai.controller.js - ОНОВЛЕНА ВЕРСІЯ З ВИНЕСЕНИМИ ПРОМПТАМИ

import OpenAI from "openai";
import UserSettings from "../models/userSettings.model.js";
import Flashcard from "../models/flashcard.model.js";
import Category from "../models/category.model.js";
import {
    generatePrompt,
    generateRegenerateExamplesPrompt,
    getRandomTextType,
    getRandomSentenceType,
    getRandomDialogType
} from "../services/prompts.js";

// Константи для таймаутів
const OPENAI_TIMEOUT = 120000;
const MAX_RETRIES = 2;

const generateFlashcardContent = async (req, res) => {
    try {
        const { text, englishLevel, promptType, categoryId } = req.body;
        const userId = req.user._id;

        if (!text) {
            return res.status(400).json({ message: "Text is required" });
        }

        if (!englishLevel) {
            return res.status(400).json({ message: "English level is required" });
        }

        const systemApiKey = process.env.OPENAI_API_KEY;
        if (!systemApiKey) {
            return res.status(500).json({
                message: "OpenAI API key not configured",
                details: "System OpenAI API key is not available"
            });
        }

        // Отримуємо інформацію про категорію якщо вказано
        let categoryContext = "";
        if (categoryId && categoryId !== 'uncategorized' && categoryId !== 'null') {
            try {
                const category = await Category.findOne({ _id: categoryId, userId });
                if (category) {
                    categoryContext = `\n\nIMPORTANT CONTEXT: This word/phrase belongs to the topic/category "${category.name}"`;
                    if (category.description && category.description.trim()) {
                        categoryContext += ` (${category.description.trim()})`;
                    }
                    console.log(`AI Generation: Using category context - ${category.name}`);
                }
            } catch (categoryError) {
                console.warn("Could not fetch category for context:", categoryError.message);
            }
        }

        let userSettings = await UserSettings.findOne({ userId });

        if (!userSettings) {
            userSettings = new UserSettings({
                userId,
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
                    defaultEnglishLevel: "B1"
                },
                aiSettings: {
                    chatgptModel: "gpt-4.1-mini"
                }
            });
            await userSettings.save();
        }

        console.log(`AI Generation: Using system API key for user ${userId}`);

        const openai = new OpenAI({
            apiKey: systemApiKey,
            timeout: OPENAI_TIMEOUT
        });

        const modelToUse = userSettings.aiSettings?.chatgptModel || "gpt-4.1-mini";

        // Генеруємо промпт використовуючи функцію з prompts.js
        const prompt = generatePrompt(promptType, text, englishLevel, categoryContext);

        console.log(`Generating AI content for: "${text}" using system API key with model ${modelToUse}`);

        console.log('=== 🤖 OpenAI PROMPT ===');
        console.log(`📝 Prompt Type: ${promptType}`);
        console.log(`🔤 Text: "${text}"`);
        console.log(`📚 English Level: ${englishLevel}`);
        if (promptType === "readingComprehension") {
            const selectedTextType = getRandomTextType();
            console.log(`📄 Selected Text Type: ${selectedTextType}`);
        }
        if (promptType === "sentenceWithGap") {
            const selectedSentenceType = getRandomSentenceType();
            console.log(`🎤 Selected Sentence Type: ${selectedSentenceType}`);
        }
        if (promptType === "dialog") {
            const selectedDialogType = getRandomDialogType();
            console.log(`💬 Selected Dialog Type: ${selectedDialogType}`);
        }
        if (categoryContext) {
            console.log(`📁 Category Context: Used`);
        } else {
            console.log(`📁 Category Context: None`);
        }
        console.log('📋 Full Prompt:');
        console.log('---');
        console.log(prompt);
        console.log('---');
        console.log('=== END PROMPT ===\n');

        const executeOpenAIRequest = async (retryCount = 0) => {
            try {
                const abortController = new AbortController();
                const timeoutId = setTimeout(() => abortController.abort(), OPENAI_TIMEOUT);

                const chatCompletion = await openai.chat.completions.create({
                    model: modelToUse,
                    messages: [
                        { role: "system", content: "You are a helpful assistant for language learning, specializing in English and Ukrainian. Always follow the exact structure requirements provided in the prompts. For dialog exercises, use the exact structure with dialog.start, not replika1. For reading comprehension, use ALL provided words exactly as given and follow the specified text type format. For listening exercises, create sentences that match the specified sentence type style. For dialog exercises, create conversations that match the specified dialog type context and tone." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 10000,
                }, {
                    signal: abortController.signal
                });

                clearTimeout(timeoutId);
                return chatCompletion;

            } catch (error) {
                if (retryCount < MAX_RETRIES && (
                    error.message?.includes('timeout') ||
                    error.message?.includes('network') ||
                    error.status === 429 ||
                    error.status === 500 ||
                    error.status === 502 ||
                    error.status === 503
                )) {
                    console.log(`Retrying OpenAI request (attempt ${retryCount + 1}/${MAX_RETRIES}) after error:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                    return executeOpenAIRequest(retryCount + 1);
                }
                throw error;
            }
        };

        const chatCompletion = await executeOpenAIRequest();
        const aiResponse = chatCompletion.choices[0].message.content;

        console.log('=== 🤖 OpenAI RESPONSE ===');
        console.log(`🔤 For text: "${text}"`);
        console.log(`📝 Type: ${promptType}`);
        console.log(`📊 Tokens used: ${chatCompletion.usage?.total_tokens || 'unknown'}`);
        console.log('💬 Raw Response:');
        console.log('---');
        console.log(aiResponse);
        console.log('---');
        console.log('=== END RESPONSE ===\n');

        let parsedResponse = aiResponse;
        if (promptType === "completeFlashcard" || promptType === undefined) {
            try {
                const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/) ||
                    aiResponse.match(/```\n([\s\S]*?)\n```/) ||
                    aiResponse.match(/{[\s\S]*?}/);

                const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;
                parsedResponse = JSON.parse(jsonStr.replace(/```json|```/g, ''));

                parsedResponse.text = text;

                if (typeof parsedResponse.examples === 'string') {
                    parsedResponse.examples = [parsedResponse.examples];
                }
                if (!Array.isArray(parsedResponse.examples)) {
                    parsedResponse.examples = [];
                }

            } catch (error) {
                console.log("Error parsing AI response as JSON:", error);
                return res.status(200).json({
                    raw: aiResponse,
                    parsed: false,
                    message: "Couldn't parse AI response as JSON"
                });
            }
        } else if (promptType === "examples") {
            try {
                const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/) || aiResponse.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0].replace(/```json|```/g, '');
                    parsedResponse = JSON.parse(jsonStr);
                } else {
                    parsedResponse = aiResponse.split('\n')
                        .filter(line => line.trim())
                        .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["\-]\s*/, '').replace(/["]*$/, '').trim())
                        .filter(line => line.length > 0)
                        .slice(0, 3);
                }
            } catch (error) {
                console.log("Error parsing examples response:", error);
                parsedResponse = aiResponse.split('\n')
                    .filter(line => line.trim())
                    .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["\-]\s*/, '').replace(/["]*$/, '').trim())
                    .filter(line => line.length > 0)
                    .slice(0, 3);
            }
        } else if (promptType === "dialog") {
            try {
                console.log("=== 🔍 PROCESSING DIALOG RESPONSE ===");
                console.log("Raw response length:", aiResponse.length);
                console.log("Response preview:", aiResponse.substring(0, 200) + "...");

                let jsonStr = aiResponse.trim();

                // Метод 1: Спробувати парсити як чистий JSON
                try {
                    parsedResponse = JSON.parse(jsonStr);
                    console.log("✅ Direct JSON parse successful");
                } catch (directParseError) {
                    console.log("❌ Direct parse failed:", directParseError.message);

                    // Метод 2: Видалити можливі markdown блоки
                    const codeBlockMatch = jsonStr.match(/```json\s*\n?([\s\S]*?)\n?\s*```/) ||
                        jsonStr.match(/```\s*\n?([\s\S]*?)\n?\s*```/);

                    if (codeBlockMatch) {
                        jsonStr = codeBlockMatch[1].trim();
                        console.log("🔄 Extracted from code block, trying again...");
                    }

                    // Метод 3: Знайти JSON об'єкт в тексті
                    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        jsonStr = jsonMatch[0];
                        console.log("🔄 Extracted JSON object, trying again...");
                    }

                    // Метод 4: Останній шанс - очистка та парсинг
                    jsonStr = jsonStr
                        .replace(/```json|```/g, '')
                        .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, '')
                        .trim();

                    parsedResponse = JSON.parse(jsonStr);
                    console.log("✅ Cleaned JSON parse successful");
                }

                // Валідація структури діалогу
                const validation = validateDialogStructure(parsedResponse);
                if (!validation.valid) {
                    throw new Error(`Dialog validation failed: ${validation.error}`);
                }

                // Автоматичне обрізання до 3 слів якщо більше
                if (parsedResponse.usedWords && parsedResponse.usedWords.length > 3) {
                    console.log(`⚠️ Dialog used ${parsedResponse.usedWords.length} words, trimming to 3:`, parsedResponse.usedWords);
                    parsedResponse.usedWords = parsedResponse.usedWords.slice(0, 3);
                    console.log(`✂️ Trimmed to:`, parsedResponse.usedWords);
                }

                console.log("✅ Dialog validation successful:", {
                    usedWords: parsedResponse.usedWords.length,
                    structure: parsedResponse.dialog.start ? 'start' : 'replika1',
                    startAlternatives: parsedResponse.dialog.start ? parsedResponse.dialog.start.alternatives.length : 'N/A',
                    words: parsedResponse.usedWords,
                    dialogType: parsedResponse.dialogType || 'not specified'
                });

            } catch (error) {
                console.log("❌ Complete dialog parsing failed:", error.message);

                return res.status(422).json({
                    message: "Failed to generate valid dialog structure",
                    details: error.message,
                    error_type: "dialog_generation_failed",
                    raw_response: aiResponse.substring(0, 500) + (aiResponse.length > 500 ? "..." : "")
                });
            }
        } else if (promptType === "readingComprehension") {
            try {
                const jsonMatch = aiResponse.match(/{[\s\S]*?}/) || aiResponse.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0].replace(/```json|```/g, '');
                    parsedResponse = JSON.parse(jsonStr);

                    const requiredFields = ['textType', 'text', 'usedWords', 'facts', 'correctOption'];
                    const hasRequired = requiredFields.every(field => parsedResponse.hasOwnProperty(field));

                    if (!hasRequired) {
                        throw new Error("Missing required fields in reading comprehension response");
                    }

                    if (!Array.isArray(parsedResponse.facts) || parsedResponse.facts.length !== 3) {
                        throw new Error("Reading comprehension must have exactly 3 facts");
                    }

                    // Строга перевірка що використано рівно 3 слова
                    if (!Array.isArray(parsedResponse.usedWords) || parsedResponse.usedWords.length !== 3) {
                        throw new Error(`Reading comprehension must use exactly 3 words, got ${parsedResponse.usedWords.length}`);
                    }

                    if (typeof parsedResponse.correctOption !== 'number' ||
                        parsedResponse.correctOption < 0 ||
                        parsedResponse.correctOption > 2) {
                        parsedResponse.correctOption = 0;
                    }

                    if (!parsedResponse.explanation) {
                        parsedResponse.explanation = "The correct fact is supported by information in the text.";
                    }

                    if (parsedResponse.text) {
                        parsedResponse.text = parsedResponse.text.replace(/\\n\\n/g, '\n\n');
                    }

                    const correctFact = parsedResponse.facts[parsedResponse.correctOption];
                    const shuffledFacts = [...parsedResponse.facts].sort(() => Math.random() - 0.5);
                    const newCorrectIndex = shuffledFacts.indexOf(correctFact);

                    parsedResponse.facts = shuffledFacts;
                    parsedResponse.correctOption = newCorrectIndex;

                    console.log("✅ Reading comprehension parsed successfully:");
                    console.log(`📄 Text type: ${parsedResponse.textType}`);
                    console.log(`📝 Used words: ${parsedResponse.usedWords.join(', ')}`);
                    console.log(`📊 Text length: ${parsedResponse.text.length} characters`);
                } else {
                    throw new Error("No JSON found in reading comprehension response");
                }
            } catch (error) {
                console.log("❌ Reading comprehension parsing failed:", error.message);
                console.log("Raw AI response:", aiResponse);

                return res.status(422).json({
                    message: "Failed to generate valid reading comprehension structure",
                    details: error.message,
                    error_type: "reading_comprehension_generation_failed",
                    raw_response: aiResponse.substring(0, 500) + (aiResponse.length > 500 ? "..." : "")
                });
            }
        } else if (promptType === "sentenceWithGap") {
            try {
                const jsonMatch = aiResponse.match(/{[\s\S]*?}/) || aiResponse.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0].replace(/```json|```/g, '');
                    parsedResponse = JSON.parse(jsonStr);

                    if (!parsedResponse.displaySentence || !parsedResponse.audioSentence || !parsedResponse.correctForm) {
                        throw new Error("Missing required fields in JSON response");
                    }

                    if (!parsedResponse.displaySentence.includes('____')) {
                        throw new Error("Display sentence doesn't contain gap placeholder");
                    }

                    if (parsedResponse.hint === undefined) {
                        parsedResponse.hint = "";
                    }

                    // Валідація sentenceType
                    if (!parsedResponse.sentenceType) {
                        parsedResponse.sentenceType = getRandomSentenceType();
                        console.log("⚠️ Missing sentenceType, added default:", parsedResponse.sentenceType);
                    }

                    console.log("✅ Successfully parsed sentenceWithGap JSON:", {
                        sentenceType: parsedResponse.sentenceType,
                        correctForm: parsedResponse.correctForm,
                        hasHint: !!parsedResponse.hint
                    });
                } else {
                    throw new Error("No JSON found in response");
                }
            } catch (error) {
                console.log("Error parsing sentenceWithGap response as JSON:", error);
                console.log("Raw AI response:", aiResponse);

                const cleanResponse = aiResponse.trim().replace(/^["']|["']$/g, '');
                let displaySentence, audioSentence;

                if (cleanResponse.includes('____')) {
                    displaySentence = cleanResponse;
                    audioSentence = cleanResponse.replace(/____/g, text);
                } else {
                    displaySentence = `I need to ____ this word.`;
                    audioSentence = `I need to ${text} this word.`;
                }

                parsedResponse = {
                    sentenceType: getRandomSentenceType(), // Fallback sentenceType
                    displaySentence: displaySentence,
                    audioSentence: audioSentence,
                    correctForm: text,
                    hint: ""
                };
                console.log("Using fallback sentenceWithGap format:", parsedResponse);
            }
        } else if (promptType === "matchingDescription") {
            parsedResponse = aiResponse.trim().replace(/^["']|["']$/g, '');
        } else if (promptType === "translateSentenceToUkrainian") {
            parsedResponse = aiResponse.trim().replace(/^["']|["']$/g, '');
            console.log("Sentence translation result:", parsedResponse);
        }

        console.log('=== ✅ FINAL PROCESSED RESULT ===');
        console.log(`🔤 For text: "${text}"`);
        console.log(`📝 Type: ${promptType}`);
        console.log('🎯 Processed Result:');
        console.log(parsedResponse);
        console.log('=== END FINAL RESULT ===\n');

        return res.status(200).json({
            result: parsedResponse,
            raw: aiResponse,
            parsed: promptType === "completeFlashcard" || promptType === undefined || promptType === "examples" || promptType === "sentenceWithGap" || promptType === "matchingDescription" || promptType === "translateSentenceToUkrainian" || promptType === "dialog" || promptType === "readingComprehension",
            modelUsed: modelToUse,
            categoryContext: categoryContext ? "Used category context" : "No category context"
        });

    } catch (error) {
        console.log("Error in generateFlashcardContent controller:", error);

        let errorResponse = {
            message: "Error generating content",
            details: "Error occurred while generating content with AI"
        };

        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
            errorResponse = {
                message: "OpenAI request timed out",
                details: "Request took too long to complete. Please try again.",
                action: "Try with a shorter text or check your internet connection"
            };
        } else if (error.status === 401) {
            errorResponse = {
                message: "Invalid OpenAI API key",
                details: "System API key may be expired, invalid, or have insufficient permissions",
                action: "Contact system administrator"
            };
        } else if (error.status === 429) {
            errorResponse = {
                message: "OpenAI API rate limit exceeded",
                details: "Too many requests to OpenAI API",
                action: "Please try again later"
            };
        } else if (error.status === 402 || error.message?.includes('quota')) {
            errorResponse = {
                message: "OpenAI API quota exceeded",
                details: "Insufficient credits or billing issue",
                action: "Contact system administrator"
            };
        }

        return res.status(error.status || 500).json(errorResponse);
    }
};

// Функція валідації структури діалогу
function validateDialogStructure(dialog) {
    try {
        // Перевірка основної структури
        if (!dialog || typeof dialog !== 'object') {
            return { valid: false, error: "Dialog must be an object" };
        }

        // Перевірка usedWords
        if (!Array.isArray(dialog.usedWords)) {
            return { valid: false, error: "usedWords must be an array" };
        }

        if (dialog.usedWords.length < 3) {
            return { valid: false, error: `Must use at least 3 words, got ${dialog.usedWords.length}` };
        }

        // Перевірка що всі слова не порожні
        for (const word of dialog.usedWords) {
            if (!word || typeof word !== 'string' || word.trim().length === 0) {
                return { valid: false, error: "All used words must be non-empty strings" };
            }
        }

        // Перевірка dialogType
        if (!dialog.dialogType || typeof dialog.dialogType !== 'string') {
            console.warn("Missing or invalid dialogType, validation continues");
        }

        // Перевірка dialog структури
        if (!dialog.dialog) {
            return { valid: false, error: "Missing dialog structure" };
        }

        // Підтримка обох структур - start та replika1
        let dialogStart = null;
        if (dialog.dialog.start) {
            dialogStart = dialog.dialog.start;
            console.log("✅ Found dialog.start structure");
        } else if (dialog.dialog.replika1) {
            dialogStart = dialog.dialog.replika1;
            console.log("✅ Found dialog.replika1 structure - converting to start");

            // Конвертуємо replika1 в start структуру
            dialog.dialog.start = dialogStart;
            delete dialog.dialog.replika1;
        } else {
            return { valid: false, error: "Missing dialog.start or dialog.replika1 structure" };
        }

        // Перевірка початкової репліки
        if (!dialogStart.speaker || !dialogStart.text) {
            return { valid: false, error: "Start must have speaker and text" };
        }

        // Перевірка альтернатив
        if (!Array.isArray(dialogStart.alternatives)) {
            return { valid: false, error: "Start must have alternatives array" };
        }

        if (dialogStart.alternatives.length < 1) {
            return { valid: false, error: "Start must have at least 1 alternative" };
        }

        // Гнучка валідація: перевіряємо лише що є альтернативи та next структури
        for (let i = 0; i < dialogStart.alternatives.length; i++) {
            const alt = dialogStart.alternatives[i];

            if (!alt.speaker || !alt.text) {
                return { valid: false, error: `Alternative ${i} must have speaker and text` };
            }

            if (!alt.next) {
                return { valid: false, error: `Alternative ${i} must have next object` };
            }

            if (!alt.next.speaker || !alt.next.text) {
                return { valid: false, error: `Alternative ${i}.next must have speaker and text` };
            }

            // Якщо є вкладені альтернативи, перевіряємо їх базову структуру
            if (alt.next.alternatives && Array.isArray(alt.next.alternatives)) {
                for (let j = 0; j < alt.next.alternatives.length; j++) {
                    const nestedAlt = alt.next.alternatives[j];

                    if (!nestedAlt.speaker || !nestedAlt.text) {
                        return { valid: false, error: `Nested alternative ${i}-${j} must have speaker and text` };
                    }
                }
            }
        }

        console.log("✅ Dialog structure validation passed");
        return { valid: true };

    } catch (error) {
        return { valid: false, error: `Validation error: ${error.message}` };
    }
}

// Регенерація прикладів
const regenerateExamples = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const systemApiKey = process.env.OPENAI_API_KEY;
        if (!systemApiKey) {
            return res.status(500).json({
                message: "OpenAI API key not configured",
                details: "System OpenAI API key is not available"
            });
        }

        const flashcard = await Flashcard.findOne({ _id: id, userId });
        if (!flashcard) {
            return res.status(404).json({ message: "Flashcard not found" });
        }

        let categoryContext = "";
        if (flashcard.categoryId) {
            try {
                const category = await Category.findOne({ _id: flashcard.categoryId, userId });
                if (category) {
                    categoryContext = `\n\nIMPORTANT CONTEXT: This word/phrase belongs to the topic/category "${category.name}"`;
                    if (category.description && category.description.trim()) {
                        categoryContext += ` (${category.description.trim()})`;
                    }
                    categoryContext += `. Please consider this context when generating examples. The examples should be relevant to this specific topic/category.`;

                    console.log(`Regenerating examples with category context - ${category.name}`);
                }
            } catch (categoryError) {
                console.warn("Could not fetch category for examples context:", categoryError.message);
            }
        }

        let userSettings = await UserSettings.findOne({ userId });
        if (!userSettings) {
            return res.status(400).json({ message: "User settings not found" });
        }

        const englishLevel = userSettings.generalSettings?.defaultEnglishLevel || "B1";
        const modelToUse = userSettings.aiSettings?.chatgptModel || "gpt-4.1-mini";

        const openai = new OpenAI({
            apiKey: systemApiKey,
            timeout: OPENAI_TIMEOUT
        });

        // Використовуємо функцію з prompts.js
        const prompt = generateRegenerateExamplesPrompt(flashcard.text, englishLevel, categoryContext);

        console.log(`Regenerating examples for: "${flashcard.text}" using system API key`);

        console.log('=== 🔄 REGENERATE EXAMPLES PROMPT ===');
        console.log(`🔤 Text: "${flashcard.text}"`);
        console.log(`📚 English Level: ${englishLevel}`);
        if (categoryContext) {
            console.log(`📁 Category Context: Used`);
        } else {
            console.log(`📁 Category Context: None`);
        }
        console.log('📋 Full Prompt:');
        console.log('---');
        console.log(prompt);
        console.log('---');
        console.log('=== END REGENERATE PROMPT ===\n');

        const executeRegenerateRequest = async (retryCount = 0) => {
            try {
                const abortController = new AbortController();
                const timeoutId = setTimeout(() => abortController.abort(), OPENAI_TIMEOUT);

                const chatCompletion = await openai.chat.completions.create({
                    model: modelToUse,
                    messages: [
                        { role: "system", content: "You are a helpful assistant for language learning. Create diverse and creative example sentences." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.8,
                    max_tokens: 10000,
                }, {
                    signal: abortController.signal
                });

                clearTimeout(timeoutId);
                return chatCompletion;

            } catch (error) {
                if (retryCount < MAX_RETRIES && (
                    error.message?.includes('timeout') ||
                    error.message?.includes('network') ||
                    error.status === 429 ||
                    error.status === 500 ||
                    error.status === 502 ||
                    error.status === 503
                )) {
                    console.log(`Retrying regenerate request (attempt ${retryCount + 1}/${MAX_RETRIES}) after error:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                    return executeRegenerateRequest(retryCount + 1);
                }
                throw error;
            }
        };

        const chatCompletion = await executeRegenerateRequest();
        const aiResponse = chatCompletion.choices[0].message.content;
        let newExamples = [];

        console.log('=== 🔄 REGENERATE RESPONSE ===');
        console.log(`🔤 For text: "${flashcard.text}"`);
        console.log(`📊 Tokens used: ${chatCompletion.usage?.total_tokens || 'unknown'}`);
        console.log('💬 Raw Response:');
        console.log('---');
        console.log(aiResponse);
        console.log('---');
        console.log('=== END REGENERATE RESPONSE ===\n');

        try {
            const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/) || aiResponse.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0].replace(/```json|```/g, '');
                newExamples = JSON.parse(jsonStr);
            } else {
                newExamples = aiResponse.split('\n')
                    .filter(line => line.trim())
                    .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["\-]\s*/, '').replace(/["]*$/, '').trim())
                    .filter(line => line.length > 0)
                    .slice(0, 3);
            }
        } catch (error) {
            console.log("Error parsing examples response:", error);
            newExamples = aiResponse.split('\n')
                .filter(line => line.trim())
                .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["\-]\s*/, '').replace(/["]*$/, '').trim())
                .filter(line => line.length > 0)
                .slice(0, 3);
        }

        console.log('=== ✅ FINAL REGENERATED EXAMPLES ===');
        console.log(`🔤 For text: "${flashcard.text}"`);
        console.log('🎯 New Examples:');
        newExamples.forEach((example, index) => {
            console.log(`${index + 1}. ${example}`);
        });
        console.log('=== END FINAL EXAMPLES ===\n');

        flashcard.examples = newExamples;
        await flashcard.save();

        await flashcard.populate('categoryId', 'name color');

        return res.status(200).json({
            success: true,
            flashcard: flashcard,
            newExamples: newExamples,
            message: "Examples regenerated successfully",
            modelUsed: modelToUse,
            categoryContext: categoryContext ? "Used category context" : "No category context"
        });

    } catch (error) {
        console.log("Error in regenerateExamples controller:", error);

        let errorResponse = {
            message: "Error regenerating examples",
            details: "Error occurred while generating new examples"
        };

        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
            errorResponse = {
                message: "Request timed out",
                details: "Request took too long to complete. Please try again."
            };
        } else if (error.status === 401) {
            errorResponse = {
                message: "Invalid OpenAI API key",
                details: "System API key may be expired, invalid, or have insufficient permissions"
            };
        } else if (error.status === 429) {
            errorResponse = {
                message: "OpenAI API rate limit exceeded",
                details: "Too many requests to OpenAI API"
            };
        } else if (error.status === 402 || error.message?.includes('quota')) {
            errorResponse = {
                message: "OpenAI API quota exceeded",
                details: "Insufficient credits or billing issue"
            };
        }

        return res.status(error.status || 500).json(errorResponse);
    }
};

export default {
    generateFlashcardContent,
    regenerateExamples
};