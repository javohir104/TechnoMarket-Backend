const Order = require("../models/Order");
const Expense = require("../models/Expense");
const Product = require("../models/Product");
const { HttpError } = require("../utils/httpError");

const UZ_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5

function dayStart(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - UZ_OFFSET_MS);
}
function dayEnd(str) {
  return new Date(dayStart(str).getTime() + 24 * 60 * 60 * 1000 - 1);
}
const toUzDate = (date) => new Date(new Date(date).getTime() + UZ_OFFSET_MS);

function bucketKey(date, groupBy) {
  const d = toUzDate(date);
  const day = d.toISOString().slice(0, 10);
  if (groupBy === "month") return day.slice(0, 7);
  if (groupBy === "week") {
    const dow = (d.getUTCDay() + 6) % 7;
    const monday = new Date(d.getTime() - dow * 24 * 60 * 60 * 1000);
    return monday.toISOString().slice(0, 10);
  }
  return day;
}

function parseRange({ from, to }) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const today = toUzDate(new Date()).toISOString().slice(0, 10);
  const toStr = to && re.test(to) ? to : today;
  const fromStr = from && re.test(from) ? from : toUzDate(new Date(Date.now() - 29 * 86400000)).toISOString().slice(0, 10);
  const start = dayStart(fromStr);
  const end = dayEnd(toStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new HttpError(400, "Sana oralig'i noto'g'ri");
  }
  if (end - start > 800 * 86400000) throw new HttpError(400, "Oraliq juda katta");
  return { start, end, from: fromStr, to: toStr };
}

const itemsRevenue = (o) => o.subtotal + (o.deliveryFee || 0);
const orderCostsSum = (o) => (o.costs?.delivery || 0) + (o.costs?.packaging || 0) + (o.costs?.other || 0);

/**
 * Dashboard uchun real database ko'rsatkichlari:
 * 1. Bugungi savdo
 * 2. Oylik savdo
 * 3. Jami sotuvlar
 * 4. Oylik xarajatlar
 * 5. Sotilgan mahsulotlarning tannarxi (oylik)
 * 6. Sof daromad (oylik)
 * 7. Kutilayotgan buyurtmalar
 * 8. Tugallangan buyurtmalar
 */
async function getDashboardStats() {
  const now = new Date();
  const uzNow = toUzDate(now);
  const todayStr = uzNow.toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  const startOfToday = dayStart(todayStr);
  const endOfToday = dayEnd(todayStr);

  const startOfMonth = dayStart(`${currentMonthStr}-01`);
  const [y, m] = currentMonthStr.split("-").map(Number);
  const nextMonthDate = new Date(Date.UTC(y, m, 1) - UZ_OFFSET_MS);
  const endOfMonth = new Date(nextMonthDate.getTime() - 1);

  // Barcha delivered buyurtmalar va joriy oydagi buyurtmalar
  const [allDeliveredOrders, monthExpenses, pendingOrders] = await Promise.all([
    Order.find({ status: "delivered" }).lean(),
    Expense.find({ date: { $gte: startOfMonth, $lte: endOfMonth } }).lean(),
    Order.find({ status: { $in: ["new", "confirmed", "shipped"] } }).lean(),
  ]);

  let todayRevenue = 0;
  let todayCount = 0;
  let monthRevenue = 0;
  let monthDeliveredCount = 0;
  let monthCogs = 0;
  let totalRevenue = 0;
  let totalDeliveredCount = allDeliveredOrders.length;

  for (const o of allDeliveredOrders) {
    const rev = itemsRevenue(o);
    totalRevenue += rev;

    const delDate = o.deliveredAt ? new Date(o.deliveredAt) : new Date(o.updatedAt || o.createdAt);
    if (delDate >= startOfMonth && delDate <= endOfMonth) {
      monthRevenue += rev;
      monthDeliveredCount += 1;
      monthCogs += (o.items || []).reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0);
    }
    if (delDate >= startOfToday && delDate <= endOfToday) {
      todayRevenue += rev;
      todayCount += 1;
    }
  }

  const monthExpensesTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const monthGrossProfit = monthRevenue - monthCogs;
  const monthNetProfit = monthGrossProfit - monthExpensesTotal;

  const pendingRevenue = pendingOrders.reduce((s, o) => s + itemsRevenue(o), 0);

  // Ombordagi mahsulotlar statistikasi
  const stockProducts = await Product.find({ isActive: true }).select("+costPrice stock price").lean();
  let inventoryCost = 0;
  let inventoryRetail = 0;
  let unitsInStock = 0;
  for (const p of stockProducts) {
    if (p.stock > 0) {
      unitsInStock += p.stock;
      inventoryRetail += (p.price || 0) * p.stock;
      inventoryCost += (p.costPrice || 0) * p.stock;
    }
  }

  return {
    today: {
      revenue: todayRevenue,
      count: todayCount,
    },
    month: {
      revenue: monthRevenue,
      cogs: monthCogs,
      grossProfit: monthGrossProfit,
      expenses: monthExpensesTotal,
      netProfit: monthNetProfit,
      count: monthDeliveredCount,
    },
    total: {
      revenue: totalRevenue,
      count: totalDeliveredCount,
    },
    pending: {
      count: pendingOrders.length,
      revenue: pendingRevenue,
    },
    inventory: {
      inventoryCost,
      inventoryRetail,
      unitsInStock,
    },
  };
}

