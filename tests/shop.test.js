const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, teardown, orderBody } = require("./helpers");
const Product = require("../src/models/Product");

let ctx;
let isFerret = false;
before(async () => {
  ctx = await setup();
  const mongoose = require("mongoose");
  const info = await mongoose.connection.db.admin().command({ buildInfo: 1 });
  isFerret = Boolean(info.ferretdbVersion);
});
after(async () => { await teardown(); });

const phone = (over = {}) => ({ name: "Apple iPhone 15 128GB", brand: "Apple", type: "phone", condition: "new", storage: "128GB", color: "Qora", price: 5000000, costPrice: 4000000, stock: 5, ...over });

test("admin bo'lmagan foydalanuvchi admin API'ga kira olmaydi", async () => {
  const noAuth = await ctx.api.post("/admin/products").send(phone());
  assert.equal(noAuth.status, 401);
  const asUser = await ctx.api.post("/admin/products").set("Authorization", `Bearer ${ctx.userToken}`).send(phone());
  assert.equal(asUser.status, 403);
  const finance = await ctx.api.get("/admin/finance/report").set("Authorization", `Bearer ${ctx.userToken}`);
  assert.equal(finance.status, 403);
});

test("ro'yxatdan o'tishda role body orqali admin qilib bo'lmaydi; qisqa parol rad etiladi", async () => {
  const short = await ctx.api.post("/auth/register").send({ email: "a@b.uz", password: "123" });
  assert.equal(short.status, 400);
  const res = await ctx.api.post("/auth/register").send({ email: "hacker@b.uz", password: "password123", role: "admin" });
  assert.equal(res.status, 201);
  assert.equal(res.body.role, "user");
});

test("mahsulot validatsiyasi: narx <= tannarx va soxta chegirma rad etiladi", async () => {
  const lowPrice = await ctx.asAdmin(ctx.api.post("/admin/products")).send(phone({ price: 3000000 }));
  assert.equal(lowPrice.status, 400);
  const fakeDiscount = await ctx.asAdmin(ctx.api.post("/admin/products")).send(phone({ oldPrice: 4000000 }));
  assert.equal(fakeDiscount.status, 400);
  const bad = await ctx.asAdmin(ctx.api.post("/admin/products")).send(phone({ price: "arzon" }));
  assert.equal(bad.status, 400);
});

test("ommaviy API tannarxni HECH QACHON chiqarmaydi, admin API chiqaradi", async () => {
  const created = await ctx.asAdmin(ctx.api.post("/admin/products")).send(phone({ oldPrice: 5500000 }));
  assert.equal(created.status, 201);
  assert.equal(created.body.costPrice, 4000000);
  await ctx.asAdmin(ctx.api.post("/admin/products")).send(phone({ name: "Yashirin", isActive: false }));

  const list = await ctx.api.get("/products");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1, "nofaol mahsulot ko'rinmasligi kerak");
  assert.equal(list.body[0].costPrice, undefined);
  assert.equal(list.body[0].createdBy, undefined);
  assert.equal(list.body[0].discountPercent, 9);
  const one = await ctx.api.get(`/products/${created.body._id}`);
  assert.equal(one.body.costPrice, undefined);
  assert.equal(list.headers["x-total-count"], "1");

  const adminList = await ctx.asAdmin(ctx.api.get("/admin/products"));
  assert.equal(adminList.body.length, 2);
  assert.equal(adminList.body.find((p) => p.name === "Apple iPhone 15 128GB").margin, 1000000);
});

test("buyurtma: narx mijozdan emas serverdan olinadi, ombor kamayadi, raqam beriladi", async () => {
  const p = await Product.findOne({ name: "Apple iPhone 15 128GB" });
  const res = await ctx.api.post("/orders").send(orderBody([{ productId: String(p._id), quantity: 2, price: 1 }]));
  assert.equal(res.status, 201);
  assert.match(res.body.orderNumber, /^TM-\d{6}$/);
  assert.equal(res.body.total, 10000000);
  assert.equal((await Product.findById(p._id)).stock, 3);
});

test("oversell bloklanadi va ombor buzilmaydi", async () => {
  const p = await Product.findOne({ name: "Apple iPhone 15 128GB" });
  const res = await ctx.api.post("/orders").send(orderBody([{ productId: String(p._id), quantity: 10 }]));
  assert.equal(res.status, 409);
  assert.equal((await Product.findById(p._id)).stock, 3);
});

