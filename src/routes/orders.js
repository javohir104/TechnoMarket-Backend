const express = require("express");
const Order = require("../models/Order");
const User = require("../models/User");
const { orderCreate } = require("../validation");
const { createOrder } = require("../services/orderService");
const { notifyNewOrder } = require("../services/telegram");
const { verifyAccessToken } = require("../utils/tokens");
const { requireAuth } = require("../middleware/auth");
const { HttpError, asyncHandler } = require("../utils/httpError");

const router = express.Router();

function getOptionalUserId(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  try {
    const payload = verifyAccessToken(header.slice(7).trim());
    return payload?.sub || null;
  } catch (_e) {
    return null;
  }
}

// POST /orders — mijoz yoki mehmon sifatida buyurtma berish.
router.post("/", asyncHandler(async (req, res) => {
  const input = orderCreate.parse(req.body || {});
  const optionalUserId = getOptionalUserId(req);
  if (optionalUserId) {
    input.userId = optionalUserId;
  }

  const order = await createOrder(input);
  console.log("YANGI BUYURTMA YARATILDI:", order.orderNumber);

  // Telegram botga yuborish (orqa fonda buyurtma yaratilishini sekinlashtirmaydi)
  notifyNewOrder(order).catch((err) => console.error("Telegram xabarnomasi xatosi:", err));

  res.status(201).json({
    id: order._id,
    orderNumber: order.orderNumber,
    total: order.total,
    status: order.status,
  });
}));

// GET /orders/my-orders — autentifikatsiyadan o'tgan foydalanuvchining shaxsiy xaridlari
router.get("/my-orders", requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.sub).lean();
  if (!user) throw new HttpError(404, "Foydalanuvchi topilmadi");

  const conditions = [{ user: user._id }];
  if (user.phone) {
    const cleanPhone = user.phone.replace(/\D/g, "");
    if (cleanPhone.length >= 9) {
      conditions.push({ phone: new RegExp(cleanPhone.slice(-9) + "$") });
    }
  }

  const orders = await Order.find({ $or: conditions })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json(
    orders.map((o) => ({
      id: o._id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      deliveryMethod: o.deliveryMethod,
      deliveryFee: o.deliveryFee,
      items: o.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        type: i.type,
        image: i.image,
      })),
      createdAt: o.createdAt,
    }))
  );
}));

// GET /orders/track?orderNumber=TM-000001&phone=+998901234567
router.get("/track", asyncHandler(async (req, res) => {
  const orderNumber = String(req.query.orderNumber || "").trim().toUpperCase();
  const phoneDigits = String(req.query.phone || "").replace(/\D/g, "");
  if (!/^TM-\d{6}$/.test(orderNumber) || phoneDigits.length < 9) throw new HttpError(400, "Buyurtma raqami yoki telefon noto'g'ri");

  const order = await Order.findOne({ orderNumber }).lean();
  const same = order && order.phone.replace(/\D/g, "").slice(-9) === phoneDigits.slice(-9);
  if (!same) throw new HttpError(404, "Buyurtma topilmadi");

  res.json({
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
    history: order.statusHistory.map((h) => ({ status: h.status, at: h.at })),
  });
}));

module.exports = router;
