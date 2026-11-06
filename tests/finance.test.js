const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, teardown, orderBody } = require("./helpers");
const Product = require("../src/models/Product");

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await teardown(); });

const mk = async (body) => (await ctx.asAdmin(ctx.api.post("/admin/products")).send(body)).body;
const order = async (items) => (await ctx.api.post("/orders").send(orderBody(items))).body;
const status = (id, s, extra = {}) => ctx.asAdmin(ctx.api.patch(`/admin/orders/${id}/status`)).send({ status: s, ...extra });
const costs = (id, c) => ctx.asAdmin(ctx.api.patch(`/admin/orders/${id}/costs`)).send(c);
const deliver = async (id) => { await status(id, "confirmed"); await status(id, "shipped"); return status(id, "delivered"); };
const report = async (q = "") => (await ctx.asAdmin(ctx.api.get(`/admin/finance/report${q}`))).body;

test("foyda hisobi: tushum ≠ foyda (qo'lda hisoblangan natija bilan solishtiriladi)", async () => {
  const P = await mk({ name: "iPhone 15", brand: "Apple", price: 5000000, costPrice: 4000000, stock: 10 });
  const A = await mk({ name: "Quvvatlagich", type: "accessory", price: 100000, costPrice: 40000, stock: 10 });

  // O1: telefon + 2 ta aksessuar, yetkazildi, xarajat 40 000
  const o1 = await order([{ productId: P._id, quantity: 1 }, { productId: A._id, quantity: 2 }]);
  await deliver(o1.id);
  await costs(o1.id, { delivery: 30000, packaging: 10000 });

  // O2: yetkazildi, keyin qaytarildi (omborga qaytdi), qo'shimcha zarar 50 000
  const o2 = await order([{ productId: P._id, quantity: 1 }]);
  await deliver(o2.id);
  await costs(o2.id, { delivery: 30000 });
  const returned = await status(o2.id, "returned", { restock: true });
  assert.equal(returned.status, 200);
  await costs(o2.id, { returnLoss: 50000 });

  // O3: bekor qilindi, lekin 20 000 xarajat ketgan edi
  const o3 = await order([{ productId: P._id, quantity: 1 }]);
  await status(o3.id, "confirmed");
  await status(o3.id, "cancelled");
  await costs(o3.id, { delivery: 20000 });

  // O4: hali yetkazilmagan — foydaga kirmaydi
  await order([{ productId: P._id, quantity: 1 }]);

  // Umumiy xarajatlar
  assert.equal((await ctx.asAdmin(ctx.api.post("/admin/finance/expenses")).send({ category: "advertising", amount: 100000 })).status, 201);
  assert.equal((await ctx.asAdmin(ctx.api.post("/admin/finance/expenses")).send({ category: "rent", amount: 200000 })).status, 201);
  assert.equal((await ctx.asAdmin(ctx.api.post("/admin/finance/expenses")).send({ category: "rent", amount: -5 })).status, 400);

  const r = await report();
  const t = r.totals;
  assert.equal(t.revenue, 10200000);
  assert.equal(t.refunds, 5000000);
  assert.equal(t.netRevenue, 5200000);
  assert.equal(t.cogsPhones, 8000000);
  assert.equal(t.cogsAccessories, 80000);
  assert.equal(t.cogsRecovered, 4000000);
  assert.equal(t.cogs, 4080000);
  assert.equal(t.grossProfit, 1120000);
  assert.equal(t.orderCosts, 70000);
  assert.equal(t.losses, 70000);
  assert.equal(t.expenses, 300000);
  assert.equal(t.netProfit, 680000);
  assert.ok(t.netProfit < t.netRevenue, "sof foyda tushumga teng bo'lmasligi kerak");

  assert.equal(r.series.length, 1);
  assert.equal(r.series[0].netProfit, 680000);
  assert.deepEqual(r.expenseByCategory, { advertising: 100000, rent: 200000 });
  assert.equal(r.pending.count, 1);
  assert.equal(r.pending.expectedRevenue, 5000000);
  assert.equal(r.warnings.profitIsEstimate, false);

  // Ombor: 10 -1 -1 +1 -1 +1 -1 = 8 ta telefon, 8 ta aksessuar
  assert.equal((await Product.findById(P._id)).stock, 8);
  assert.equal(r.inventory.inventoryCost, 8 * 4000000 + 8 * 40000);
  assert.equal(r.inventory.unitsInStock, 16);

  // Eng ko'p sotilganlar: qaytarilgan buyurtma hisobga olinmaydi
  const topPhone = r.topProducts.find((x) => x.name === "iPhone 15");
  assert.equal(topPhone.quantity, 1);
  assert.equal(topPhone.profit, 1000000);
  assert.equal((await Product.findById(P._id)).soldCount, 1);

  // SNAPSHOT: mahsulot narxi/tannarxi keyin o'zgarsa, eski buyurtma foydasi o'zgarmaydi
  const upd = await ctx.asAdmin(ctx.api.put(`/admin/products/${P._id}`)).send({ price: 7000000, costPrice: 6500000 });
  assert.equal(upd.status, 200);
  const r2 = await report();
  assert.deepEqual(r2.totals, r.totals);
  const detail = await ctx.asAdmin(ctx.api.get(`/admin/orders/${o1.id}`));
  assert.equal(detail.body.items[0].unitPrice, 5000000);
  assert.equal(detail.body.items[0].costPrice, 4000000);
  assert.equal(detail.body.profit, 5200000 - 4080000 - 40000);
});

test("tannarxi kiritilmagan telefon sotilsa — hisobot ogohlantiradi (foydani chiroyli ko'rsatib aldamaydi)", async () => {
  const X = await mk({ name: "Tannarxsiz telefon", price: 3000000, stock: 2 });
  const o = await order([{ productId: X._id, quantity: 1 }]);
  await deliver(o.id);
  const r = await report();
  assert.equal(r.warnings.missingCostOrders, 1);
  assert.equal(r.warnings.profitIsEstimate, true);
  assert.equal(r.inventory.productsMissingCost, 1);
});

test("sana oralig'i va guruhlash tekshiriladi", async () => {
  assert.equal((await ctx.asAdmin(ctx.api.get("/admin/finance/report?from=2026-12-31&to=2026-01-01"))).status, 400);
  assert.equal((await ctx.asAdmin(ctx.api.get("/admin/finance/report?from=2020-01-01&to=2026-01-01"))).status, 400);
  const monthly = await report("?groupBy=month");
  assert.match(monthly.series[0].period, /^\d{4}-\d{2}$/);
  const weekly = await report("?groupBy=week");
  assert.match(weekly.series[0].period, /^\d{4}-\d{2}-\d{2}$/);
  const empty = await report("?from=2001-01-01&to=2001-01-31");
  assert.equal(empty.totals.netProfit, 0);
  assert.equal(empty.series.length, 0);
});
