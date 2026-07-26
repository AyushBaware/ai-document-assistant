import mongoose from "mongoose";

const guestIpUsageSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, index: true },
    requestCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("GuestIpUsage", guestIpUsageSchema);