const mongoose = require("mongoose");
const { assertConfig } = require("../config");
const { connectDB } = require("../db");
const User = require("../models/User");

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Foydalanish: npm run make-admin -- email@example.com  (avval saytda shu email bilan ro'yxatdan o'ting)");
    process.exit(1);
  }
  assertConfig();
  await connectDB();
  const user = await User.findOneAndUpdate({ email }, { role: "admin" }, { new: true });
  console.log(user ? `${user.email} endi administrator` : `Foydalanuvchi topilmadi: ${email}`);
  await mongoose.disconnect();
}
main().catch(async (e) => { console.error(e.message); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
