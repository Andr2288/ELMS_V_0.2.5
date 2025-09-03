// backend/src/controllers/category.controller.js

import Category from "../models/category.model.js";
import Flashcard from "../models/flashcard.model.js";

const createCategory = async (req, res) => {
    try {
        const { name, description, color } = req.body;
        const userId = req.user._id;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Name is required" });
        }

        // Check if category with this name already exists for this user
        const existingCategory = await Category.findOne({
            userId,
            name: name.trim()
        });

        if (existingCategory) {
            return res.status(400).json({
                message: "Category with this name already exists"
            });
        }

        const newCategory = new Category({
            name: name.trim(),
            description: description?.trim() || "",
            color: color || "#3B82F6",
            userId,
        });

        await newCategory.save();

        return res.status(201).json(newCategory);
    } catch (error) {
        console.log("Error in createCategory controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

const getCategories = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get categories with flashcard count
        const categories = await Category.aggregate([
            { $match: { userId: userId } },
            {
                $lookup: {
                    from: "flashcards",
                    localField: "_id",
                    foreignField: "categoryId",
                    as: "flashcards"
                }
            },
            {
                $addFields: {
                    flashcardsCount: { $size: "$flashcards" }
                }
            },
            {
                $project: {
                    flashcards: 0 // Don't return the actual flashcards
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        return res.status(200).json(categories);
    } catch (error) {
        console.log("Error in getCategories controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color } = req.body;
        const userId = req.user._id;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Name is required" });
        }

        const category = await Category.findOne({ _id: id, userId });

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        // Check if category with this name already exists (excluding current category)
        const existingCategory = await Category.findOne({
            userId,
            name: name.trim(),
            _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(400).json({
                message: "Category with this name already exists"
            });
        }

        category.name = name.trim();
        category.description = description?.trim() || "";
        if (color) category.color = color;

        await category.save();

        return res.status(200).json(category);
    } catch (error) {
        console.log("Error in updateCategory controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const category = await Category.findOne({ _id: id, userId });

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        // Count flashcards in this category
        const flashcardsCount = await Flashcard.countDocuments({
            categoryId: id,
            userId
        });

        // Delete all flashcards in this category first
        if (flashcardsCount > 0) {
            await Flashcard.deleteMany({
                categoryId: id,
                userId
            });
        }

        // Then delete the category
        await Category.findOneAndDelete({ _id: id, userId });

        return res.status(200).json({
            message: "Category deleted",
            deletedFlashcardsCount: flashcardsCount
        });
    } catch (error) {
        console.log("Error in deleteCategory controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

const getCategoryWithFlashcards = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const category = await Category.findOne({ _id: id, userId });

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        const flashcards = await Flashcard.find({
            categoryId: id,
            userId
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            category,
            flashcards
        });
    } catch (error) {
        console.log("Error in getCategoryWithFlashcards controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// Move flashcards from one category to another
const moveFlashcards = async (req, res) => {
    try {
        const { flashcardIds, targetCategoryId } = req.body;
        const userId = req.user._id;

        if (!flashcardIds || !Array.isArray(flashcardIds)) {
            return res.status(400).json({ message: "Flashcard IDs are required" });
        }

        // Verify target category exists (or null for uncategorized)
        if (targetCategoryId) {
            const targetCategory = await Category.findOne({
                _id: targetCategoryId,
                userId
            });
            if (!targetCategory) {
                return res.status(404).json({ message: "Target category not found" });
            }
        }

        // Update flashcards
        const result = await Flashcard.updateMany(
            {
                _id: { $in: flashcardIds },
                userId
            },
            {
                categoryId: targetCategoryId || null
            }
        );

        return res.status(200).json({
            message: `${result.modifiedCount} flashcards moved successfully`
        });
    } catch (error) {
        console.log("Error in moveFlashcards controller", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export default {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory,
    getCategoryWithFlashcards,
    moveFlashcards,
};