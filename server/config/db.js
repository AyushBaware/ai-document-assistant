// Purpose: Connects the server to MongoDB through Mongoose.

import mongoose from "mongoose";
import dns from "dns";

// Force Node's own resolver to use public DNS servers instead
// of whatever it was defaulting to — fixes SRV lookup failures
// that only affect Node, not the OS.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

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