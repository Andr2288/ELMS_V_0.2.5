import { useState, useEffect } from "react";
import {
    Settings, Volume2, RotateCcw, Sparkles
} from "lucide-react";
import { useUserSettingsStore } from "../store/useUserSettingsStore.js";
import toast from "react-hot-toast";

const SettingsPage = () => {
    const {
        settings,
        availableOptions,
        isLoading: isLoadingSettings,
        isSaving,
        loadSettings,
        loadAvailableOptions,
        updateSetting,
        resetSettings
    } = useUserSettingsStore();

    // Local states
    const [isResetting, setIsResetting] = useState(false);

    // Load settings and options on component mount
    useEffect(() => {
        loadSettings();
        loadAvailableOptions();
    }, []);

    // Auto-save handler
    const handleSettingChange = async (path, value) => {
        try {
            await updateSetting(path, value);
        } catch (error) {
            // Error handling is done in the store
        }
    };

    const handleResetSettings = async () => {
        if (!confirm("Ви впевнені, що хочете скинути всі налаштування до значень за замовчуванням?")) {
            return;
        }

        try {
            setIsResetting(true);
            await resetSettings();
        } finally {
            setIsResetting(false);
        }
    };

    if (isLoadingSettings) {
        return (
            <div className="ml-64 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Завантаження налаштувань...</p>
                </div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="ml-64 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <Settings className="w-12 h-12 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-600">Помилка завантаження налаштувань</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ml-64 min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="p-8">
                    <div className="mx-auto flex items-center justify-between">
                        <div className="flex items-center">
                            <div className="bg-gradient-to-r from-gray-600 to-slate-600 w-10 h-10 rounded-lg flex items-center justify-center mr-3 shadow-md">
                                <Settings className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Налаштування</h1>
                                <p className="text-gray-600">Персональні налаштування додатку</p>
                            </div>
                        </div>

                        {/* Status Indicators */}
                        <div className="flex items-center space-x-4">
                            {/* Auto-save indicator */}
                            {isSaving && (
                                <div className="flex items-center space-x-2 text-blue-600 text-sm">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                    <span>Збереження...</span>
                                </div>
                            )}

                            {/* Reset Button */}
                            <button
                                onClick={handleResetSettings}
                                disabled={isResetting || isSaving}
                                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 disabled:opacity-70 text-white rounded-xl transition-colors shadow-md hover:shadow-lg"
                            >
                                {isResetting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <RotateCcw className="w-4 h-4" />
                                )}
                                <span>Скинути</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* AI Settings */}
                    {availableOptions && (
                        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center space-x-3">
                                    <Sparkles className="w-5 h-5 text-purple-600" />
                                    <h2 className="text-xl font-semibold text-gray-900">Налаштування ШІ</h2>
                                </div>
                                <p className="text-gray-600 mt-1">Параметри для генерації контенту за допомогою ШІ</p>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* ChatGPT Model */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Модель ChatGPT
                                    </label>
                                    <select
                                        value={settings.aiSettings?.chatgptModel || "gpt-4.1-mini"}
                                        onChange={(e) => handleSettingChange('aiSettings.chatgptModel', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {availableOptions.chatgptModels?.map((model) => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {availableOptions.chatgptModels?.find(m => m.id === settings.aiSettings?.chatgptModel)?.description ||
                                            "Модель для генерації контенту"}
                                    </p>
                                </div>

                                {/* Default English Level */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Рівень англійської за замовчуванням
                                    </label>
                                    <select
                                        value={settings.generalSettings?.defaultEnglishLevel || "B1"}
                                        onChange={(e) => handleSettingChange('generalSettings.defaultEnglishLevel', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {availableOptions.englishLevels?.map((level) => (
                                            <option key={level.id} value={level.id}>
                                                {level.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {availableOptions.englishLevels?.find(l => l.id === settings.generalSettings?.defaultEnglishLevel)?.description ||
                                            "Рівень складності англійської для генерації контенту"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TTS Settings */}
                    {availableOptions && (
                        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center space-x-3">
                                    <Volume2 className="w-5 h-5 text-purple-600" />
                                    <h2 className="text-xl font-semibold text-gray-900">Налаштування TTS</h2>
                                </div>
                                <p className="text-gray-600 mt-1">Параметри синтезу мовлення</p>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Model */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Модель TTS
                                    </label>
                                    <select
                                        value={settings.ttsSettings?.model || "tts-1"}
                                        onChange={(e) => handleSettingChange('ttsSettings.model', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {availableOptions.models?.map((model) => (
                                            <option key={model.id} value={model.id}>
                                                {model.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {availableOptions.models?.find(m => m.id === settings.ttsSettings?.model)?.description}
                                    </p>
                                </div>

                                {/* Voice */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Голос
                                    </label>
                                    <select
                                        value={settings.ttsSettings?.voice || "alloy"}
                                        onChange={(e) => handleSettingChange('ttsSettings.voice', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {availableOptions.voices?.map((voice) => (
                                            <option key={voice.id} value={voice.id}>
                                                {voice.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {availableOptions.voices?.find(v => v.id === settings.ttsSettings?.voice)?.description}
                                    </p>
                                </div>

                                {/* Speed */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Швидкість: {settings.ttsSettings?.speed || 1.0}x
                                    </label>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.10"
                                        value={settings.ttsSettings?.speed || 1.0}
                                        onChange={(e) => handleSettingChange('ttsSettings.speed', parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>0.5x</span>
                                        <span className="mr-45">1x</span>
                                        <span>2x</span>
                                    </div>
                                </div>

                                {/* Response Format */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Формат аудіо
                                    </label>
                                    <select
                                        value={settings.ttsSettings?.responseFormat || "mp3"}
                                        onChange={(e) => handleSettingChange('ttsSettings.responseFormat', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {availableOptions.responseFormats?.map((format) => (
                                            <option key={format.id} value={format.id}>
                                                {format.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {availableOptions.responseFormats?.find(f => f.id === settings.ttsSettings?.responseFormat)?.description}
                                    </p>
                                </div>

                                {/* Voice Style */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Стиль голосу
                                    </label>
                                    <select
                                        value={settings.ttsSettings?.voiceStyle || "neutral"}
                                        onChange={(e) => handleSettingChange('ttsSettings.voiceStyle', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {availableOptions.voiceStyles?.map((style) => (
                                            <option key={style.id} value={style.id}>
                                                {style.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {availableOptions.voiceStyles?.find(s => s.id === settings.ttsSettings?.voiceStyle)?.description}
                                    </p>
                                </div>

                                {/* Custom Instructions */}
                                {settings.ttsSettings?.model === "gpt-4o-mini-tts" && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Додаткові інструкції (тільки для GPT-4o Mini TTS)
                                        </label>
                                        <textarea
                                            value={settings.ttsSettings?.customInstructions || ""}
                                            onChange={(e) => handleSettingChange('ttsSettings.customInstructions', e.target.value)}
                                            placeholder="Додаткові інструкції для стилю озвучування..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                            rows="3"
                                            maxLength="500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {(settings.ttsSettings?.customInstructions || "").length}/500 символів
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* General Settings */}
                    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">Загальні налаштування</h2>
                            <p className="text-gray-600 mt-1">Основні параметри застосунку</p>
                        </div>

                        <div className="p-6">
                            {/* Cache Audio */}
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="cacheAudio"
                                    checked={settings.generalSettings?.cacheAudio || false}
                                    onChange={(e) => handleSettingChange('generalSettings.cacheAudio', e.target.checked)}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <label htmlFor="cacheAudio" className="ml-2 text-sm text-gray-700">
                                    Кешувати аудіо файли
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 ml-6">
                                Збереження аудіо файлів для швидшого повторного відтворення
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;