/**
 * Tanlangan davr bo'yicha to'liq va professional moliyaviy hisobot
 */
async function buildReport(query = {}) {
  const { start, end, from, to } = parseRange(query);
  const groupBy = ["day", "week", "month"].includes(query.groupBy) ? query.groupBy : "month";
  const inRange = { $gte: start, $lte: end };

  const [orders, expenses, pendingOrders, stockProducts] = await Promise.all([
    Order.find({
      status: { $in: ["delivered", "returned", "cancelled"] },
      $or: [
        { deliveredAt: inRange },
        { returnedAt: inRange },
        { cancelledAt: inRange },
        { createdAt: inRange },
      ],
    }).lean(),
    Expense.find({ date: inRange }).lean(),
    Order.find({ status: { $in: ["new", "confirmed", "shipped"] } }).lean(),
    Product.find({ isActive: true }).select("+costPrice stock price").lean(),
  ]);

  const buckets = new Map();
  const initBucket = () => ({
    revenue: 0,
    refunds: 0,
    netRevenue: 0,
    cogs: 0,
    grossProfit: 0,
    orderCosts: 0,
    losses: 0,
    expenses: 0,
    netProfit: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
  });

  const getBucket = (date) => {
    const key = bucketKey(date, groupBy);
    if (!buckets.has(key)) buckets.set(key, initBucket());
    return buckets.get(key);
  };

  const topMap = new Map();
  let revenue = 0;
  let refunds = 0;
  let cogsPhones = 0;
  let cogsAccessories = 0;
  let cogsRecovered = 0;
  let orderCosts = 0;
  let losses = 0;
  let totalExpenses = 0;
  let deliveredCount = 0;
  let cancelledCount = 0;
  let missingCostOrders = 0;

  for (const o of orders) {
    if (o.status === "delivered") {
      const d = o.deliveredAt || o.createdAt;
      const b = getBucket(d);
      const rev = itemsRevenue(o);
      const oCosts = orderCostsSum(o);

      revenue += rev;
      b.revenue += rev;
      orderCosts += oCosts;
      b.orderCosts += oCosts;
      deliveredCount += 1;
      b.deliveredOrders += 1;

      let orderMissingCost = false;
      for (const i of o.items || []) {
        if (i.costPrice === null || i.costPrice === undefined) {
          orderMissingCost = true;
        }
        const itemCost = (i.costPrice || 0) * i.quantity;
        if (i.type === "accessory") {
          cogsAccessories += itemCost;
        } else {
          cogsPhones += itemCost;
        }
        b.cogs += itemCost;

        const pId = String(i.product || i.name);
        const t = topMap.get(pId) || { productId: pId, name: i.name, quantity: 0, revenue: 0, cost: 0, profit: 0 };
        t.quantity += i.quantity;
        t.revenue += i.unitPrice * i.quantity;
        t.cost += itemCost;
        t.profit = t.revenue - t.cost;
        topMap.set(pId, t);
      }
      if (orderMissingCost) {
        missingCostOrders += 1;
      }
    } else if (o.status === "returned") {
      const d = o.returnedAt || o.deliveredAt || o.createdAt;
      const b = getBucket(d);
      const rev = itemsRevenue(o);
      const oCosts = orderCostsSum(o);
      const rLoss = o.returnLoss || 0;

      revenue += rev;
      refunds += rev;
      b.revenue += rev;
      b.refunds += rev;
      orderCosts += oCosts;
      b.orderCosts += oCosts;
      losses += rLoss;
      b.losses += rLoss;

      for (const i of o.items || []) {
        const itemCost = (i.costPrice || 0) * i.quantity;
        if (i.type === "accessory") {
          cogsAccessories += itemCost;
        } else {
          cogsPhones += itemCost;
        }
        if (o.restocked) {
          cogsRecovered += itemCost;
        } else {
          b.cogs += itemCost;
        }
      }
    } else if (o.status === "cancelled") {
      const d = o.cancelledAt || o.createdAt;
      const b = getBucket(d);
      const cLoss = orderCostsSum(o);
      losses += cLoss;
      b.losses += cLoss;
      cancelledCount += 1;
      b.cancelledOrders += 1;
    }
  }

  const expenseByCategory = {};
  for (const e of expenses) {
    const b = getBucket(e.date);
    b.expenses += e.amount;
    totalExpenses += e.amount;
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
  }

  const series = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([period, b]) => {
      const netRev = b.revenue - b.refunds;
      const grossProfit = netRev - b.cogs;
      const netProfit = grossProfit - b.orderCosts - b.losses - b.expenses;
      return {
        period,
        ...b,
        netRevenue: netRev,
        grossProfit,
        netProfit,
      };
    });

  const netRevenue = revenue - refunds;
  const cogs = cogsPhones + cogsAccessories - cogsRecovered;
  const grossProfit = netRevenue - cogs;
  const netProfit = grossProfit - orderCosts - losses - totalExpenses;

  // Ombordagi mahsulotlar tannarxi va tannarxi yo'q mahsulotlar soni
  let inventoryCost = 0;
  let inventoryRetail = 0;
  let unitsInStock = 0;
  let productsMissingCost = 0;
  for (const p of stockProducts) {
    if (p.costPrice === null || p.costPrice === undefined) {
      productsMissingCost += 1;
    }
    if (p.stock > 0) {
      unitsInStock += p.stock;
      inventoryRetail += (p.price || 0) * p.stock;
      inventoryCost += (p.costPrice || 0) * p.stock;
    }
  }

  return {
    range: { from, to, groupBy },
    totals: {
      revenue,
      refunds,
      netRevenue,
      cogsPhones,
      cogsAccessories,
      cogsRecovered,
      cogs,
      grossProfit,
      orderCosts,
      losses,
      expenses: totalExpenses,
      netProfit,
      deliveredOrders: deliveredCount,
      cancelledOrders: cancelledCount,
    },
    warnings: {
      missingCostOrders,
      profitIsEstimate: missingCostOrders > 0,
    },
    pending: {
      count: pendingOrders.length,
      expectedRevenue: pendingOrders.reduce((s, o) => s + itemsRevenue(o), 0),
    },
    expenseByCategory,
    series,
    topProducts: [...topMap.values()].sort((a, b) => b.quantity - a.quantity || b.profit - a.profit).slice(0, 10),
    inventory: { inventoryCost, inventoryRetail, unitsInStock, productsMissingCost },
  };
}

module.exports = { buildReport, getDashboardStats, parseRange, bucketKey, dayStart, dayEnd };
