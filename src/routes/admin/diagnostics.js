const express = require("express");
const mongoose = require("mongoose");
const Product = require("../../models/Product");
const { asyncHandler } = require("../../utils/httpError");
const { requireAdmin } = require("../../middleware/auth");

const router = express.Router();

router.use(requireAdmin);

router.get("/db-status", asyncHandler(async (_req, res) => {
  const db = mongoose.connection.db;
  const total = await Product.countDocuments({});
  const active = await Product.countDocuments({ isActive: true });
  const apiVisible = await Product.countDocuments({ isActive: true, isDemo: { $ne: true } });

  res.json({
    database: db.databaseName,
    collection: Product.collection.name,
    totalProducts: total,
    activeProducts: active,
    apiVisibleProducts: apiVisible,
  });
}));

module.exports = router;
