const express = require("express");
const Category = require("../models/Category");
const { asyncHandler } = require("../utils/httpError");

const router = express.Router();

const DEFAULT_CATEGORIES = [
  { name: "Smartfonlar", slug: "phone", icon: "📱", order: 1 },
  { name: "Noutbuklar", slug: "laptop", icon: "💻", order: 2 },
  { name: "Klaviaturalar", slug: "keyboard", icon: "⌨️", order: 3 },
  { name: "Sichqonchalar", slug: "mouse", icon: "🖱️", order: 4 },
  { name: "Aksessuarlar", slug: "accessory", icon: "🎧", order: 5 },
  { name: "Gadjetlar", slug: "gadget", icon: "⌚", order: 6 },
];

async function ensureDefaultCategories() {
  const count = await Category.countDocuments();
  if (count === 0) {
    await Category.insertMany(DEFAULT_CATEGORIES).catch(() => {});
  }
}

// GET /categories — faol kategoriyalar ro'yxati
router.get("/", asyncHandler(async (_req, res) => {
  await ensureDefaultCategories();
  const items = await Category.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
  res.json(items);
}));

module.exports = router;
module.exports.ensureDefaultCategories = ensureDefaultCategories;
