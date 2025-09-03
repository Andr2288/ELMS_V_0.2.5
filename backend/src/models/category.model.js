// backend/src/models/category.model.js

import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        description: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500,
        },
        color: {
            type: String,
            default: "#3B82F6", // Default blue color
            match: /^#[0-9A-F]{6}$/i, // Hex color validation
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        flashcardsCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Create an index for better query performance
categorySchema.index({ userId: 1, name: 1 });

const Category = mongoose.model("Category", categorySchema);
export default Category;