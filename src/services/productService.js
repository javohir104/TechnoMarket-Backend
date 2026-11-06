const { config } = require("../config");
const { HttpError } = require("../utils/httpError");

const SAFE_FIELDS = [
  "_id", "name", "brand", "model", "type", "condition", "category", "storage", "color",
  "price", "oldPrice", "stock", "images", "image", "description", "batteryHealth",
  "cosmeticCondition", "knownIssues", "imeiVerified", "warrantyMonths", "soldCount", "createdAt",
];

// Ommaviy API uchun: tannarx, createdBy va boshqa ichki maydonlar chiqarilmaydi
function toPublic(p) {
  const out = {};
  for (const key of SAFE_FIELDS) if (p[key] !== undefined) out[key] = p[key];
  const hasDiscount = typeof p.oldPrice === "number" && p.oldPrice > p.price;
  out.oldPrice = hasDiscount ? p.oldPrice : null;
  out.discountPercent = hasDiscount ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  out.inStock = p.stock > 0;
  return out;
}

// Admin kiritgan ma'lumotni saqlashga tayyorlaydi va biznes qoidalarini tekshiradi
function prepareProductData(data, existing = {}) {
  const out = { ...data };
  if (out.images) {
    out.image = out.images[0] || "";
  }
  const price = out.price ?? existing.price;
  const cost = out.costPrice !== undefined ? out.costPrice : existing.costPrice;

  if (out.oldPrice !== undefined && out.oldPrice !== null && out.oldPrice <= price) {
    throw new HttpError(400, "Eski narx yangi narxdan katta bo'lishi kerak (aks holda chegirma yo'q)");
  }
  if (typeof cost === "number" && typeof price === "number") {
    if (price <= cost) throw new HttpError(400, "Sotish narxi xarid narxidan yuqori bo'lishi kerak");
    if (config.minProfit > 0 && price - cost < config.minProfit) {
      throw new HttpError(400, `Minimal foyda ${config.minProfit} so'm bo'lishi kerak`);
    }
  }
  const condition = out.condition ?? existing.condition;
  if (condition === "new") {
    out.batteryHealth = null;
    out.cosmeticCondition = "";
    out.knownIssues = "";
  }
  return out;
}

module.exports = { toPublic, prepareProductData };
