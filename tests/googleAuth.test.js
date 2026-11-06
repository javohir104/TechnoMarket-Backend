const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const authRoutes = require("../src/routes/auth");
const googleAuth = require("../src/services/googleAuth");
const User = require("../src/models/User");
const { errorHandler } = require("../src/middleware/errors");
const { verifyAccessToken } = require("../src/utils/tokens");

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.use(errorHandler);

describe("Google OAuth endpoint (POST /auth/google)", () => {
  it("token yuborilmaganda 400 xatolik qaytarishi kerak", async () => {
    const res = await request(app).post("/auth/google").send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Google tokeni/);
  });

  it("yaroqsiz yoki noto'g'ri token yuborilganda 401 xatolik qaytarishi kerak", async () => {
    const res = await request(app).post("/auth/google").send({ credential: "bad_token_123" });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Google tokeni yaroqsiz/);
  });

  it("yangi foydalanuvchi Google orqali kirganda accessToken va user obyekti qaytishi kerak", async () => {
    const origVerify = googleAuth.verifyGoogleToken;
    const origFindOne = User.findOne;
    const origCreate = User.create;

    googleAuth.verifyGoogleToken = async () => ({
      googleId: "google-uid-001",
      email: "newuser@gmail.com",
      name: "Ali Valiyev",
      picture: "https://lh3.googleusercontent.com/avatar.png",
      emailVerified: true,
    });

    let createdData = null;
    User.findOne = async () => null;
    User.create = async (data) => {
      createdData = data;
      return {
        _id: "507f1f77bcf86cd799439011",
        id: "507f1f77bcf86cd799439011",
        email: data.email,
        name: data.name,
        picture: data.picture,
        googleId: data.googleId,
        role: data.role || "user",
      };
    };

    try {
      const res = await request(app).post("/auth/google").send({ credential: "valid_mock_token" });
      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      assert.equal(res.body.user.email, "newuser@gmail.com");
      assert.equal(res.body.user.name, "Ali Valiyev");
      assert.equal(res.body.user.picture, "https://lh3.googleusercontent.com/avatar.png");
      assert.equal(res.body.user.role, "user");

      // Yangi foydalanuvchi ma'lumotlari to'g'ri yaratilganini tekshiramiz
      assert.equal(createdData.email, "newuser@gmail.com");
      assert.ok(createdData.passwordHash);

      // JWT tokenni tekshiramiz
      const tokenPayload = verifyAccessToken(res.body.accessToken);
      assert.equal(tokenPayload.email, "newuser@gmail.com");
      assert.equal(tokenPayload.role, "user");
    } finally {
      googleAuth.verifyGoogleToken = origVerify;
      User.findOne = origFindOne;
      User.create = origCreate;
    }
  });

  it("mavjud foydalanuvchi idToken orqali kirganda profilni yangilab, token qaytarishi kerak", async () => {
    const origVerify = googleAuth.verifyGoogleToken;
    const origFindOne = User.findOne;

    googleAuth.verifyGoogleToken = async () => ({
      googleId: "google-uid-002",
      email: "existing@gmail.com",
      name: "Mavjud Foydalanuvchi",
      picture: "https://lh3.googleusercontent.com/pic2.png",
      emailVerified: true,
    });

    let saved = false;
    const existingDoc = {
      _id: "507f1f77bcf86cd799439022",
      id: "507f1f77bcf86cd799439022",
      email: "existing@gmail.com",
      username: "existing_user",
      name: "",
      picture: "",
      googleId: "",
      role: "user",
      save: async function () {
        saved = true;
      },
    };
    User.findOne = async () => existingDoc;

    try {
      const res = await request(app).post("/auth/google").send({ idToken: "valid_mock_token" });
      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      assert.equal(res.body.user.email, "existing@gmail.com");
      assert.equal(res.body.user.name, "Mavjud Foydalanuvchi");
      assert.equal(saved, true);
    } finally {
      googleAuth.verifyGoogleToken = origVerify;
      User.findOne = origFindOne;
    }
  });
});
