import { useState, useEffect } from "react";
import { Save, X, Folder } from "lucide-react";
import { useCategoryStore } from "../store/useCategoryStore.js";

const CategoryForm = ({ isOpen, onClose, editingCategory, isLoading }) => {
    const { createCategory, updateCategory, getCategoryColors } = useCategoryStore();

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        color: "#3B82F6"
    });

    const colors = getCategoryColors();

    useEffect(() => {
        if (editingCategory) {
            setFormData({
                name: editingCategory.name || "",
                description: editingCategory.description || "",
                color: editingCategory.color || "#3B82F6"
            });
        } else {
            setFormData({
                name: "",
                description: "",
                color: "#3B82F6"
            });
        }
    }, [editingCategory, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        try {
            if (editingCategory) {
                await updateCategory(editingCategory._id, formData);
            } else {
                await createCategory(formData);
            }
            onClose();
        } catch (error) {
            console.error('Error submitting category form:', error);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Keyboard handler for ESC
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyPress = (event) => {
            // ESC для закриття форми
            if (event.key === "Escape") {
                event.preventDefault();
                if (!isLoading) {
                    onClose();
                }
                return;
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [isOpen, isLoading, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900/60 via-blue-900/40 to-indigo-900/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
                {/* Fixed Header */}
                <div className="sticky top-0 bg-white p-8 border-b border-blue-100 rounded-t-2xl z-10 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <div
                                className="w-12 h-12 rounded-lg flex items-center justify-center"
                                style={{
                                    background: `linear-gradient(135deg, ${formData.color}, ${formData.color}dd)`
                                }}
                            >
                                <Folder className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    {editingCategory ? "Редагувати папку" : "Створити папку"}
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    {editingCategory ? "Оновіть інформацію" : "Додайте нову папку"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 hover:bg-white/80 p-2 rounded-xl transition-all duration-200 hover:scale-110 cursor-pointer"
                            title="Закрити (Esc)"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto bg-white">
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Назва папки <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Введіть назву папки..."
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                                required
                                maxLength={100}
                            />
                            <p className="text-xs text-gray-500 mt-2 flex items-center">
                                <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                                Максимум 100 символів
                            </p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-3">
                                Опис (опціонально)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                placeholder="Короткий опис папки..."
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all duration-200 bg-white hover:border-gray-300 text-gray-900 placeholder-gray-500"
                                rows="3"
                                maxLength={500}
                            />
                            <p className="text-xs text-gray-500 mt-2 flex items-center">
                                <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                                Максимум 500 символів
                            </p>
                        </div>

                        {/* Color */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-4">
                                Колір папки
                            </label>
                            <div className="grid grid-cols-5 gap-3">
                                {colors.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => handleInputChange('color', color)}
                                        className={`w-14 h-14 rounded-xl border-3 transition-all duration-200 hover:shadow-md transform hover:scale-110 ${
                                            formData.color === color
                                                ? 'border-white scale-110 shadow-md'
                                                : 'border-white hover:border-gray-200'
                                        }`}
                                        style={{
                                            background: `linear-gradient(135deg, ${color}, ${color}dd)`
                                        }}
                                        title={`Вибрати колір ${color}`}
                                    >
                                        {formData.color === color && (
                                            <div className="w-full h-full rounded-lg flex items-center justify-center">
                                                <div className="w-3 h-3 bg-white rounded-full"></div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="sticky bottom-0 bg-white p-8 border-t border-gray-100 rounded-b-2xl flex-shrink-0">
                    <div className="flex space-x-3">
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={isLoading || !formData.name.trim()}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-blue-300 disabled:to-blue-400 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:cursor-default disabled:hover:scale-100 cursor-pointer"
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    <span>{editingCategory ? "Зберегти зміни" : "Створити папку"}</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-6 py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 disabled:from-gray-100 disabled:to-gray-100 text-gray-700 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none border border-gray-200 cursor-pointer"
                        >
                            Скасувати
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryForm;