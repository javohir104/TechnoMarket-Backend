const express = require("express");
const mongoose = require("mongoose");
const User = require("../../models/User");
const Order = require("../../models/Order");
const { HttpError, asyncHandler } = require("../../utils/httpError");

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /admin/users — barcha foydalanuvchilar ro'yxati (xavfsiz, parolsiz)
router.get("/", asyncHandler(async (req, res) => {
  const filter = {};
  const { role, q } = req.query;

  if (role && ["user", "admin"].includes(role)) {
    filter.role = role;
  }

  if (typeof q === "string" && q.trim()) {
    const rx = { $regex: q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ name: rx }, { email: rx }, { username: rx }, { phone: rx }];
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Har bir foydalanuvchining buyurtmalar soni va jami xarid summasini hisoblash
  const userIds = users.map((u) => u._id);
  const orderStats = await Order.aggregate([
    { $match: { user: { $in: userIds } } },
    {
      $group: {
        _id: "$user",
        ordersCount: { $sum: 1 },
        totalSpent: { $sum: "$total" },
      },
    },
  ]);

  const statsMap = new Map(orderStats.map((s) => [String(s._id), s]));

  const result = users.map((u) => {
    const st = statsMap.get(String(u._id)) || { ordersCount: 0, totalSpent: 0 };
    return {
      ...u,
      ordersCount: st.ordersCount,
      totalSpent: st.totalSpent,
    };
  });

  res.set("X-Total-Count", String(total));
  res.json(result);
}));

// PATCH /admin/users/:id/role — foydalanuvchi rolini o'zgartirish (admin/user)
router.patch("/:id/role", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Foydalanuvchi IDsi noto'g'ri");
  const { role } = req.body || {};
  if (!role || !["user", "admin"].includes(role)) {
    throw new HttpError(400, "Noto'g'ri rol (user yoki admin bo'lishi kerak)");
  }

  // Admin o'zini user qilib qo'yishini oldini olish
  if (String(req.admin?._id || req.admin?.id) === String(req.params.id) && role !== "admin") {
    throw new HttpError(400, "O'zingizning admin rolingizni bekor qila olmaysiz");
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { role } },
    { new: true }
  ).select("-passwordHash").lean();

  if (!user) throw new HttpError(404, "Foydalanuvchi topilmadi");
  res.json(user);
}));

// DELETE /admin/users/:id — foydalanuvchini o'chirish (o'zini o'chirish taqiqlanadi)
router.delete("/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Foydalanuvchi IDsi noto'g'ri");
  if (String(req.admin?._id || req.admin?.id) === String(req.params.id)) {
    throw new HttpError(400, "O'z hisobingizni o'chira olmaysiz");
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new HttpError(404, "Foydalanuvchi topilmadi");
  res.json({ id: user._id, ok: true });
}));

module.exports = router;
