const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { setup, teardown } = require("./helpers");
const { runProductDiagnostics } = require("../src/utils/productDiagnostics");

let ctx;

before(async () => {
  ctx = await setup();
});

after(async () => {
  await teardown();
});

test("NODE_ENV production emas bo'lsa diagnostika bajarilmaydi (null)", async () => {
  const config = { env: "development" };
  const result = await runProductDiagnostics(config);
  assert.equal(result, null);
});

test("NODE_ENV production bo'lsa diagnostika bajariladi va read-only bo'ladi", async () => {
  const config = { env: "production" };
  const before = await runProductDiagnostics(config);
  const after = await runProductDiagnostics(config);

  assert.equal(typeof before.database, "string");
  assert.equal(typeof before.collection, "string");
  assert.equal(typeof before.totalProducts, "number");
  assert.equal(typeof before.activeProducts, "number");
  assert.equal(typeof before.demoProducts, "number");
  assert.equal(typeof before.realProducts, "number");
  assert.equal(typeof before.apiVisibleProducts, "number");
  assert.ok(before.apiVisibleProducts <= before.activeProducts);
  assert.ok(before.activeProducts <= before.totalProducts);

  assert.equal(before.totalProducts, after.totalProducts);
  assert.equal(before.activeProducts, after.activeProducts);
  assert.equal(before.apiVisibleProducts, after.apiVisibleProducts);
});

test("Diagnostika natijasida maxfiy ma'lumotlar (URI, parol, token) yo'q", async () => {
  const config = { env: "production" };
  const result = await runProductDiagnostics(config);
  const json = JSON.stringify(result);
  assert.equal(json.includes("MONGODB_URI"), false);
  assert.equal(json.includes("mongodb+srv"), false);
  assert.equal(json.includes("password"), false);
  assert.equal(json.includes("token"), false);
  assert.equal(json.includes("secret"), false);
});
