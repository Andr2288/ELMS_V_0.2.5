// frontend/src/components/shared/ExerciseHeader.jsx
// Універсальна шапка для всіх вправ з виправленим прогресом

import { Home } from "lucide-react";

const ExerciseHeader = ({
                            icon: Icon,
                            title,
                            description,
                            gradientClasses,
                            onExit,
                            progress = null, // Опціональний прогрес { current, total, correct }
                            isProcessing = false // ДОДАНО: Стейт обробки для кнопки виходу
                        }) => {
    return (
        <div className="bg-white rounded-2xl shadow-md p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <div className={`bg-gradient-to-r ${gradientClasses} w-12 h-12 rounded-xl flex items-center justify-center mr-4`}>
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                        <p className="text-gray-600">{description}</p>
                    </div>
                </div>
                <button
                    onClick={() => !isProcessing && onExit({ completed: false })} // ДОДАНО: перевірка isProcessing
                    disabled={isProcessing} // ДОДАНО
                    className={`flex items-center transition-colors ${
                        isProcessing
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-gray-600 hover:text-gray-800 cursor-pointer'
                    }`}
                >
                    <Home className="w-5 h-5 mr-2" />
                    Вийти
                </button>
            </div>

            {/* Progress bar - показується якщо передано progress */}
            {progress && (
                <>
                    <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                        <span>Питання {progress.current} з {progress.total}</span>
                        <span>Правильно: {progress.correct} з {progress.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className={`bg-gradient-to-r ${gradientClasses} h-2 rounded-full transition-all duration-300`}
                            style={{
                                width: `${((progress.current) / progress.total) * 100}%`
                            }}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default ExerciseHeader;