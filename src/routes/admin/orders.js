const express = require("express");
const mongoose = require("mongoose");
const Order = require("../../models/Order");
const { STATUSES } = require("../../models/Order");
const { statusChange, orderCosts } = require("../../validation");
const { changeStatus, TRANSITIONS } = require("../../services/orderService");
const { notifyNewOrder } = require("../../services/telegram");
const { HttpError, asyncHandler } = require("../../utils/httpError");

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// Buyurtma foydasi (admin uchun)
function withProfit(o) {
  const cost = (o.items || []).reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0);
  const costs = (o.costs?.delivery || 0) + (o.costs?.packaging || 0) + (o.costs?.other || 0);
  const missingCost = (o.items || []).some((i) => i.costPrice === null || i.costPrice === undefined);
  return {
    ...o,
    allowedNext: TRANSITIONS[o.status] || [],
    cost,
    profit: o.subtotal + (o.deliveryFee || 0) - cost - costs,
    missingCost,
  };
}

router.get("/", asyncHandler(async (req, res) => {
  const filter = {};
  const { status, q } = req.query;
  if (typeof status === "string" && STATUSES.includes(status)) filter.status = status;
  if (typeof q === "string" && q.trim()) {
    const rx = { $regex: q.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ orderNumber: rx }, { customerName: rx }, { phone: rx }];
  }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
  ]);
  res.set("X-Total-Count", String(total));
  res.json(items.map(withProfit));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Buyurtma identifikatori noto'g'ri");
  const order = await Order.findById(req.params.id).lean();
  if (!order) throw new HttpError(404, "Buyurtma topilmadi");
  res.json(withProfit(order));
}));

router.patch("/:id/status", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Buyurtma identifikatori noto'g'ri");
  const { status, note, restock } = statusChange.parse(req.body || {});
  const order = await changeStatus(req.params.id, status, { by: req.admin?.email || "admin", note, restock });
  res.json(withProfit(order.toObject()));
}));

router.patch("/:id/costs", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Buyurtma identifikatori noto'g'ri");
  const body = orderCosts.parse(req.body || {});
  const set = {};
  for (const k of ["delivery", "packaging", "other"]) if (body[k] !== undefined) set[`costs.${k}`] = body[k];
  if (body.returnLoss !== undefined) set.returnLoss = body.returnLoss;
  if (body.paymentStatus !== undefined) set.paymentStatus = body.paymentStatus;
  if (!Object.keys(set).length) throw new HttpError(400, "O'zgartirish uchun ma'lumot yo'q");
  const order = await Order.findByIdAndUpdate(req.params.id, { $set: set }, { new: true }).lean();
  if (!order) throw new HttpError(404, "Buyurtma topilmadi");
  res.json(withProfit(order));
}));

// POST /:id/resend-telegram — Telegram botga xabarni qayta yuborish
router.post("/:id/resend-telegram", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Buyurtma identifikatori noto'g'ri");
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, "Buyurtma topilmadi");

  const result = await notifyNewOrder(order);
  const updated = await Order.findById(order._id).lean();
  res.json({
    ok: result.ok,
    error: result.error,
    order: withProfit(updated),
  });
}));

module.exports = router;
