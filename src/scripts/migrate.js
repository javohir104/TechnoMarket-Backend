// Eski ma'lumotlarni yangi sxemaga o'tkazadi (xavfsiz, qayta ishga tushirsa bo'ladi):
//  - eski buyurtma holati "completed" -> "delivered"
//  - eski mahsulotlarda images/stock/condition/type maydonlari to'ldiriladi
const mongoose = require("mongoose");
const { assertConfig } = require("../config");
const { connectDB } = require("../db");
const Order = require("../models/Order");
const Product = require("../models/Product");

async function main() {
  assertConfig();
  await connectDB();
  const col = mongoose.connection.collection("orders");
  const a = await col.updateMany({ status: "completed" }, { $set: { status: "delivered" } });
  const products = mongoose.connection.collection("products");
  const b = await products.updateMany({ type: { $exists: false } }, { $set: { type: "phone" } });
  const c = await products.updateMany({ condition: { $exists: false } }, { $set: { condition: "new" } });
  const d = await products.updateMany({ stock: { $exists: false } }, { $set: { stock: 0 } });
  const e = await products.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });
  let f = 0;
  for (const p of await products.find({ images: { $exists: false } }).toArray()) {
    await products.updateOne({ _id: p._id }, { $set: { images: p.image ? [p.image] : [] } });
    f += 1;
  }
  console.log({ ordersFixed: a.modifiedCount, type: b.modifiedCount, condition: c.modifiedCount, stock: d.modifiedCount, active: e.modifiedCount, images: f });
  console.log("Diqqat: eski mahsulotlarda stock = 0. Admin panelda qoldiq va xarid narxini kiriting.");
  await Promise.all([Order.syncIndexes(), Product.syncIndexes()]);
  await mongoose.disconnect();
}
main().catch(async (e) => { console.error(e.message); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
