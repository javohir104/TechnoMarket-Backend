const express = require("express");
const mongoose = require("mongoose");
const Expense = require("../../models/Expense");
const { expenseBody } = require("../../validation");
const { buildReport, getDashboardStats, parseRange } = require("../../services/financeService");
const { HttpError, asyncHandler } = require("../../utils/httpError");

const router = express.Router();
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /admin/finance/dashboard — real vaqtdagi 8 ta asosiy statistika
router.get("/dashboard", asyncHandler(async (_req, res) => {
  res.json(await getDashboardStats());
}));

// GET /admin/finance/report?from=2026-01-01&to=2026-12-31&groupBy=month
router.get("/report", asyncHandler(async (req, res) => {
  res.json(await buildReport(req.query));
}));

// GET /admin/finance/expenses
router.get("/expenses", asyncHandler(async (req, res) => {
  let filter = {};
  if (req.query.from || req.query.to) {
    try {
      const { start, end } = parseRange(req.query);
      filter.date = { $gte: start, $lte: end };
    } catch (_e) {
      // oraliq berilmagan bo'lsa barchasini ko'rsatadi
    }
  }
  const items = await Expense.find(filter).sort({ date: -1, createdAt: -1 }).limit(500).lean();
  res.json(items);
}));

// POST /admin/finance/expenses — yangi xarajat qo'shish
router.post("/expenses", asyncHandler(async (req, res) => {
  const body = expenseBody.parse(req.body || {});
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Sana noto'g'ri");
  const title = (body.title && body.title.trim()) || body.category || "Xarajat";
  const expense = await Expense.create({
    title,
    category: body.category,
    amount: body.amount,
    note: body.note || "",
    date,
    createdBy: req.admin?.id || undefined,
  });
  res.status(201).json(expense);
}));

// PUT /admin/finance/expenses/:id — xarajatni tahrirlash
router.put("/expenses/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Identifikator noto'g'ri");
  const body = expenseBody.parse(req.body || {});
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "Sana noto'g'ri");

  const updated = await Expense.findByIdAndUpdate(
    req.params.id,
    {
      title: body.title,
      category: body.category,
      amount: body.amount,
      note: body.note || "",
      date,
    },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) throw new HttpError(404, "Xarajat topilmadi");
  res.json(updated);
}));

// DELETE /admin/finance/expenses/:id — xarajatni o'chirish
router.delete("/expenses/:id", asyncHandler(async (req, res) => {
  if (!validId(req.params.id)) throw new HttpError(400, "Identifikator noto'g'ri");
  const removed = await Expense.findByIdAndDelete(req.params.id);
  if (!removed) throw new HttpError(404, "Xarajat topilmadi");
  res.json({ id: removed._id });
}));

module.exports = router;
