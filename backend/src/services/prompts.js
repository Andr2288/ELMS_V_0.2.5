// backend/src/services/prompts.js - ПРОМПТИ ДЛЯ AI ГЕНЕРАЦІЇ

// Масив типів текстів для reading comprehension
export const TEXT_TYPES = [
    "documentary",
    "story",
    "news",
    "article",
    "blog",
    "scientific",
    "announcement",
    "advertisement",
    "instruction",
    "review on product / video / post etc",
    "letter",
    "documentation",
    "speech",
    "comment",
    "social media post",
];

// Функція для рандомного вибору типу тексту
export const getRandomTextType = () => {
    const randomIndex = Math.floor(Math.random() * TEXT_TYPES.length);
    return TEXT_TYPES[randomIndex];
};

// Функція для рандомного вибору типу речення
export const getRandomSentenceType = () => {
    const randomIndex = Math.floor(Math.random() * TEXT_TYPES.length);
    return TEXT_TYPES[randomIndex];
};

// Функція для генерації промпту в залежності від типу
export const generatePrompt = (
    promptType,
    text,
    englishLevel,
    categoryContext = ""
) => {
    switch (promptType) {
        case "definition":
            return `English level you must to use in your output: ${englishLevel}. A detailed definition/explanation of meaning and usage (can be longer and more comprehensive) for: ${text}. Format example for output: A valley is a long, low area of land between hills or mountains. It is often formed by rivers or glaciers and can be wide or narrow. Valleys are places where people can live, grow crops, or travel through because they are lower and sometimes flatter than the surrounding land.${categoryContext}`;

        case "exerciseExplanation":
            return `English level: ${englishLevel}. 
Task: Create an detailed explanation/description for the word/phrase: "${text}". 

Rules:
- Write 1-2 sentences max.
- Do NOT use the target word itself but you can use synonims.
- OPTIONALLY start with a categorization like "It's a thing that...", "It's a feeling when...", "It's a verb that means...", "It's a noun for..." etc.
- Do NOT add extra phrases like "Here is an explanation" or "Certainly".
- The explanation should be in the given English level.
- If the given English level is A1 - use very simple language for beginners and explain in simple words 
- Output must be only the explanation sentence.

${categoryContext}

✅ Correct example for word "happiness": "It's a feeling when you are very pleased and satisfied with something good that happens to you."
✅ Correct example for word "bicycle": "A two-wheeled vehicle that you move forward by pedaling with your feet. It usually has handlebars to steer, a seat to sit on, and is powered only by the rider."
❌ Incorrect example for word "bicycle": "A bicycle is a bike people ride." (uses the word and direct synonym)
❌ Incorrect example for word "Indubitably": "Certainly! Here is a clear and concise explanation for the word 'Indubitably' at A1 level: 'Used to say something is true without any doubt.'" (extra phrases, not 1 sentence)`;

        case "shortDescription":
            return `English level you must to use in your output: ${englishLevel}. Write a very short description (1-2 sentences max, under 100 characters) for English word/phrase: "${text}". The description should be concise, clear and appropriate for ${englishLevel} level learners.${categoryContext}`;

        case "matchingDescription":
            return `English level you must to use in your output: ${englishLevel}. 

Create a short description for the word/phrase: "${text}" for a matching exercise.

CRITICAL RULES:
- DO NOT use the word "${text}" or any part of it in your description
- DO NOT use synonyms or direct translations of "${text}"
- DO NOT use phrases like "This word means..." or "It is when..."
- Make it 1-2 sentences maximum
- Focus on describing the concept, action, or thing WITHOUT naming it
- Use simple, clear language appropriate for ${englishLevel} level
- The description should help identify the word but require thinking

Examples of GOOD descriptions:
- For "library": "A quiet place where people borrow books and study"
- For "celebrate": "When people have a party because something good happened"
- For "mountain": "Very tall land that goes high up into the sky"

Create a similar indirect description for: "${text}"${categoryContext}`;

        case "readingComprehension":
            const selectedTextType = getRandomTextType();
            console.log(
                `Reading comprehension: selected text type - ${selectedTextType}`
            );

            return `Create a reading comprehension exercise using these 3 words: ${text}. English level: ${englishLevel}.

IMPORTANT: You must use ALL 3 words provided.

Return a JSON object with this exact structure:
{
  "textType": "${selectedTextType}",
  "text": "A detailed 3-4 paragraph text (use \\n\\n between paragraphs (or 6-8 replicas if textType = "dialogue"))",
  "usedWords": [the exact 3 words from the input, in the forms you used them],
  "facts": [
    "TRUE fact from the text",
    "FALSE fact that sounds plausible but is not mentioned in the text",
    "FALSE fact that sounds plausible but is not mentioned in the text"
  ],
  "correctOption": 0,
  "explanation": "Why the correct fact is true according to the text"
}

CRITICAL REQUIREMENTS:
- Use ALL 3 words provided: ${text}
- In usedWords property, list the exact 3 words in the forms you used them
- facts[0] must be TRUE and found in the text
- facts[1] and facts[2] must be FALSE and not mentioned in the text
- Make sure the text style, tone, and structure match the ${selectedTextType} format
- Don't make it sound like definitions to the words / phrases or explanations
- You should write everything in ${englishLevel} level
- If the given English level is A1 - use simple language for beginners
- Make sure twice you made everything right

Example:

text = ["To walk", "To buy", "To play"]
englishLevel = "A1"
selectedTextType = "story"

{
  "textType": "story",
  "text": "Yesterday, Emma walked to the park because the weather was nice. She enjoyed looking at the flowers and trees.\\n\\nOn her way, she saw a small market where people were buying fresh fruits and vegetables. She bought some apples for her lunch.\\n\\nIn the evening, Emma's brother plays the guitar at home. She listened to the music and felt very happy.",
  "usedWords": ["walked", "buying", "plays"],
  "facts": [
    "Emma walked to the park yesterday.",
    "Emma took a bus to the city center.",
    "Emma's sister plays the guitar in the evening."
  ],
  "correctOption": 0,
  "explanation": "The text says that Emma walked to the park yesterday, which makes this fact true."
}

Create reading comprehension exercise using these EXACT 3 words: ${text}${categoryContext}`;

        case "example":
            return `Create a sentence. English level you must to use in your output: ${englishLevel}. Word to use: ${text}${categoryContext}`;

        case "examples":
            return `Create 3 different example sentences using the word/phrase: "${text}". English level you must to use in your output: ${englishLevel}. Each sentence should show different contexts or meanings. Return as a JSON array of strings.${categoryContext}`;

        case "sentenceWithGap":
            const selectedSentenceType = getRandomSentenceType();
            console.log(
                `Sentence completion: selected sentence type - ${selectedSentenceType}`
            );

            return `Create a sentence completion exercise for the word "${text}". English level: ${englishLevel}.

IMPORTANT: Create a detailed text that sounds like it comes from a ${selectedSentenceType}.

Return a JSON object with this exact structure:
{
  "sentenceType": "${selectedSentenceType}",
  "displaySentence": "sentence with ____ gap",
  "audioSentence": "complete correct sentence for audio",
  "correctForm": "correct form of the word that fits",
  "hint": "clear and short explanation"
}

Requirements:
- sentenceType: "${selectedSentenceType}" (the style/context of the sentence)
- displaySentence: Use "____" (four underscores) as placeholder
- audioSentence: Complete grammatically correct sentence
- correctForm: The actual form of "${text}" that fits (may be different due to tense, plural, etc.)
- hint: Create an explanation/description for the word/phrase: "${text}". Make it clear and concise but don't use the word itself or its direct translations. The explanation should be 1 sentence long and help students identify the word.
- Sentence should be in ${englishLevel} level
- If the given English level is A1 - use very simple language for beginners

Example for word "clear" in "weather forecast" style:

{
  "sentenceType": "weather forecast",
  "displaySentence": "Tomorrow the sky will be ____ throughout the day, with no clouds expected. Temperatures will rise steadily in the afternoon, bringing warm and pleasant weather.",
  "audioSentence": "Tomorrow the sky will be clear throughout the day, with no clouds expected. Temperatures will rise steadily in the afternoon, bringing warm and pleasant weather.",
  "correctForm": "clear",
  "hint": "Typical word in forecasts when the sky has no clouds at all."
}

Now create exercise for: "${text}" in ${selectedSentenceType} style${categoryContext}`;

        case "transcription":
            return `You are integrated in English LMS. Provide me with the transcription for: ${text}. Resources: Oxford Learner's Dictionaries. String format example for output: UK: [ˌjuːnɪˈvɜːsəti]; US: [ˌjuːnɪˈvɜːrsəti];${categoryContext}`;

        case "translateToUkrainian":
            return `Translate to Ukrainian. Provide several translation variants for: "${text}". Output only in this format: "Виглядати; дивитися; вигляд; зовнішність". No extra text. Only the string.${categoryContext}`;

        case "translateSentenceToUkrainian":
            return `Translate the following English sentence to Ukrainian. Make the translation natural, accurate and appropriate for language learning context.

English sentence: "${text}"

Requirements:
- Provide a clear, natural Ukrainian translation
- Use proper grammar and word order
- Make it sound natural for native Ukrainian speakers
- Keep the meaning accurate but not word-for-word literal
- Consider the context of language learning exercises
- Output ONLY the Ukrainian translation, no additional text

Example:
English: "I go to work every day."
Ukrainian: "Я йду на роботу щодня."

Translate: "${text}"${categoryContext}`;

        case "translateFromUkrainian":
            return `Provide translation from Ukrainian to English for: ${text}${categoryContext}`;

        case "completeFlashcard":
        default:
            return `Create a comprehensive flashcard for an English vocabulary word/phrase. Word: "${text}".
The output must be in English level: ${englishLevel}.

Return JSON format:
{
  "text": "${text}",
  "transcription": "Resources: Oxford Learner's Dictionaries. Must use \\n\\n between each variant. Format for output: UK: [ˌjuːnɪˈvɜːsəti] US: [ˌjuːnɪˈvɜːrsəti];",
  "translation": "Several possible Ukrainian translation variants (1-2 or more) for: "${text}". Output only in the format like: "Виглядати; дивитися; вигляд; зовнішність". No extra text. Only the string.",
  "shortDescription": "A very short description (1-2 sentences max, under 100 characters). The description should be concise and clear",
  "explanation": "Write a comprehensive, detailed explanation of the word/phrase that includes ALL of the following elements:

1. DETAILED MEANING: Start with a clear, complete definition of the word. Explain what it means in depth, including any nuances or variations
2. USAGE CONTEXT: Describe when and how this word is typically used in simple words to understand
3. REAL-WORLD APPLICATION: Describe practical situations where this word is used and explain the meaning (for example you can use synonims)
4. SOME INTERESTING FACTS: some facts form life or specific examples 

Your explanation must be written in an engaging, educational article style appropriate for ${englishLevel} level learners (must use \\n\\n between paragraphs). Think of it as a mini-encyclopedia entry that thoroughly covers the topic. Use simple language but provide comprehensive information.

Examples structure:
  "examples": ["Example sentence 1 using the word", "Example sentence 2 showing different context", "Example sentence 3 with another usage"],
  "notes": ""
}

Requirements:
- Ensure all content is in ${englishLevel} English level
- Don't use conclusion at the end of explanation like "In conclusion" or "Overall, ...", only the main information without unnecessary text
- The "explanation" property text must be 3-4 paragraphs max

Example for word "opportunity":

{
  "text": "opportunity",
  "transcription": "UK: [ˌɒpəˈtjuːnəti]\\\\n\\\\nUS: [ˌɑːpərˈtuːnəti]",
  "translation": "можливість; нагода; шанс; перспектива",
  "shortDescription": "A chance to do something good or important that can help you succeed.",
  "explanation": "An opportunity is a chance to do something that can be good for you. It is like a special moment when you can try something new or improve your life. When you have an opportunity, it means the right time has come to do something important.\\n\\nOpportunities can happen in many parts of your life. At work, you might get an opportunity to get a better job or learn new skills. At school, you might have an opportunity to join a club or study in another country. In your personal life, you might get an opportunity to meet new friends or visit new places. Some opportunities come and go quickly, so you need to act fast. Other opportunities stay for a longer time. The important thing is to notice them and decide if you want to try.\\n\\nThe word 'opportunity' is very common in English. People use it when they talk about jobs, education, and life in general. For example, your teacher might say 'This is a good opportunity to practice English.' Here, opportunity means a special chance or the right moment to improve your English skills by practicing. Your boss might say 'We have an opportunity to work with a new company.' It means we can start working together with another company. In real life, opportunities are everywhere. When you meet new people, that's an opportunity to make friends. When you see a job advertisement, that's an opportunity to get work. The word 'opportunity' is a noun. You can also use the word 'chance' which means almost the same thing.",
  "examples": [
    "This job is a good opportunity for me to learn new things.",
    "I missed the opportunity to see my favorite band in concert.",
    "Going to university is an opportunity to meet new friends."
  ],
  "notes": ""
}

Example for word "valley":

{
  "text": "valley",
  "transcription": "UK: [ˈvæli]\\n\\nUS: [ˈvæli]",
  "translation": "долина",
  "shortDescription": "A low area of land between hills or mountains, often with a river or stream.",
  "explanation": "A valley is a low area of land between hills or mountains. Valleys are made by rivers or ice moving through the land. Usually, the land goes down in the middle and up on both sides.\\n\\nSome valleys are wide with soft, green sides and flat bottoms. Other valleys are narrow with steep sides. Many valleys have rivers or small streams running through them. They can look like natural roads between hills or mountains.\\n\\nValleys are useful for people. The soil is rich, so farmers can grow crops. Many people live in valleys because they are protected from strong winds. Valleys make good paths for travel. Beautiful valleys attract tourists. Rivers in valleys can give water for drinking.\\n\\nSome valleys are very big. The Grand Canyon in the USA is 446 km long and 29 km wide. Some valleys on Mars are even bigger. Some valleys are made by rivers over millions of years. Others are made by ice called glaciers. Valleys are not always safe. Heavy rain can cause floods. Cold air can stay in valleys, making them colder than other places. Landslides can happen on valley sides. Fog is common and can make it hard to see.",
  "examples": [
    "The hikers walked through a beautiful valley with a river running through it.",
    "Farmers grow crops in the fertile soil of the valley.",
    "The Grand Canyon is a famous valley in the United States."
  ],
  "notes": ""
}
${categoryContext}`;
    }
};

// Промпт для регенерації прикладів
export const generateRegenerateExamplesPrompt = (
    text,
    englishLevel,
    categoryContext = ""
) => {
    return `Create 3 NEW and DIFFERENT example sentences using the word/phrase: "${text}". 
English level: ${englishLevel}. 
Each sentence should show different contexts or meanings than previous examples.
Make them creative and varied.
Return as a JSON array of strings.${categoryContext}`;
};