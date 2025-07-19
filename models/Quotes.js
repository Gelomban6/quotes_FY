import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema({
      text: { type: String, required: true, unique: true },
      timestamp: { type: Date, default: Date.now },
});

quoteSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

export default mongoose.model("Quote", quoteSchema);
