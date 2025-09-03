// frontend/src/components/shared/ExerciseControls.jsx
// Універсальні кнопки керування для всіх вправ з підтримкою disabled стану

import { ArrowRight, RefreshCw, Trophy } from "lucide-react";

const ExerciseControls = ({
                              gradientClasses,
                              onRestart,
                              onContinue,
                              isLastQuestion = false,
                              showResult = false,
                              isProcessing = false // Новий проп для відстеження обробки
                          }) => {
    if (!showResult) {
        return null; // Кнопки показуються тільки після відповіді
    }

    return (
        <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="flex justify-between items-center">
                <button
                    onClick={onRestart}
                    disabled={isProcessing}
                    className={`flex items-center transition-colors cursor-pointer ${
                        isProcessing
                            ? 'text-gray-400'
                            : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Почати заново
                </button>

                <button
                    onClick={onContinue}
                    disabled={isProcessing}
                    className={`py-3 px-6 rounded-xl font-medium transition-all flex items-center cursor-pointer ${
                        isProcessing
                            ? `bg-gradient-to-r ${gradientClasses} text-white opacity-50`
                            : `bg-gradient-to-r ${gradientClasses} text-white hover:shadow-lg`
                    }`}
                >
                    {isLastQuestion ? (
                        <>
                            Завершити
                            <Trophy className="w-5 h-5 ml-2" />
                        </>
                    ) : (
                        <>
                            Продовжити
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ExerciseControls;