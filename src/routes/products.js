const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { toPublic } = require("../services/productService");
const { HttpError, asyncHandler } = require("../utils/httpError");

const router = express.Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const str = (v) => (typeof v === "string" ? v.trim() : "");
const SORTS = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { soldCount: -1, createdAt: -1 },
  newest: { createdAt: -1 },
};

function numberParam(value, name) {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${name} noto'g'ri`);
  return n;
}

// GET /products?q=&type=&condition=&brand=&storage=&color=&minPrice=&maxPrice=&inStock=1&sort=&page=&limit=
// Javob: mahsulotlar massivi. Jami soni — X-Total-Count sarlavhasida.
router.get("/", asyncHandler(async (req, res) => {
  const { q, type, condition, brand, storage, color, category, inStock, sort } = req.query;
  const filter = { isActive: true };

  if (str(q)) {
    const rx = { $regex: escapeRegex(str(q).slice(0, 80)), $options: "i" };
    filter.$or = [{ name: rx }, { brand: rx }, { model: rx }, { description: rx }];
  }
  if (str(type)) filter.type = str(type);
  if (["new", "used"].includes(condition)) filter.condition = condition;
  if (str(category)) filter.category = str(category);
  if (str(brand)) filter.brand = str(brand);
  if (str(storage)) filter.storage = str(storage);
  if (str(color)) filter.color = str(color);
  if (inStock === "1" || inStock === "true") filter.stock = { $gt: 0 };

  const min = numberParam(req.query.minPrice, "Minimal narx");
  const max = numberParam(req.query.maxPrice, "Maksimal narx");
  if (min !== undefined && max !== undefined && min > max) {
    throw new HttpError(400, "Minimal narx maksimaldan katta bo'lmasligi kerak");
  }
  if (min !== undefined || max !== undefined) {
    filter.price = {};
    if (min !== undefined) filter.price.$gte = min;
    if (max !== undefined) filter.price.$lte = max;
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[sort] || SORTS.newest).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  res.set("X-Total-Count", String(total));
  res.set("X-Total-Pages", String(Math.max(1, Math.ceil(total / limit))));
  res.json(items.map(toPublic));
}));

// Filtr uchun mavjud qiymatlar
router.get("/meta", asyncHandler(async (_req, res) => {
  const base = { isActive: true };
  const [brands, storages, colors] = await Promise.all([
    Product.distinct("brand", base),
    Product.distinct("storage", base),
    Product.distinct("color", base),
  ]);
  const clean = (arr) => arr.filter(Boolean).sort((a, b) => a.localeCompare(b, "uz", { numeric: true }));
  res.json({ brands: clean(brands), storages: clean(storages), colors: clean(colors) });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new HttpError(400, "Mahsulot identifikatori noto'g'ri");
  const product = await Product.findOne({ _id: req.params.id, isActive: true }).lean();
  if (!product) throw new HttpError(404, "Mahsulot topilmadi");
  res.json(toPublic(product));
}));

module.exports = router;
