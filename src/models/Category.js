const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 60 },
    icon: { type: String, trim: true, default: "📦", maxlength: 10 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ order: 1, name: 1 });

module.exports = mongoose.model("Category", categorySchema);
