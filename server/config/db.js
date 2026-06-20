// ============================================================
// db.js
//
// WHAT THIS DOES:
// Connects your Express server to MongoDB Atlas using Mongoose.
// Mongoose is an ODM (Object Data Modeling) library — it lets
// you define data structures (Schemas/Models) in JavaScript
// instead of writing raw MongoDB queries.
//
// WHY A SEPARATE FILE?
// Keeping the connection logic separate from server.js keeps
// server.js clean and makes the connection reusable/testable.
//
// HOW IT WORKS:
// mongoose.connect() reads your MONGO_URI from .env, opens a
// connection pool to Atlas, and keeps it alive for the life
// of your server process. Every model (like User) uses this
// same connection automatically once established.
// ============================================================

import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    // Exit the process if DB connection fails — server is
    // useless without it, and silent failures are worse
    // than a clear crash with a clear error message.
    process.exit(1);
  }
};

export default connectDB;