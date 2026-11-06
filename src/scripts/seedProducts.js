// NAMUNA mahsulotlar (isDemo: true). Faqat dizaynni ko'rish uchun; rasmlari umumiy stock-foto.
// Xarid narxi (costPrice) ATAYLAB kiritilmagan: uni admin panelda haqiqiy qiymat bilan to'ldiring.
const { config, assertConfig } = require("../config");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { connectDB } = require("../db");
const User = require("../models/User");
const Product = require("../models/Product");

const catalog = [
  ["Apple iPhone 16 128GB", "Apple", "iPhone 16", "128GB", 11999000, "flagship", "photo-1592750475338-74b7b21085ab"],
  ["Samsung Galaxy S25 256GB", "Samsung", "Galaxy S25", "256GB", 13499000, "flagship", "photo-1511707171634-5f897ff02aa9"],
  ["Xiaomi 14T Pro 512GB", "Xiaomi", "14T Pro", "512GB", 8999000, "flagship", "photo-1560677653-a263662b153b"],
  ["Apple iPhone 15 128GB", "Apple", "iPhone 15", "128GB", 9999000, "flagship", "photo-1603891128711-11b4b03bb138"],
  ["Samsung Galaxy A55 256GB", "Samsung", "Galaxy A55", "256GB", 5499000, "budget", "photo-1702451462735-3f0ba7679641"],
  ["Xiaomi Redmi Note 14 Pro 256GB", "Xiaomi", "Redmi Note 14 Pro", "256GB", 4299000, "budget", "photo-1629494893504-d41e26a02631"],
];

async function main() {
  assertConfig();
  await connectDB();
  let seller = await User.findOne({ email: "catalog@telefon.market" });
  if (!seller) {
    seller = await User.create({
      email: "catalog@telefon.market",
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
      role: "user",
    });
  }
  for (const [name, brand, model, storage, price, category, photo] of catalog) {
    const image = `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=85`;
    await Product.updateOne(
      { name },
      { $setOnInsert: { name, brand, model, storage, price, category, image, images: [image], stock: 3, isDemo: true, createdBy: seller._id } },
      { upsert: true }
    );
  }
  console.log(`Namuna katalog tayyor: ${catalog.length} ta (isDemo). Ishga tushirishdan oldin: npm run clear-demo`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("Seed xatosi:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
