const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    brand: { type: String, trim: true, default: "", maxlength: 40 },
    model: { type: String, trim: true, default: "", maxlength: 80 },
    type: { type: String, trim: true, default: "phone" },
    condition: { type: String, enum: ["new", "used"], default: "new" },
    category: { type: String, trim: true, default: "phone" },
    storage: { type: String, trim: true, default: "", maxlength: 20 },
    color: { type: String, trim: true, default: "", maxlength: 30 },

    price: { type: Number, required: true, min: 0 }, // sotish narxi
    oldPrice: { type: Number, min: 0, default: null }, // faqat haqiqiy chegirma bo'lsa
    costPrice: { type: Number, min: 0, default: null, select: false }, // xarid narxi: ommaga HECH QACHON chiqmaydi
    stock: { type: Number, min: 0, default: 0, validate: Number.isInteger },

    images: { type: [String], default: [] },
    image: { type: String, trim: true, default: "" }, // asosiy rasm (images[0]) — eski frontend uchun
    description: { type: String, trim: true, default: "", maxlength: 4000 },

    // Ishlatilgan telefonlar uchun
    batteryHealth: { type: Number, min: 0, max: 100, default: null },
    cosmeticCondition: { type: String, enum: ["", "excellent", "good", "fair"], default: "" },
    knownIssues: { type: String, trim: true, default: "", maxlength: 1000 },
    imeiVerified: { type: Boolean, default: false },
    warrantyMonths: { type: Number, min: 0, max: 60, default: 0 },

    isActive: { type: Boolean, default: true },
    isDemo: { type: Boolean, default: false }, // namuna mahsulotlar (ishga tushirishdan oldin o'chiring)
    soldCount: { type: Number, min: 0, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

productSchema.index({ isActive: 1, type: 1, condition: 1, price: 1 });
productSchema.index({ isActive: 1, brand: 1 });
productSchema.index({ isActive: 1, soldCount: -1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);
