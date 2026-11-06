const express = require("express");
const mongoose = require("mongoose");
const Category = require("../../models/Category");
const { categoryBody } = require("../../validation");
const { ensureDefaultCategories } = require("../categories");
const { HttpError, asyncHandler } = require("../../utils/httpError");

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /admin/categories
router.get("/", asyncHandler(async (_req, res) => {
  await ensureDefaultCategories();
  const items = await Category.find().sort({ order: 1, createdAt: 1 }).lean();
  res.json(items);
}));

// POST /admin/categories
router.post("/", asyncHandler(async (req, res) => {
  const body = categoryBody.parse(req.body || {});
  const slug = body.slug ? slugify(body.slug) : slugify(body.name) || `cat-${Date.now()}`;

  const exists = await Category.findOne({ $or: [{ name: body.name }, { slug }] });
  if (exists) {
    throw new HttpError(409, `"${body.name}" nomli kategoriya allaqachon mavjud`);
  }

  const category = await Category.create({
    name: body.name,
    slug,
    icon: body.icon || "📦",
    order: body.order || 0,
    isActive: body.isActive !== undefined ? body.isActive : true,
  });

  res.status(201).json(category);
}));

// PUT /admin/categories/:id
router.put("/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Identifikator noto'g'ri");
  const body = categoryBody.parse(req.body || {});
  const slug = body.slug ? slugify(body.slug) : slugify(body.name);

  const existing = await Category.findById(req.params.id);
  if (!existing) throw new HttpError(404, "Kategoriya topilmadi");

  // Nom yoki slug boshqasida takrorlanmasligi
  const conflict = await Category.findOne({
    _id: { $ne: req.params.id },
    $or: [{ name: body.name }, { slug }],
  });
  if (conflict) {
    throw new HttpError(409, `"${body.name}" nomi yoki slugi allaqachon mavjud`);
  }

  existing.name = body.name;
  existing.slug = slug;
  if (body.icon) existing.icon = body.icon;
  if (typeof body.order === "number") existing.order = body.order;
  if (typeof body.isActive === "boolean") existing.isActive = body.isActive;

  await existing.save();
  res.json(existing);
}));

// DELETE /admin/categories/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Identifikator noto'g'ri");
  const removed = await Category.findByIdAndDelete(req.params.id);
  if (!removed) throw new HttpError(404, "Kategoriya topilmadi");
  res.json({ id: removed._id, message: "Kategoriya o'chirildi" });
}));

module.exports = router;
