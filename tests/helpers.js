const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.test") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/tm_test";
process.env.ACCESS_TOKEN_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.UPLOAD_DIR = require("path").join(require("os").tmpdir(), "tm_test_uploads");
process.env.DELIVERY_FEE_COURIER = "0";

const mongoose = require("mongoose");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/app");
const User = require("../src/models/User");
const { signAccessToken } = require("../src/utils/tokens");

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  const app = createApp();
  const passwordHash = await bcrypt.hash("password123", 4);
  const admin = await User.create({ email: "admin@test.uz", passwordHash, role: "admin" });
  const user = await User.create({ email: "user@test.uz", passwordHash, role: "user" });
  const adminToken = signAccessToken(admin);
  const userToken = signAccessToken(user);
  const api = request(app);
  const asAdmin = (req) => req.set("Authorization", `Bearer ${adminToken}`);
  return { app, api, admin, user, adminToken, userToken, asAdmin };
}

async function teardown() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

const orderBody = (items, extra = {}) => ({
  customerName: "Test Mijoz",
  phone: "+998901234567",
  region: "Toshkent shahri",
  district: "Chilonzor",
  address: "Bunyodkor 1",
  deliveryMethod: "courier",
  items,
  ...extra,
});

module.exports = { setup, teardown, orderBody };
