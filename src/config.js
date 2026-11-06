const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const port = num(process.env.PORT, 3000);

const config = {
  env: process.env.NODE_ENV || "development",
  port,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.ACCESS_TOKEN_SECRET,
  jwtExpires: process.env.ACCESS_TOKEN_EXPIRES || "7d",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === "true",
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads")),
  publicUrl: (process.env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, ""),
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  },
  courierFee: num(process.env.DELIVERY_FEE_COURIER, 0), // mijozdan olinadigan yetkazib berish narxi (so'm)
  minProfit: num(process.env.MIN_PROFIT, 0), // bir dona uchun minimal foyda (so'm)
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
};

// Server ishga tushishidan oldin majburiy sozlamalarni tekshiradi
function assertConfig() {
  const problems = [];
  if (!config.mongoUri) problems.push("MONGODB_URI kiritilmagan");
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    problems.push("ACCESS_TOKEN_SECRET kamida 32 belgidan iborat bo'lishi kerak");
  }
  if (problems.length) throw new Error("Sozlamalar xato: " + problems.join("; "));
}

module.exports = { config, assertConfig };
