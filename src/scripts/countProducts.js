const mongoose = require("mongoose");
const { assertConfig } = require("../config");
const { connectDB } = require("../db");
const Product = require("../models/Product");

async function main() {
  assertConfig();
  await connectDB();

  const total = await Product.countDocuments({});
  const active = await Product.countDocuments({ isActive: true });
  const demo = await Product.countDocuments({ isDemo: true });

  console.log("Mahsulotlar hisoboti:");
  console.log(`  Jami mahsulotlar: ${total}`);
  console.log(`  Faol (isActive=true): ${active}`);
  console.log(`  Namuna (isDemo=true): ${demo}`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("Xatolik:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
