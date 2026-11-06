const Order = require("../models/Order");
const Product = require("../models/Product");
const Counter = require("../models/Counter");
const { config } = require("../config");
const { HttpError } = require("../utils/httpError");

const TRANSITIONS = {
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

const TIMESTAMP_FIELD = {
  confirmed: "confirmedAt",
  shipped: "shippedAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
  returned: "returnedAt",
};

async function nextOrderNumber() {
  const seq = await Counter.next("order");
  return `TM-${String(seq).padStart(6, "0")}`;
}

async function releaseStock(items) {
  await Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } })));
}

/**
 * Buyurtma yaratadi. Narx va tannarx HAR DOIM serverdagi mahsulotdan olinadi (mijozdan emas).
 * Ombor atomik kamaytiriladi: ikki kishi oxirgi telefonni bir vaqtda ola olmaydi.
 */
async function createOrder(input) {
  const quantities = new Map();
  for (const item of input.items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  for (const qty of quantities.values()) {
    if (qty > 20) throw new HttpError(400, "Bir mahsulotdan 20 tadan ko'p buyurtma qilib bo'lmaydi");
  }

  const products = await Product.find({ _id: { $in: [...quantities.keys()] }, isActive: true })
    .select("+costPrice")
    .lean();
  if (products.length !== quantities.size) {
    throw new HttpError(400, "Mahsulotlardan biri endi mavjud emas. Sahifani yangilang.");
  }

  const reserved = [];
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  try {
    for (const [productId, qty] of quantities.entries()) {
      const p = productMap.get(productId);
      const res = await Product.updateOne(
        { _id: p._id, isActive: true, price: p.price, stock: { $gte: qty } },
        { $inc: { stock: -qty } }
      );
      if (res.modifiedCount !== 1) {
        throw new HttpError(409, `"${p.name}" omborda yetarli emas yoki narxi o'zgargan. Savatni yangilang.`);
      }
      reserved.push({ product: p._id, quantity: qty });
    }

    const items = [...quantities.entries()].map(([productId, qty]) => {
      const p = productMap.get(productId);
      const mainImg = p.image || (Array.isArray(p.images) && p.images[0]) || "";
      return {
        product: p._id,
        name: p.name,
        type: p.type || "phone",
        category: p.category || p.type || "Boshqa",
        image: mainImg,
        condition: p.condition || "new",
        quantity: qty,
        unitPrice: p.price,
        costPrice: typeof p.costPrice === "number" ? p.costPrice : null,
      };
    });
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const deliveryFee = input.deliveryMethod === "courier" ? config.courierFee : 0;

    return await Order.create({
      orderNumber: await nextOrderNumber(),
      user: input.userId || undefined,
      customerName: input.customerName,
      phone: input.phone,
      address: input.address,
      house: input.house || "",
      floor: input.floor || "",
      apartment: input.apartment || "",
      landmark: input.landmark || "",
      location: {
        latitude: input.location?.latitude || null,
        longitude: input.location?.longitude || null,
      },
      region: input.region || "",
      district: input.district || "",
      note: input.note || "",
      deliveryMethod: input.deliveryMethod || "courier",
      items,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      statusHistory: [{ status: "new", by: "mijoz" }],
    });
  } catch (err) {
    await releaseStock(reserved).catch((e) => console.error("Omborni tiklashda xato:", e.message));
    throw err;
  }
}

/**
 * Holatni o'zgartiradi. Holat filtri bilan atomik yangilanadi.
 */
async function changeStatus(orderId, nextStatus, { by, note = "", restock = true } = {}) {
  const order = await Order.findById(orderId);
  if (!order) throw new HttpError(404, "Buyurtma topilmadi");
  const allowed = TRANSITIONS[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new HttpError(400, `"${order.status}" holatidan "${nextStatus}" holatiga o'tib bo'lmaydi`);
  }

  const now = new Date();
  const set = { status: nextStatus, [TIMESTAMP_FIELD[nextStatus]]: now };
  if (nextStatus === "delivered") set.paymentStatus = "paid";
  if (nextStatus === "returned") set.restocked = Boolean(restock);

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: set, $push: { statusHistory: { status: nextStatus, at: now, by: by || "admin", note } } },
    { new: true }
  );
  if (!updated) throw new HttpError(409, "Buyurtma holati boshqa joyda o'zgartirilgan. Sahifani yangilang.");

  if (nextStatus === "cancelled") {
    await releaseStock(updated.items);
  } else if (nextStatus === "delivered") {
    await Promise.all(updated.items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { soldCount: i.quantity } })));
  } else if (nextStatus === "returned") {
    await Promise.all(
      updated.items.map((i) =>
        Product.updateOne({ _id: i.product }, { $inc: { soldCount: -i.quantity, ...(restock ? { stock: i.quantity } : {}) } })
      )
    );
  }
  return updated;
}

module.exports = { createOrder, changeStatus, TRANSITIONS };
