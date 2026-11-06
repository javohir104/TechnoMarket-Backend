const { z } = require("zod");
const mongoose = require("mongoose");
const { STATUSES } = require("./models/Order");
const { CATEGORIES } = require("./models/Expense");

const trimmed = (max, label = "Matn") => z.string({ invalid_type_error: `${label} noto'g'ri` }).trim().max(max, `${label} juda uzun`);
const money = (label) => z.number({ invalid_type_error: `${label} raqam bo'lishi kerak` }).int(`${label} butun son bo'lishi kerak`).min(0, `${label} manfiy bo'lmasligi kerak`);
const objectId = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), "Identifikator noto'g'ri");
const imageUrl = z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\//i.test(v) || /^\/uploads\/[\w.-]+$/.test(v), "Rasm havolasi noto'g'ri");

const PHONE_RE = /^\+?[0-9\s()-]{9,24}$/;

const productBody = z.object({
  name: trimmed(140, "Nomi").min(2, "Nomini kiriting"),
  brand: trimmed(40, "Brend").optional(),
  model: trimmed(80, "Model").optional(),
  type: trimmed(40, "Turi").optional(),
  condition: z.enum(["new", "used"]).optional(),
  category: trimmed(40, "Kategoriya").optional(),
  storage: trimmed(20, "Xotira").optional(),
  color: trimmed(30, "Rang").optional(),
  price: money("Sotish narxi"),
  oldPrice: money("Eski narx").nullable().optional(),
  costPrice: money("Xarid narxi").nullable().optional(),
  stock: z.number().int("Qoldiq butun son bo'lishi kerak").min(0, "Qoldiq manfiy bo'lmasligi kerak").optional(),
  images: z.array(imageUrl).max(10, "Ko'pi bilan 10 ta rasm").optional(),
  image: imageUrl.optional(),
  description: trimmed(4000, "Tavsif").optional(),
  batteryHealth: z.number().int().min(0).max(100, "Batareya 0–100% oralig'ida bo'lishi kerak").nullable().optional(),
  cosmeticCondition: z.enum(["", "excellent", "good", "fair"]).optional(),
  knownIssues: trimmed(1000, "Kamchiliklar").optional(),
  imeiVerified: z.boolean().optional(),
  warrantyMonths: z.number().int().min(0).max(60).optional(),
  isActive: z.boolean().optional(),
});
const productCreate = productBody;
const productUpdate = productBody.partial();

const orderCreate = z.object({
  customerName: trimmed(80, "Ism").min(2, "Ismingizni kiriting"),
  phone: z.string().trim().regex(PHONE_RE, "Telefon raqamini to'g'ri formatda kiriting"),
  address: trimmed(250, "Yetkazib berish manzili").min(2, "Yetkazib berish manzilini kiriting"),
  house: trimmed(40, "Uy/bino raqami").optional().default(""),
  floor: trimmed(20, "Qavat").optional().default(""),
  apartment: trimmed(20, "Kvartira").optional().default(""),
  landmark: trimmed(120, "Mo'ljal").optional().default(""),
  location: z
    .object({
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
    })
    .optional()
    .default({}),
  region: trimmed(60, "Viloyat").optional().default(""),
  district: trimmed(60, "Tuman").optional().default(""),
  note: trimmed(500, "Izoh").optional().default(""),
  deliveryMethod: z.enum(["courier", "pickup", "post"]).default("courier"),
  items: z
    .array(
      z.object({
        productId: objectId,
        quantity: z.number().int("Miqdor butun son bo'lishi kerak").min(1).max(20, "Bir mahsulotdan 20 tadan ko'p bo'lmaydi"),
      })
    )
    .min(1, "Savat bo'sh")
    .max(30, "Mahsulotlar soni juda ko'p"),
});

const statusChange = z.object({
  status: z.enum(STATUSES),
  note: trimmed(300, "Izoh").optional().default(""),
  restock: z.boolean().optional(),
});

const orderCosts = z
  .object({
    delivery: money("Yetkazib berish xarajati"),
    packaging: money("Qadoqlash xarajati"),
    other: money("Boshqa xarajat"),
    returnLoss: money("Qaytarish zarari"),
    paymentStatus: z.enum(["unpaid", "paid"]),
  })
  .partial();

const expenseBody = z.object({
  title: trimmed(120, "Xarajat nomi").optional().default(""),
  category: z.enum(CATEGORIES),
  amount: z.number().int("Summa butun son bo'lishi kerak").min(1, "Summa 0 dan katta bo'lishi kerak"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Sana noto'g'ri").optional(),
  note: trimmed(500, "Izoh").optional().default(""),
});

const categoryBody = z.object({
  name: trimmed(60, "Kategoriya nomi").min(2, "Kategoriya nomini kiriting"),
  slug: trimmed(60, "Slug").optional(),
  icon: trimmed(10, "Belgi (icon)").optional().default("📦"),
  order: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

module.exports = {
  productCreate,
  productUpdate,
  orderCreate,
  statusChange,
  orderCosts,
  expenseBody,
  categoryBody,
  objectId,
};
