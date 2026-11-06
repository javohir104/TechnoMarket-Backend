const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const authRoutes = require("../src/routes/auth");
const ordersRoutes = require("../src/routes/orders");
const User = require("../src/models/User");
const Order = require("../src/models/Order");
const { errorHandler } = require("../src/middleware/errors");
const { signAccessToken } = require("../src/utils/tokens");

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/orders", ordersRoutes);
app.use(errorHandler);

describe("Profil tizimi, Login va Xaridlar tarixi testlari", () => {
  it("Foydalanuvchi telefon raqami (+998958125012) orqali login qila olishi kerak", async () => {
    const passwordHash = await bcrypt.hash("secret123", 10);
    const mockUser = {
      _id: "507f1f77bcf86cd799439033",
      id: "507f1f77bcf86cd799439033",
      email: "javohir@technomarket.uz",
      username: "javohir",
      phone: "+998958125012",
      name: "Javohir Akmalov",
      role: "user",
      passwordHash,
      save: async () => {},
    };

    const origFindOne = User.findOne;
    User.findOne = async (filter) => {
      // Telefon yoki email yoki username mos kelsa
      return mockUser;
    };

    try {
      const res = await request(app)
        .post("/auth/login")
        .send({ identifier: "+998958125012", password: "secret123" });

      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      assert.equal(res.body.user.email, "javohir@technomarket.uz");
      assert.equal(res.body.user.username, "javohir");
      assert.equal(res.body.user.phone, "+998958125012");
    } finally {
      User.findOne = origFindOne;
    }
  });

  it("Foydalanuvchi username orqali login qila olishi kerak", async () => {
    const passwordHash = await bcrypt.hash("secret123", 10);
    const mockUser = {
      _id: "507f1f77bcf86cd799439033",
      id: "507f1f77bcf86cd799439033",
      email: "javohir@technomarket.uz",
      username: "javohir_akmalov",
      name: "Javohir Akmalov",
      role: "user",
      passwordHash,
      save: async () => {},
    };

    const origFindOne = User.findOne;
    User.findOne = async () => mockUser;

    try {
      const res = await request(app)
        .post("/auth/login")
        .send({ identifier: "javohir_akmalov", password: "secret123" });

      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      assert.equal(res.body.user.username, "javohir_akmalov");
    } finally {
      User.findOne = origFindOne;
    }
  });

  it("PATCH /auth/profile orqali foydalanuvchi ism, username va profil rasmini yangilay olishi kerak", async () => {
    const mockUser = {
      _id: "507f1f77bcf86cd799439044",
      id: "507f1f77bcf86cd799439044",
      email: "user@test.uz",
      username: "old_user",
      name: "Old Name",
      phone: "",
      picture: "",
      role: "user",
      save: async function () {
        return this;
      },
    };

    const token = signAccessToken(mockUser);
    const origFindById = User.findById;
    const origFindOne = User.findOne;

    User.findById = async () => mockUser;
    User.findOne = async () => null; // Yangi username boshqa birovda band emas

    try {
      const res = await request(app)
        .patch("/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Yangi Ism",
          username: "new_cool_username",
          phone: "+998901234567",
          picture: "https://api.dicebear.com/7.x/bottts/svg?seed=TM_Tech",
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.user.name, "Yangi Ism");
      assert.equal(res.body.user.username, "new_cool_username");
      assert.equal(res.body.user.phone, "+998901234567");
      assert.equal(res.body.user.picture, "https://api.dicebear.com/7.x/bottts/svg?seed=TM_Tech");
    } finally {
      User.findById = origFindById;
      User.findOne = origFindOne;
    }
  });

  it("PATCH /auth/profile agar username boshqa foydalanuvchida band bo'lsa 409 xatolik qaytarishi kerak", async () => {
    const mockUser = {
      _id: "507f1f77bcf86cd799439044",
      id: "507f1f77bcf86cd799439044",
      email: "user@test.uz",
      username: "my_user",
      role: "user",
      save: async () => {},
    };

    const token = signAccessToken(mockUser);
    const origFindById = User.findById;
    const origFindOne = User.findOne;

    User.findById = async () => mockUser;
    User.findOne = async () => ({ _id: "other_id", username: "taken_username" }); // band username

    try {
      const res = await request(app)
        .patch("/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "taken_username" });

      assert.equal(res.status, 409);
      assert.match(res.body.error, /allaqachon band/);
    } finally {
      User.findById = origFindById;
      User.findOne = origFindOne;
    }
  });

  it("GET /orders/my-orders autentifikatsiyalangan foydalanuvchining xaridlar tarixini qaytarishi kerak", async () => {
    const mockUser = {
      _id: "507f1f77bcf86cd799439055",
      id: "507f1f77bcf86cd799439055",
      email: "customer@gmail.com",
      phone: "+998901234567",
      role: "user",
    };

    const token = signAccessToken(mockUser);
    const origUserFindById = User.findById;
    const origOrderFind = Order.find;

    User.findById = () => ({
      lean: async () => mockUser,
    });

    Order.find = () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [
            {
              _id: "order123",
              orderNumber: "TM-000001",
              status: "delivered",
              total: 4500000,
              deliveryMethod: "courier",
              deliveryFee: 0,
              items: [{ name: "iPhone 15", quantity: 1, unitPrice: 4500000, type: "phone" }],
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      }),
    });

    try {
      const res = await request(app)
        .get("/orders/my-orders")
        .set("Authorization", `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].orderNumber, "TM-000001");
      assert.equal(res.body[0].status, "delivered");
      assert.equal(res.body[0].items[0].name, "iPhone 15");
    } finally {
      User.findById = origUserFindById;
      Order.find = origOrderFind;
    }
  });
});
