const mongoose = require("mongoose");
const Product = require("../models/Product");

async function runProductDiagnostics(config) {
  if (config.env !== "production") return null;

  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  const collName = Product.collection.name;

  const total = await Product.countDocuments({});
  const active = await Product.countDocuments({ isActive: true });
  const demoTrue = await Product.countDocuments({ isDemo: true });
  const demoFalse = await Product.countDocuments({ isDemo: false });
  const apiFilter = { isActive: true, isDemo: { $ne: true } };
  const apiCount = await Product.countDocuments(apiFilter);

  console.log("=== Render production diagnostika ===");
  console.log(`NODE_ENV: ${config.env}`);
  console.log(`Database: ${dbName}`);
  console.log(`Collection: ${collName}`);
  console.log(`Barcha mahsulotlar: ${total}`);
  console.log(`isActive: true: ${active}`);
  console.log(`isDemo: true: ${demoTrue}`);
  console.log(`isDemo: false: ${demoFalse}`);
  console.log(`GET /products filtriga mos: ${apiCount}`);

  return {
    database: dbName,
    collection: collName,
    totalProducts: total,
    activeProducts: active,
    demoProducts: demoTrue,
    realProducts: demoFalse,
    apiVisibleProducts: apiCount,
  };
}

module.exports = { runProductDiagnostics };
