const mongoose = require("mongoose");
const { assertConfig } = require("../config");
const { connectDB } = require("../db");
const Product = require("../models/Product");

async function main() {
  assertConfig();
  await connectDB();
  const res = await Product.deleteMany({ isDemo: true });
  console.log(`${res.deletedCount} ta namuna mahsulot o'chirildi`);
  await mongoose.disconnect();
}
main().catch(async (e) => { console.error(e.message); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
