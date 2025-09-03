// src/controllers/auth.controller.js

import bcrypt from "bcryptjs";

import utils from "../lib/utils.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";

const signup = async (req, res) => {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
        return res.status(400).json({message: "All fields are required"});
    }

    try {
        if (password.length < 6) {
            return res.status(400).json({message: `Password must be at least 6 characters`});
        }

        const user = await User.findOne({email});
        if (user) {
            return res.status(400).json({message: `Email already exists`});
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            fullName: fullName,
            email: email,
            password: hashedPassword
        });

        if (newUser) {
            utils.generateToken(newUser._id, res);
            await newUser.save();

            return res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic,
            });
        }
        else {
            return res.status(400).json({message: `Invalid user data`});
        }

    } catch (error) {
        console.log("Error in signup controller", error.message);
        return res.status(500).json({message: `Internal Server Error`});
    }
}

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({email});

        if (!user) {
            return res.status(400).json({message: "Invalid credentials"});
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(400).json({message: "Invalid credentials"});
        }

        utils.generateToken(user._id, res);

        return res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic
        });

    } catch (error) {
        console.log("Error in login controller", error.message);
        return res.status(500).json({message: `Internal Server Error`});
    }
}

const logout = (req, res) => {
    try {
        res.cookie("jwt", "", {maxAge:0});

        return res.status(200).json({message: "Logged out"});

    } catch (error) {
        console.log("Error logged out", error.message);
        return res.status(500).json({message: `Internal Server Error`});
    }
}

// ВИПРАВЛЕНО: Правильна обробка видалення фото
const updateProfile = async (req, res) => {
    try {
        const { fullName, profilePic } = req.body;
        const userId = req.user._id;

        // Перевіряємо, чи є хоча б одне поле для оновлення
        if (!fullName && profilePic === undefined) {
            return res.status(400).json({message: "At least one field (fullName or profilePic) is required"});
        }

        // Підготовуємо об'єкт для оновлення
        const updateData = {};

        // Оновлюємо fullName якщо воно надано
        if (fullName && fullName.trim()) {
            updateData.fullName = fullName.trim();
        }

        // Оновлюємо profilePic
        if (profilePic !== undefined) {
            if (profilePic === "" || profilePic === null) {
                // Видаляємо фото профілю
                updateData.profilePic = "";
            } else {
                // Завантажуємо нове фото
                try {
                    const uploadResponse = await cloudinary.uploader.upload(profilePic);
                    updateData.profilePic = uploadResponse.secure_url;
                } catch (cloudinaryError) {
                    console.log("Cloudinary upload error:", cloudinaryError.message);
                    return res.status(400).json({message: "Error uploading image"});
                }
            }
        }

        // Оновлюємо користувача в базі даних
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select("-password"); // Не повертаємо пароль

        if (!updatedUser) {
            return res.status(404).json({message: "User not found"});
        }

        return res.status(200).json({
            _id: updatedUser._id,
            fullName: updatedUser.fullName,
            email: updatedUser.email,
            profilePic: updatedUser.profilePic,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        });

    } catch (error) {
        console.log("Error in update profile controller", error.message);

        // Обробка помилок валідації Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({message: messages.join('. ')});
        }

        return res.status(500).json({message: `Internal Server Error`});
    }
}

const checkAuth = (req, res) => {
    try {
        return res.status(200).json(req.user);
    }
    catch (error) {
        console.log("Error in check auth controller", error.message);
        return res.status(500).json({message: `Internal Server Error`});
    }
}

export default {
    signup,
    login,
    logout,
    updateProfile,
    checkAuth
};