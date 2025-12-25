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

    // Utility functions
    getCategoryById: (id) => {
        return get().categories.find(cat => cat._id === id);
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
    }
}));