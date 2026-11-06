const mongoose = require("mongoose");

const STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled", "returned"];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    customerName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 24 },
    region: { type: String, trim: true, default: "", maxlength: 60 },
    district: { type: String, trim: true, default: "", maxlength: 60 },
    address: { type: String, trim: true, default: "", maxlength: 250 },
    house: { type: String, trim: true, default: "", maxlength: 40 },
    floor: { type: String, trim: true, default: "", maxlength: 20 },
    apartment: { type: String, trim: true, default: "", maxlength: 20 },
    landmark: { type: String, trim: true, default: "", maxlength: 120 },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    note: { type: String, trim: true, default: "", maxlength: 500 },
    deliveryMethod: { type: String, enum: ["courier", "pickup", "post"], default: "courier" },

    telegramSent: { type: Boolean, default: false },
    telegramError: { type: String, default: "" },

    // Buyurtma paytidagi SNAPSHOT
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        name: { type: String, required: true, trim: true },
        type: { type: String, trim: true, default: "phone" },
        category: { type: String, trim: true, default: "" },
        image: { type: String, trim: true, default: "" },
        condition: { type: String, enum: ["new", "used"], default: "new" },
        quantity: { type: Number, required: true, min: 1, max: 20 },
        unitPrice: { type: Number, required: true, min: 0 },
        costPrice: { type: Number, min: 0, default: null },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },

    costs: {
      delivery: { type: Number, min: 0, default: 0 },
      packaging: { type: Number, min: 0, default: 0 },
      other: { type: Number, min: 0, default: 0 },
    },
    returnLoss: { type: Number, min: 0, default: 0 },
    restocked: { type: Boolean, default: false },

    paymentMethod: { type: String, enum: ["cash"], default: "cash" },
    paymentStatus: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },

    status: { type: String, enum: STATUSES, default: "new" },
    statusHistory: [
      {
        status: { type: String, enum: STATUSES, required: true },
        at: { type: Date, default: Date.now },
        by: { type: String, default: "mijoz" },
        note: { type: String, default: "", maxlength: 300 },
      },
    ],
    confirmedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    returnedAt: Date,
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ phone: 1 });
orderSchema.index({ deliveredAt: 1 });
orderSchema.index({ returnedAt: 1 });
orderSchema.index({ cancelledAt: 1 });

module.exports = mongoose.model("Order", orderSchema);
module.exports.STATUSES = STATUSES;
