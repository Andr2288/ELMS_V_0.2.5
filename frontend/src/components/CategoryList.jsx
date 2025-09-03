// frontend/src/components/CategoryList.jsx - ВИПРАВЛЕНО РОЗРАХУНОК ПРОГРЕСУ

import React, { useState, useEffect } from "react";
import {
    Folder,
    Edit,
    Trash2,
    Plus,
    ChevronDown,
    Calendar,
    SortAsc,
    TrendingUp,
    BookOpen,
    CheckCircle,
    Clock
} from "lucide-react";
import { useCategoryStore } from "../store/useCategoryStore.js";
import { useFlashcardStore } from "../store/useFlashcardStore.js";
import { useUserSettingsStore } from "../store/useUserSettingsStore.js"; // ДОДАНО
import CategoryForm from "./CategoryForm.jsx";
import ConfirmDeleteCategoryModal from "./ConfirmDeleteCategoryModal.jsx";

const CategoryList = ({ onCategorySelect, selectedCategoryId, uncategorizedCount = 0 }) => {
    const { categories, isLoading, deleteCategory } = useCategoryStore();
    const { flashcards, getFlashcards } = useFlashcardStore();
    const { updateSetting, getGeneralSettings } = useUserSettingsStore(); // ДОДАНО

    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ОНОВЛЕНО: Отримуємо сортування з налаштувань користувача
    const generalSettings = getGeneralSettings();
    const [sortBy, setSortBy] = useState(generalSettings.categorySortBy || "date");
    const [sortOrder, setSortOrder] = useState(generalSettings.categorySortOrder || "desc");

    // Delete confirmation modal states
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Category progress cache
    const [categoryProgress, setCategoryProgress] = useState({});
    const [isLoadingProgress, setIsLoadingProgress] = useState(false);

    // НОВИЙ МЕТОД: Розрахунок точного прогресу з урахуванням вправ
    const calculateDetailedProgress = React.useCallback((categoryCards) => {
        if (!categoryCards || categoryCards.length === 0) {
            return {
                total: 0,
                review: 0,
                learning: 0,
                new: 0,
                percentage: 0,
                totalExercises: 0,
                completedExercises: 0
            };
        }

        const totalCards = categoryCards.length;
        const reviewCards = categoryCards.filter(card => card.status === 'review').length;
        const learningCards = categoryCards.filter(card => card.status === 'learning').length;
        const newCards = Math.max(0, totalCards - reviewCards - learningCards);

        // ГОЛОВНЕ ВИПРАВЛЕННЯ: Розрахунок прогресу на базі індивідуальних вправ
        const totalPossibleExercises = totalCards * 4; // 4 основні вправи на картку
        let completedExercises = 0;

        categoryCards.forEach(card => {
            // Рахуємо завершені основні вправи для кожної картки
            let cardExercises = 0;
            if (card.isSentenceCompletionExercise) cardExercises++;
            if (card.isMultipleChoiceExercise) cardExercises++;
            if (card.isListenAndFillExercise) cardExercises++;
            if (card.isListenAndChooseExercise) cardExercises++;

            completedExercises += cardExercises;
        });

        const detailedPercentage = totalPossibleExercises > 0
            ? Math.round((completedExercises / totalPossibleExercises) * 100)
            : 0;

        return {
            total: totalCards,
            review: reviewCards,
            learning: learningCards,
            new: newCards,
            percentage: detailedPercentage, // ВИКОРИСТОВУЄМО ДЕТАЛЬНИЙ РОЗРАХУНОК
            totalExercises: totalPossibleExercises,
            completedExercises: completedExercises
        };
    }, []);

    // Load category progress function з новою логікою
    const loadCategoryProgress = React.useCallback(async () => {
        setIsLoadingProgress(true);
        try {
            await getFlashcards();
            const currentFlashcards = useFlashcardStore.getState().flashcards;
            const currentCategories = useCategoryStore.getState().categories;

            const progressMap = {};

            // ОНОВЛЕНО: Використовуємо новий метод розрахунку для кожної категорії
            for (const category of currentCategories) {
                const categoryCards = currentFlashcards.filter(card =>
                    card.categoryId && card.categoryId._id === category._id
                );
                progressMap[category._id] = calculateDetailedProgress(categoryCards);
            }

            // ОНОВЛЕНО: Розрахунок для uncategorized
            const uncategorizedCards = currentFlashcards.filter(card => !card.categoryId);
            progressMap['uncategorized'] = calculateDetailedProgress(uncategorizedCards);

            // ОНОВЛЕНО: Розрахунок для всіх категорій
            progressMap['all'] = calculateDetailedProgress(currentFlashcards);

            setCategoryProgress(progressMap);
        } catch (error) {
            console.error("Error loading category progress:", error);
        } finally {
            setIsLoadingProgress(false);
        }
    }, [calculateDetailedProgress]);

    // Load all flashcards to calculate progress
    useEffect(() => {
        loadCategoryProgress();
    }, [loadCategoryProgress]);

    // ОНОВЛЕНО: Пересчитываем прогресс с новой логикой при изменении flashcards
    useEffect(() => {
        if (categories.length > 0 && flashcards.length >= 0) {
            const progressMap = {};

            for (const category of categories) {
                const categoryCards = flashcards.filter(card =>
                    card.categoryId && card.categoryId._id === category._id
                );
                progressMap[category._id] = calculateDetailedProgress(categoryCards);
            }

            const uncategorizedCards = flashcards.filter(card => !card.categoryId);
            progressMap['uncategorized'] = calculateDetailedProgress(uncategorizedCards);

            progressMap['all'] = calculateDetailedProgress(flashcards);

            setCategoryProgress(progressMap);
        }
    }, [flashcards, categories, calculateDetailedProgress]);

    const handleEdit = (category, e) => {
        e.stopPropagation();
        setEditingCategory(category);
        setShowForm(true);
    };

    const handleDeleteClick = (category, e) => {
        e.stopPropagation();
        setCategoryToDelete(category);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!categoryToDelete) return;

        setIsDeleting(true);
        try {
            await deleteCategory(categoryToDelete._id);
            setShowDeleteModal(false);
            setCategoryToDelete(null);
            loadCategoryProgress();
        } catch (error) {
            // Error handling is done in the store
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        if (!isDeleting) {
            setShowDeleteModal(false);
            setCategoryToDelete(null);
        }
    };

    const handleFormSubmit = async () => {
        setIsSubmitting(true);
        try {
            setTimeout(() => {
                loadCategoryProgress();
            }, 500);
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingCategory(null);
    };

    const handleCategoryClick = (category) => {
        onCategorySelect(category);
    };

    // ОНОВЛЕНО: Зберігаємо сортування в налаштуваннях
    const handleSortChange = (newSortBy) => {
        let newSortOrder = sortOrder;

        if (sortBy === newSortBy) {
            newSortOrder = sortOrder === "asc" ? "desc" : "asc";
        } else {
            setSortBy(newSortBy);
            newSortOrder = newSortBy === "alphabet" ? "asc" : "desc";
        }

        setSortBy(newSortBy);
        setSortOrder(newSortOrder);

        // ЗБЕРІГАЄМО В НАЛАШТУВАННЯХ
        updateSetting('generalSettings.categorySortBy', newSortBy);
        updateSetting('generalSettings.categorySortOrder', newSortOrder);
    };

    const getSortedCategories = () => {
        const sorted = [...categories].sort((a, b) => {
            if (sortBy === "alphabet") {
                const comparison = a.name.localeCompare(b.name, 'uk');
                return sortOrder === "asc" ? comparison : -comparison;
            } else {
                // Sort by date
                const aDate = new Date(a.createdAt);
                const bDate = new Date(b.createdAt);
                return sortOrder === "desc" ? bDate - aDate : aDate - bDate;
            }
        });
        return sorted;
    };

    const getProgressInfo = (categoryId) => {
        return categoryProgress[categoryId] || {
            total: 0,
            review: 0,
            learning: 0,
            new: 0,
            percentage: 0,
            totalExercises: 0,
            completedExercises: 0
        };
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('uk-UA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // ДОДАНО: Детальна інформація про прогрес для tooltip
    const getProgressTooltip = (progress) => {
        if (progress.total === 0) return "Немає карток";

        return `${progress.completedExercises} з ${progress.totalExercises} вправ завершено\n` +
            `Картки: ${progress.review} завершено, ${progress.learning} вивчається, ${progress.new} нових`;
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (event) => {
            const isModalOpen = document.querySelector('.fixed.inset-0.bg-gray-600\\/80');
            if (isModalOpen) return;

            const activeElement = document.activeElement;
            const isInputField =
                activeElement &&
                (activeElement.tagName === "INPUT" ||
                    activeElement.tagName === "TEXTAREA" ||
                    activeElement.tagName === "SELECT" ||
                    activeElement.contentEditable === "true");

            if (isInputField) return;

            if (event.ctrlKey && event.code === "Space") {
                event.preventDefault();
                setShowForm(true);
                return;
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, []);

    const CategoryRow = ({ categoryData, isSelected, onClick, canEdit, onEdit, onDelete }) => {
        const progress = getProgressInfo(categoryData._id);

        return (
            <div
                onClick={onClick}
                className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 group ${
                    isSelected
                        ? 'ring-2 ring-opacity-50 shadow-md'
                        : 'border-l-transparent hover:border-l-4'
                }`}
                style={{
                    borderLeftColor: isSelected ? categoryData.color : undefined,
                    '--tw-ring-color': categoryData.color + '40',
                }}
                onMouseEnter={(e) => {
                    if (!isSelected) {
                        e.currentTarget.style.borderLeftColor = categoryData.color;
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isSelected) {
                        e.currentTarget.style.borderLeftColor = 'transparent';
                    }
                }}
            >
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        {/* Left side - Main info */}
                        <div className="flex items-center space-x-4 flex-1">
                            {/* Category icon */}
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                                style={{
                                    background: `linear-gradient(135deg, ${categoryData.color}, ${categoryData.color}cc)`
                                }}
                            >
                                <Folder className="w-6 h-6 text-white" />
                            </div>

                            {/* Category details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-3 mb-1">
                                    <h3 className="text-lg font-bold text-gray-900 truncate">
                                        {categoryData.name}
                                    </h3>
                                    {categoryData._id !== 'all' && categoryData._id !== 'uncategorized' && (
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                            {formatDate(categoryData.createdAt || categoryData.dateText)}
                                        </span>
                                    )}
                                </div>

                                {categoryData.description && (
                                    <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                                        {categoryData.description}
                                    </p>
                                )}

                                <div className="flex items-center space-x-4 text-sm">
                                    {/* Cards count */}
                                    <div className="flex items-center space-x-1 text-gray-700">
                                        <BookOpen className="w-4 h-4" />
                                        <span className="font-medium">
                                            {categoryData.flashcardsCount || progress.total} {
                                            (categoryData.flashcardsCount || progress.total) % 100 >= 11 && (categoryData.flashcardsCount || progress.total) % 100 <= 14
                                                ? 'карток'
                                                : (categoryData.flashcardsCount || progress.total) % 10 === 1
                                                    ? 'картка'
                                                    : (categoryData.flashcardsCount || progress.total) % 10 >= 2 && (categoryData.flashcardsCount || progress.total) % 10 <= 4
                                                        ? 'картки'
                                                        : 'карток'
                                        }
                                        </span>
                                    </div>

                                    {/* Progress indicators */}
                                    {progress.total > 0 && (
                                        <>
                                            <div className="flex items-center space-x-1 text-green-600">
                                                <CheckCircle className="w-4 h-4" />
                                                <span className="font-medium">{progress.review}</span>
                                            </div>

                                            <div className="flex items-center space-x-1 text-blue-600">
                                                <Clock className="w-4 h-4" />
                                                <span className="font-medium">{progress.learning}</span>
                                            </div>

                                            {progress.new > 0 && (
                                                <div className="flex items-center space-x-1 text-gray-500">
                                                    <span className="w-4 h-4 flex items-center justify-center">•</span>
                                                    <span className="font-medium">{progress.new} нових</span>
                                                </div>
                                            )}

                                            {/* ДОДАНО: Показуємо загальну кількість вправ */}
                                            <div className="flex items-center space-x-1 text-purple-600">
                                                <TrendingUp className="w-4 h-4" />
                                                <span className="font-medium text-xs">
                                                    {progress.completedExercises}/{progress.totalExercises} вправ
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right side - Progress and actions */}
                        <div className="flex items-center space-x-6">
                            {/* ОНОВЛЕНО: Progress circle з tooltip */}
                            {progress.total > 0 && (
                                <div className="flex items-center space-x-3">
                                    <div
                                        className="relative w-16 h-16"
                                        title={getProgressTooltip(progress)}
                                    >
                                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                                            <path
                                                className="text-gray-200"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            />
                                            <path
                                                className="text-current"
                                                fill="none"
                                                stroke={categoryData.color}
                                                strokeWidth="2"
                                                strokeDasharray={`${progress.percentage}, 100`}
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-sm font-bold text-gray-700">
                                                {progress.percentage}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action buttons */}
                            {canEdit && (
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => onEdit(categoryData, e)}
                                        className="p-2 bg-white hover:bg-blue-50 text-blue-600 rounded-lg shadow-sm border border-gray-200 transition-colors"
                                        title="Редагувати"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => onDelete(categoryData, e)}
                                        className="p-2 bg-white hover:bg-red-50 text-red-600 rounded-lg shadow-sm border border-gray-200 transition-colors"
                                        title="Видалити"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Prepare system categories data
    const allProgress = getProgressInfo('all');
    const allCategoriesData = {
        _id: 'all',
        name: 'Всі картки',
        description: 'Показати всі флешкартки разом',
        color: '#3B82F6',
        flashcardsCount: allProgress.total,
        createdAt: new Date().toISOString()
    };

    const uncategorizedProgress = getProgressInfo('uncategorized');
    const uncategorizedData = {
        _id: 'uncategorized',
        name: 'Без папки',
        description: 'Картки які не належать до жодної папки',
        color: '#059669',
        flashcardsCount: uncategorizedProgress.total,
        createdAt: new Date().toISOString()
    };

    const sortedCategories = getSortedCategories();

    return (
        <div>
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="p-8">
                    <div className="mx-auto flex justify-between items-center">
                        <div className="flex flex-row items-center">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 w-10 h-10 text-white rounded-lg flex items-center justify-center mr-3 shadow-md">
                                <Folder className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Папки</h2>
                                <p className="text-gray-600">Організуйте свої флешкартки по папках</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            {/* Sort controls */}
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-gray-600">Сортувати:</span>
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => handleSortChange("date")}
                                        className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
                                            sortBy === "date"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-gray-600 hover:text-gray-900"
                                        }`}
                                    >
                                        <Calendar className="w-4 h-4" />
                                        <span>Дата</span>
                                        {sortBy === "date" && (
                                            <ChevronDown className={`w-3 h-3 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleSortChange("alphabet")}
                                        className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${
                                            sortBy === "alphabet"
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-gray-600 hover:text-gray-900"
                                        }`}
                                    >
                                        <SortAsc className="w-4 h-4" />
                                        <span>А-Я</span>
                                        {sortBy === "alphabet" && (
                                            <ChevronDown className={`w-3 h-3 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowForm(true)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                                title="Створити нову папку (Ctrl + Space)"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Нова папка</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories List */}
            <div className="px-30 py-8 space-y-4">
                {/* System Categories */}
                <div className="space-y-4">
                    <CategoryRow
                        categoryData={allCategoriesData}
                        isSelected={!selectedCategoryId}
                        onClick={() => onCategorySelect(null)}
                        canEdit={false}
                    />

                    <CategoryRow
                        categoryData={uncategorizedData}
                        isSelected={selectedCategoryId === 'uncategorized'}
                        onClick={() => onCategorySelect({ _id: 'uncategorized', name: 'Без папки' })}
                        canEdit={false}
                    />
                </div>

                {/* Separator */}
                {sortedCategories.length > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                        <h3 className="text-sm font-medium text-gray-500 mb-3">
                            Мої папки ({sortedCategories.length})
                        </h3>
                    </div>
                )}

                {/* User Categories */}
                <div className="space-y-3">
                    {isLoadingProgress && sortedCategories.length > 0 && (
                        <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600">Завантаження...</p>
                        </div>
                    )}

                    {sortedCategories.map((category) => {
                        const categoryData = {
                            ...category,
                            flashcardsCount: category.flashcardsCount || 0
                        };

                        return (
                            <CategoryRow
                                key={category._id}
                                categoryData={categoryData}
                                isSelected={selectedCategoryId === category._id}
                                onClick={() => handleCategoryClick(category)}
                                canEdit={true}
                                onEdit={handleEdit}
                                onDelete={handleDeleteClick}
                            />
                        );
                    })}
                </div>

                {/* Empty State */}
                {sortedCategories.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-xl shadow-sm">
                        <div className="text-blue-400 mb-4">
                            <Folder className="w-16 h-16 mx-auto" />
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 mb-2">Немає папок</h3>
                        <p className="text-gray-600 mb-6">Створіть свою першу папку для організації карток</p>

                        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mb-6">
                            <span>Швидке створення:</span>
                            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">Ctrl</kbd>
                            <span>+</span>
                            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">Space</kbd>
                        </div>

                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl inline-flex items-center space-x-2 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Створити папку</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Category Form Modal */}
            <CategoryForm
                isOpen={showForm}
                onClose={closeForm}
                editingCategory={editingCategory}
                isLoading={isSubmitting}
                onSubmit={handleFormSubmit}
            />

            {/* Delete Confirmation Modal for Categories */}
            <ConfirmDeleteCategoryModal
                isOpen={showDeleteModal}
                onClose={handleDeleteCancel}
                onConfirm={handleDeleteConfirm}
                category={categoryToDelete}
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default CategoryList;