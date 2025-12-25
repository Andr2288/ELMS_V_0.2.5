// frontend/src/components/ProfileEditModal.jsx

import { useState, useEffect, useRef } from "react";
import { Save, X, Camera, User } from "lucide-react";
import toast from "react-hot-toast";

const ProfileEditModal = ({
                              isOpen,
                              onClose,
                              onSave,
                              initialData,
                              isLoading
                          }) => {
    const [formData, setFormData] = useState({
        fullName: "",
        profilePic: ""
    });

    const nameInputRef = useRef(null);

    // Ініціалізуємо форму при відкритті
    useEffect(() => {
        if (isOpen && initialData) {
            setFormData({
                fullName: initialData.fullName || "",
                profilePic: initialData.profilePic || ""
            });

            // Автофокус на полі імені
            setTimeout(() => {
                if (nameInputRef.current) {
                    nameInputRef.current.focus();
                    nameInputRef.current.select();
                }
            }, 100);
        }
    }, [isOpen, initialData]);

    // Обробка хоткізів
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyPress = (event) => {
            // ESC для закриття
            if (event.key === "Escape") {
                event.preventDefault();
                if (!isLoading) {
                    handleCancel();
                }
                return;
            }

            // ENTER для збереження (тільки якщо не в textarea або якщо з Ctrl)
            if (event.key === "Enter") {
                const activeElement = document.activeElement;
                const isTextArea = activeElement && activeElement.tagName === "TEXTAREA";
                const isCtrlPressed = event.ctrlKey || event.metaKey;

                if (!isTextArea || isCtrlPressed) {
                    event.preventDefault();
                    if (!isLoading) {
                        handleSave();
                    }
                }
                return;
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [isOpen, isLoading, formData]);

    const handleSave = async () => {
        // Валідація
        if (!formData.fullName || !formData.fullName.trim()) {
            toast.error("Ім'я не може бути порожнім");
            nameInputRef.current?.focus();
            return;
        }

        if (formData.fullName.trim().length < 2) {
            toast.error("Ім'я повинно містити принаймні 2 символи");
            nameInputRef.current?.focus();
            return;
        }

        if (formData.fullName.trim().length > 50) {
            toast.error("Ім'я не може містити більше 50 символів");
            nameInputRef.current?.focus();
            return;
        }

        try {
            await onSave(formData);
            // onClose викликається в батьківському компоненті після успішного збереження
        } catch (error) {
            console.log(error)
        }
    };

    const handleCancel = () => {
        // Повертаємо оригінальні дані
        if (initialData) {
            setFormData({
                fullName: initialData.fullName || "",
                profilePic: initialData.profilePic || ""
            });
        }
        onClose();
    };

    const handleNameChange = (e) => {
        const value = e.target.value;

        setFormData(prev => ({
            ...prev,
            fullName: value
        }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Перевірка типу файлу
        if (!file.type.startsWith('image/')) {
            toast.error("Будь ласка, оберіть файл зображення");
            return;
        }

        // Перевірка розміру файлу (максимум 5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Розмір файлу не повинен перевищувати 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setFormData(prev => ({
                ...prev,
                profilePic: e.target.result
            }));
        };
        reader.onerror = () => {
            toast.error("Помилка читання файлу");
        };
        reader.readAsDataURL(file);
    };

    const removeProfilePic = () => {
        setFormData(prev => ({
            ...prev,
            profilePic: ""
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600/80 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-8 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50 rounded-t-2xl flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                Редагувати профіль
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Оновіть свою інформацію профілю
                            </p>
                        </div>
                        <button
                            onClick={handleCancel}
                            disabled={isLoading}
                            className="text-gray-400 hover:text-gray-600 p-2 transition-colors disabled:cursor-not-allowed hover:bg-gray-100 rounded-full cursor-pointer"
                            title="Закрити (Esc)"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-8 space-y-6">
                        {/* Profile Picture Section */}
                        <div className="text-center">
                            <div className="relative inline-block">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-r from-orange-100 to-red-100 overflow-hidden mx-auto shadow-md">
                                    {formData.profilePic ? (
                                        <img
                                            src={formData.profilePic}
                                            alt="Profile Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <User className="w-12 h-12 text-orange-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Upload Button */}
                                <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg">
                                    <Camera className="w-4 h-4 text-white" />
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                        disabled={isLoading}
                                    />
                                </label>
                            </div>

                            {/* Image Actions */}
                            <div className="mt-3 space-y-2">
                                <p className="text-xs text-gray-500">
                                    Натисніть на камеру, щоб змінити фото
                                </p>
                                {formData.profilePic && (
                                    <button
                                        type="button"
                                        onClick={removeProfilePic}
                                        disabled={isLoading}
                                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                                    >
                                        Видалити фото
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Name Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Повне ім'я <span className="text-red-500">*</span>
                            </label>
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={formData.fullName}
                                onChange={handleNameChange}
                                placeholder="Введіть ваше повне ім'я"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                                maxLength={50}
                                required
                                disabled={isLoading}
                            />
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-gray-500">
                                    {formData.fullName.length}/50 символів
                                </p>
                                {formData.fullName.length < 2 && formData.fullName.length > 0 && (
                                    <p className="text-xs text-red-500">
                                        Мінімум 2 символи
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* File Upload Info */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="text-xs text-blue-700">
                                <p className="font-medium mb-1">Вимоги до зображення:</p>
                                <ul className="space-y-1">
                                    <li>• Формат: JPEG, PNG, WebP</li>
                                    <li>• Максимальний розмір: 5MB</li>
                                    <li>• Рекомендований розмір: 400x400px</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50 rounded-b-2xl flex-shrink-0">
                    <div className="flex space-x-3">
                        <button
                            onClick={handleSave}
                            disabled={isLoading || !formData.fullName.trim() || formData.fullName.trim().length < 2}
                            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-70 text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 disabled:cursor-default shadow-md hover:shadow-lg transform hover:scale-102 cursor-pointer"
                            title="Зберегти зміни (Enter)"
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    <span>Зберегти</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={isLoading}
                            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 rounded-lg font-medium transition-all duration-200 disabled:cursor-default hover:shadow cursor-pointer"
                            title="Скасувати (Esc)"
                        >
                            Скасувати
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileEditModal;