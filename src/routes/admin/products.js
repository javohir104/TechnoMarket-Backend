const express = require("express");
const mongoose = require("mongoose");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const { productCreate, productUpdate } = require("../../validation");
const { prepareProductData } = require("../../services/productService");
const { HttpError, asyncHandler } = require("../../utils/httpError");

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// Admin ro'yxati: nofaol mahsulotlar, tannarx va foyda ham ko'rinadi
router.get("/", asyncHandler(async (req, res) => {
  const filter = {};
  const { q, type, condition, lowStock } = req.query;
  if (typeof q === "string" && q.trim()) {
    const rx = { $regex: q.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ name: rx }, { brand: rx }, { model: rx }];
  }
  if (typeof type === "string" && type.trim()) filter.type = type.trim();
  if (["new", "used"].includes(condition)) filter.condition = condition;
  if (lowStock === "1") filter.stock = { $lte: 2 };
  const items = await Product.find(filter).select("+costPrice").sort({ createdAt: -1 }).limit(500).lean();
  res.json(items.map((p) => ({ ...p, margin: typeof p.costPrice === "number" ? p.price - p.costPrice : null })));
}));

router.post("/", asyncHandler(async (req, res) => {
  const data = prepareProductData(productCreate.parse(req.body || {}));
  const product = await Product.create({ ...data, createdBy: req.admin.id });
  const full = await Product.findById(product._id).select("+costPrice").lean();
  res.status(201).json(full);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Mahsulot identifikatori noto'g'ri");
  const existing = await Product.findById(req.params.id).select("+costPrice").lean();
  if (!existing) throw new HttpError(404, "Mahsulot topilmadi");
  const data = prepareProductData(productUpdate.parse(req.body || {}), existing);
  const product = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).select("+costPrice").lean();
  res.json(product);
}));

// Buyurtmada qatnashgan mahsulot o'chirilmaydi — arxivlanadi (tarix va hisobot buzilmasligi uchun)
router.delete("/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Mahsulot identifikatori noto'g'ri");
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, "Mahsulot topilmadi");
  const ordered = await Order.exists({ "items.product": product._id });
  if (ordered) {
    product.isActive = false;
    await product.save();
    return res.json({ id: product._id, archived: true, message: "Buyurtmalarda ishlatilgan, shuning uchun arxivlandi" });
  }
  await product.deleteOne();
  res.json({ id: product._id, archived: false, message: "O'chirildi" });
}));

module.exports = router;
