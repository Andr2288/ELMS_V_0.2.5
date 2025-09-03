// frontend/src/components/exercises/shared/ExerciseLayout.jsx
// Загальна структура для всіх вправ з підтримкою стану обробки

import ExerciseHeader from "./ExerciseHeader.jsx";
import ExerciseControls from "./ExerciseControls.jsx";

const ExerciseLayout = ({
                            // Header props
                            icon,
                            title,
                            description,
                            gradientClasses,
                            onExit,
                            progress,

                            // Content
                            children,

                            // Controls props
                            onRestart,
                            onContinue,
                            isLastQuestion,
                            showResult,
                            isProcessing = false // Стейт обробки для всього компонента
                        }) => {
    return (
        <div className="max-w-4xl mx-auto">
            <ExerciseHeader
                icon={icon}
                title={title}
                description={description}
                gradientClasses={gradientClasses}
                onExit={onExit}
                progress={progress}
                isProcessing={isProcessing} // ДОДАНО: передаємо в header
            />

            {/* Main content area */}
            <div className="space-y-6">
                {children}
            </div>

            <ExerciseControls
                gradientClasses={gradientClasses}
                onRestart={onRestart}
                onContinue={onContinue}
                isLastQuestion={isLastQuestion}
                showResult={showResult}
                isProcessing={isProcessing} // Вже було передано раніше
            />
        </div>
    );
};

export default ExerciseLayout;