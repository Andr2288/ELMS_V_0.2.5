// frontend/src/store/useCategoryStore.js

import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";

export const useCategoryStore = create((set, get) => ({
    categories: [],
    isLoading: false,
    selectedCategory: null,

    getCategories: async () => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.get("/categories");
            set({ categories: res.data });
        } catch (error) {
            console.log("Error getting categories:", error);
            toast.error("Помилка завантаження папок");
        } finally {
            set({ isLoading: false });
        }
    },

    createCategory: async (categoryData) => {
        try {
            const res = await axiosInstance.post("/categories", categoryData);
            set({ categories: [res.data, ...get().categories] });
            toast.success("Папку створено!");
            return res.data;
        } catch (error) {
            console.log("Error creating category:", error);

            // Better error handling
            const message = error.response?.data?.message || "Помилка створення папки";
            toast.error(message);
            throw error;
        }
    },

    updateCategory: async (id, categoryData) => {
        try {
            const res = await axiosInstance.put(`/categories/${id}`, categoryData);
            set({
                categories: get().categories.map((cat) =>
                    cat._id === id ? res.data : cat
                ),
            });
            toast.success("Папку оновлено!");
            return res.data;
        } catch (error) {
            console.log("Error updating category:", error);

            const message = error.response?.data?.message || "Помилка оновлення папки";
            toast.error(message);
            throw error;
        }
    },

    deleteCategory: async (id) => {
        try {
            const res = await axiosInstance.delete(`/categories/${id}`);

            // Remove category from state
            set({
                categories: get().categories.filter((cat) => cat._id !== id),
            });

            // Clear selected category if it was deleted
            if (get().selectedCategory?._id === id) {
                set({ selectedCategory: null });
            }

            // Show success message with info about deleted flashcards
            const deletedFlashcardsCount = res.data.deletedFlashcardsCount || 0;
            if (deletedFlashcardsCount > 0) {
                toast.success(`Папку видалено разом з ${deletedFlashcardsCount} картками!`);
            } else {
                toast.success("Папку видалено!");
            }

            // If we're using a global flashcard store, we should also trigger refresh there
            // This is a bit of coupling, but necessary for keeping data in sync
            if (window.refreshFlashcards) {
                window.refreshFlashcards();
            }

            return res.data;
        } catch (error) {
            console.log("Error deleting category:", error);

            const message = error.response?.data?.message || "Помилка видалення папки";
            toast.error(message);
            throw error;
        }
    },

    getCategoryWithFlashcards: async (id) => {
        set({ isLoading: true });
        try {
            const res = await axiosInstance.get(`/categories/${id}/flashcards`);
            return res.data;
        } catch (error) {
            console.log("Error getting category with flashcards:", error);
            toast.error("Помилка завантаження папки");
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    moveFlashcards: async (flashcardIds, targetCategoryId) => {
        try {
            const res = await axiosInstance.post("/categories/move-flashcards", {
                flashcardIds,
                targetCategoryId
            });

            toast.success(res.data.message);
            return res.data;
        } catch (error) {
            console.log("Error moving flashcards:", error);

            const message = error.response?.data?.message || "Помилка переміщення карток";
            toast.error(message);
            throw error;
        }
    },

    setSelectedCategory: (category) => {
        set({ selectedCategory: category });
    },

    // ДОДАНО: Utility functions для роботи з прогресом категорій
    calculateCategoryProgress: (categoryId, flashcards) => {
        let categoryCards = [];

        if (categoryId === 'all') {
            categoryCards = flashcards;
        } else if (categoryId === 'uncategorized') {
            categoryCards = flashcards.filter(card => !card.categoryId);
        } else {
            categoryCards = flashcards.filter(card =>
                card.categoryId && card.categoryId._id === categoryId
            );
        }

        const total = categoryCards.length;
        const review = categoryCards.filter(card => card.status === 'review').length;
        const learning = categoryCards.filter(card => card.status === 'learning').length;
        const newCards = total - review - learning;

        return {
            total,
            review,
            learning,
            new: Math.max(0, newCards), // Ensure non-negative
            percentage: total > 0 ? Math.round((review / total) * 100) : 0
        };
    },

    calculateAllCategoriesProgress: (flashcards) => {
        const categories = get().categories;
        const progressMap = {};

        // Calculate for system categories
        progressMap['all'] = get().calculateCategoryProgress('all', flashcards);
        progressMap['uncategorized'] = get().calculateCategoryProgress('uncategorized', flashcards);

        // Calculate for user categories
        categories.forEach(category => {
            progressMap[category._id] = get().calculateCategoryProgress(category._id, flashcards);
        });

        return progressMap;
    },

    sortCategories: (categories, sortBy = 'date', sortOrder = 'desc') => {
        return [...categories].sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'alphabet') {
                comparison = a.name.localeCompare(b.name, 'uk', {
                    numeric: true,
                    sensitivity: 'base'
                });
            } else if (sortBy === 'date') {
                const aDate = new Date(a.createdAt);
                const bDate = new Date(b.createdAt);
                comparison = aDate - bDate;
            } else if (sortBy === 'flashcards') {
                // Sort by flashcard count
                comparison = (a.flashcardsCount || 0) - (b.flashcardsCount || 0);
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });
    },

    getCategoriesTotalFlashcards: () => {
        return get().categories.reduce((total, cat) => total + (cat.flashcardsCount || 0), 0);
    },

    getCategoriesWithProgress: (flashcards) => {
        const categories = get().categories;
        const progressMap = get().calculateAllCategoriesProgress(flashcards);

        return categories.map(category => ({
            ...category,
            progress: progressMap[category._id]
        }));
    },

    // Utility functions
    getCategoryById: (id) => {
        return get().categories.find(cat => cat._id === id);
    },

    getCategoryByName: (name) => {
        return get().categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
    },

    getCategoryColors: () => {
        return [
            "#3B82F6", // Blue
            "#EF4444", // Red
            "#10B981", // Green
            "#F59E0B", // Yellow
            "#8B5CF6", // Purple
            "#EC4899", // Pink
            "#14B8A6", // Teal
            "#F97316", // Orange
            "#6366F1", // Indigo
            "#84CC16", // Lime
            "#F472B6", // Rose
            "#06B6D4", // Cyan
            "#8B5CF6", // Violet
            "#D97706", // Amber
            "#65A30D", // Green-600
        ];
    },

    getNextAvailableColor: () => {
        const colors = get().getCategoryColors();
        const usedColors = get().categories.map(cat => cat.color);

        // Find first unused color
        const availableColor = colors.find(color => !usedColors.includes(color));

        // If all colors are used, return a random one
        return availableColor || colors[Math.floor(Math.random() * colors.length)];
    },

    getCategoryStats: () => {
        const categories = get().categories;
        const totalCategories = categories.length;
        const totalFlashcards = get().getCategoriesWithProgress();

        return {
            totalCategories,
            totalFlashcards: totalFlashcards.length,
            averageFlashcardsPerCategory: totalCategories > 0 ?
                Math.round(totalFlashcards.length / totalCategories) : 0
        };
    },

    searchCategories: (query) => {
        if (!query.trim()) return get().categories;

        const searchTerm = query.toLowerCase().trim();
        return get().categories.filter(category =>
            category.name.toLowerCase().includes(searchTerm) ||
            (category.description && category.description.toLowerCase().includes(searchTerm))
        );
    },

    // Method to refresh categories (useful when called from other stores)
    refreshCategories: () => {
        get().getCategories();
    },

    // ДОДАНО: Methods for better UX
    formatCategoryDate: (dateString) => {
        if (!dateString) return '';

        return new Date(dateString).toLocaleDateString('uk-UA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    formatFlashcardCount: (count) => {
        if (count === 0) return 'Немає карток';

        const num = count || 0;

        if (num % 100 >= 11 && num % 100 <= 14) {
            return `${num} карток`;
        }

        switch (num % 10) {
            case 1:
                return `${num} картка`;
            case 2:
            case 3:
            case 4:
                return `${num} картки`;
            default:
                return `${num} карток`;
        }
    },

    getProgressDescription: (progress) => {
        if (!progress || progress.total === 0) {
            return 'Немає карток для вивчення';
        }

        if (progress.percentage === 100) {
            return 'Всі слова вивчено!';
        }

        if (progress.percentage === 0) {
            return 'Почніть вивчення слів';
        }

        return `${progress.review} з ${progress.total} слів вивчено`;
    },

    // ДОДАНО: Category validation
    validateCategoryName: (name, excludeId = null) => {
        if (!name || !name.trim()) {
            return { valid: false, message: 'Назва папки не може бути пустою' };
        }

        const trimmedName = name.trim();

        if (trimmedName.length < 2) {
            return { valid: false, message: 'Назва папки має містити щонайменше 2 символи' };
        }

        if (trimmedName.length > 50) {
            return { valid: false, message: 'Назва папки не може перевищувати 50 символів' };
        }

        // Check for duplicate names
        const existingCategory = get().categories.find(cat =>
            cat._id !== excludeId && cat.name.toLowerCase() === trimmedName.toLowerCase()
        );

        if (existingCategory) {
            return { valid: false, message: 'Папка з такою назвою вже існує' };
        }

        return { valid: true };
    },

    // ДОДАНО: Bulk operations
    bulkUpdateCategories: async (updates) => {
        try {
            const res = await axiosInstance.put('/categories/bulk-update', { updates });

            // Update categories in state
            const updatedCategories = get().categories.map(category => {
                const update = updates.find(u => u.id === category._id);
                return update ? { ...category, ...update.data } : category;
            });

            set({ categories: updatedCategories });

            toast.success(`Оновлено ${updates.length} папок`);
            return res.data;
        } catch (error) {
            console.error('Error bulk updating categories:', error);
            toast.error('Помилка масового оновлення папок');
            throw error;
        }
    }
}));