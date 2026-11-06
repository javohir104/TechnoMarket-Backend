const { verifyAccessToken } = require("../utils/tokens");
const User = require("../models/User");
const { HttpError, asyncHandler } = require("../utils/httpError");

function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return next(new HttpError(401, "Sessiya tugadi, qayta kiring"));
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (_err) {
    return next(new HttpError(401, "Sessiya tugadi, qayta kiring"));
  }
}

// Rol token'dan emas, har safar database'dan tekshiriladi: admin huquqi olib tashlansa, eski token ishlamaydi
const requireAdmin = [
  requireAuth,
  asyncHandler(async (req, _res, next) => {
    const user = await User.findById(req.user.sub).select("role email").lean();
    if (!user || user.role !== "admin") throw new HttpError(403, "Faqat administrator uchun");
    req.admin = { id: String(user._id), email: user.email };
    next();
  }),
];

module.exports = { requireAuth, requireAdmin };
