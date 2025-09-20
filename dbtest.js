// dbTest.js
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load .env.local file
dotenv.config({ path: ".env.local" });

async function testDB() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME,
    });

    console.log("✅ MongoDB connected successfully!");
    process.exit(0); // connection success
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1); // connection fail
  }
}

// Run the test
testDB();
