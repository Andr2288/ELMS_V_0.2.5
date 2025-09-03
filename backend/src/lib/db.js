// src/lib/db.js

import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connection_var = await mongoose.connect(process.env.MONGODB_URI);
      console.log(`MongoDB Connected! ${connection_var.connection.host}`);
  } catch (error) {
      console.log("MongoDB connection error", error);
  }
};

export default {
    connectDB
};