const mongoose = require("mongoose");

const CATEGORIES = [
  "advertising", // Reklama xarajati
  "delivery",    // Yetkazib berish xarajati
  "rent",        // Ijara
  "internet",    // Internet va aloqa
  "salary",      // Ish haqi
  "packaging",   // Qadoqlash
  "other",       // Boshqa xarajatlar
];

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: CATEGORIES, required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    date: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, default: "", maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1, category: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
module.exports.CATEGORIES = CATEGORIES;
