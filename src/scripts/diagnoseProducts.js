const mongoose = require("mongoose");
const { assertConfig } = require("../config");
const { connectDB } = require("../db");
const Product = require("../models/Product");

async function main() {
  assertConfig();
  await connectDB();

  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  const collName = Product.collection.name;

  console.log("=== MongoDB diagnostika ===");
  console.log(`Database: ${dbName}`);
  console.log(`Collection: ${collName}`);
  console.log(`Model: Product (mongoose.model("Product", productSchema))`);

  const total = await Product.countDocuments({});
  const activeTrue = await Product.countDocuments({ isActive: true });
  const activeFalse = await Product.countDocuments({ isActive: false });
  const activeMissing = await Product.countDocuments({ isActive: { $exists: false } });
  const demoTrue = await Product.countDocuments({ isDemo: true });
  const demoFalse = await Product.countDocuments({ isDemo: false });
  const demoMissing = await Product.countDocuments({ isDemo: { $exists: false } });

  console.log("\n=== Mahsulotlar soni (read-only) ===");
  console.log(`Barcha mahsulotlar: ${total}`);
  console.log(`isActive: true: ${activeTrue}`);
  console.log(`isActive: false: ${activeFalse}`);
  console.log(`isActive maydoni yo'q: ${activeMissing}`);
  console.log(`isDemo: true: ${demoTrue}`);
  console.log(`isDemo: false: ${demoFalse}`);
  console.log(`isDemo maydoni yo'q: ${demoMissing}`);

  const apiFilter = { isActive: true, isDemo: { $ne: true } };
  const apiCount = await Product.countDocuments(apiFilter);
  console.log(`\nGET /products filtr ({ isActive: true, isDemo: { $ne: true } })ga mos keladigan: ${apiCount}`);

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("Xatolik:", e.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