// FerretDB (SQLite) bitta hujjatdagi shartli update'ni atomik bajarmaydi (driver darajasida tekshirilgan),
// shuning uchun bu test faqat haqiqiy MongoDB/Atlas'da ma'noga ega.
test("oxirgi telefonni bir vaqtda 3 kishi buyurtma qilsa — faqat bittasi muvaffaqiyatli", { skip: false }, async (t) => {
  if (isFerret) return t.skip("FerretDB atomik shartli update'ni qo'llamaydi — haqiqiy MongoDB'da ishga tushiring");
  const created = await ctx.asAdmin(ctx.api.post("/admin/products")).send(phone({ name: "Oxirgi telefon", stock: 1 }));
  const body = orderBody([{ productId: created.body._id, quantity: 1 }]);
  const results = await Promise.all([ctx.api.post("/orders").send(body), ctx.api.post("/orders").send(body), ctx.api.post("/orders").send(body)]);
  const ok = results.filter((r) => r.status === 201).length;
  assert.equal(ok, 1);
  assert.equal((await Product.findById(created.body._id)).stock, 0);
});

test("buyurtma validatsiyasi: manzil majburiy, telefon tekshiriladi, ko'p miqdor rad etiladi", async () => {
  const p = await Product.findOne({ name: "Apple iPhone 15 128GB" });
  const id = String(p._id);
  assert.equal((await ctx.api.post("/orders").send(orderBody([{ productId: id, quantity: 1 }], { address: "" }))).status, 400);
  assert.equal((await ctx.api.post("/orders").send(orderBody([{ productId: id, quantity: 1 }], { phone: "abc" }))).status, 400);
  assert.equal((await ctx.api.post("/orders").send(orderBody([{ productId: id, quantity: 99 }]))).status, 400);
  assert.equal((await ctx.api.post("/orders").send(orderBody([]))).status, 400);
  assert.equal((await ctx.api.post("/orders").send(orderBody([{ productId: { $gt: "" }, quantity: 1 }]))).status, 400, "NoSQL injection");
});

test("holat oqimi: noto'g'ri o'tish rad etiladi, bekor qilinsa ombor tiklanadi, ikki marta tiklanmaydi", async () => {
  const p = await Product.findOne({ name: "Apple iPhone 15 128GB" });
  const before = (await Product.findById(p._id)).stock;
  const o = await ctx.api.post("/orders").send(orderBody([{ productId: String(p._id), quantity: 2 }]));
  assert.equal((await Product.findById(p._id)).stock, before - 2);

  const skip = await ctx.asAdmin(ctx.api.patch(`/admin/orders/${o.body.id}/status`)).send({ status: "delivered" });
  assert.equal(skip.status, 400);

  const cancel = await ctx.asAdmin(ctx.api.patch(`/admin/orders/${o.body.id}/status`)).send({ status: "cancelled", note: "Mijoz rad etdi" });
  assert.equal(cancel.status, 200);
  assert.equal((await Product.findById(p._id)).stock, before);

  const again = await ctx.asAdmin(ctx.api.patch(`/admin/orders/${o.body.id}/status`)).send({ status: "cancelled" });
  assert.equal(again.status, 400);
  assert.equal((await Product.findById(p._id)).stock, before);
  assert.equal(cancel.body.statusHistory.length, 2);
});

test("buyurtmani kuzatish: raqam + telefon mos kelsagina, ichki ma'lumotsiz", async () => {
  const p = await Product.findOne({ name: "Apple iPhone 15 128GB" });
  const o = await ctx.api.post("/orders").send(orderBody([{ productId: String(p._id), quantity: 1 }]));
  const ok = await ctx.api.get("/orders/track").query({ orderNumber: o.body.orderNumber, phone: "90 123 45 67" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, "new");
  assert.equal(JSON.stringify(ok.body).includes("costPrice"), false);
  const wrong = await ctx.api.get("/orders/track").query({ orderNumber: o.body.orderNumber, phone: "+998 90 999 99 99" });
  assert.equal(wrong.status, 404);
});

test("rasm yuklash: soxta fayl rad etiladi, haqiqiy PNG qabul qilinadi", async () => {
  const fake = await ctx.asAdmin(ctx.api.post("/admin/uploads")).attach("images", Buffer.from("<script>alert(1)</script>"), { filename: "x.png", contentType: "image/png" });
  assert.equal(fake.status, 400);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
  const ok = await ctx.asAdmin(ctx.api.post("/admin/uploads")).attach("images", png, { filename: "a.png", contentType: "image/png" });
  assert.equal(ok.status, 201);
  assert.match(ok.body.urls[0], /^\/uploads\/[\w-]+\.png$/);
  const served = await ctx.api.get(ok.body.urls[0]);
  assert.equal(served.status, 200);
  const noAuth = await ctx.api.post("/admin/uploads").attach("images", png, { filename: "a.png" });
  assert.equal(noAuth.status, 401);
});

test("buyurtmada qatnashgan mahsulot o'chirilmaydi, arxivlanadi", async () => {
  const p = await Product.findOne({ name: "Apple iPhone 15 128GB" });
  const res = await ctx.asAdmin(ctx.api.delete(`/admin/products/${p._id}`));
  assert.equal(res.body.archived, true);
  assert.equal((await ctx.api.get("/products")).body.some((x) => x.name === p.name), false);
});
