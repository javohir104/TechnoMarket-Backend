const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const User = require("../models/User");
const { signAccessToken } = require("../utils/tokens");
const { requireAuth } = require("../middleware/auth");
const { HttpError, asyncHandler } = require("../utils/httpError");
const googleAuth = require("../services/googleAuth");

const router = express.Router();

async function checkUserExists(filter) {
  try {
    const res = await User.findOne(filter);
    return Boolean(res);
  } catch (_e) {
    return false;
  }
}

/**
 * Unikal username generatsiya qilish
 */
async function generateUniqueUsername(base) {
  let clean = (base || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 18);
  if (clean.length < 3) clean = "user" + Math.floor(1000 + Math.random() * 9000);

  let candidate = clean;
  let counter = 1;
  // Cheksiz sikldan himoyalangan (maksimal 15 ta urinish)
  while (counter <= 15 && (await checkUserExists({ username: candidate }))) {
    candidate = `${clean.slice(0, 14)}_${counter}`;
    counter++;
  }
  if (counter > 15) {
    candidate = `${clean.slice(0, 10)}_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return candidate;
}

// Foydalanuvchi obyektini xavfsiz qaytarish
function formatUserResponse(user) {
  return {
    id: user._id,
    email: user.email,
    username: user.username || "",
    name: user.name || "",
    phone: user.phone || "",
    picture: user.picture || "",
    role: user.role,
    hasGoogle: Boolean(user.googleId),
  };
}

// Ommaviy ro'yxatdan o'tish (email/parol va ixtiyoriy name/username/phone)
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim().slice(0, 80);
    const phone = String(body.phone || "").trim().slice(0, 30);
    let username = String(body.username || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "To'g'ri email manzilini kiriting");
    }
    if (!password || password.length < 6) {
      throw new HttpError(400, "Parol kamida 6 ta belgidan iborat bo'lishi kerak");
    }

    if (await checkUserExists({ email })) {
      throw new HttpError(409, "Ushbu email allaqachon ro'yxatdan o'tgan");
    }

    if (username) {
      if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
        throw new HttpError(400, "Username 3-30 ta lotin harfi, raqam yoki pastki chiziqdan iborat bo'lishi kerak");
      }
      if (await checkUserExists({ username })) {
        throw new HttpError(409, "Ushbu username allaqachon band. Iltimos boshqasini tanlang");
      }
    } else {
      username = await generateUniqueUsername(email.split("@")[0]);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      username,
      name: name || undefined,
      phone: phone || undefined,
      passwordHash,
      role: "user",
    });

    res.status(201).json(formatUserResponse(user));
  })
);

// Kirish (Email, Username yoki Telefon raqam orqali!)
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const identifier = String(body.identifier || body.email || body.login || "").trim();
    const password = String(body.password || "");

    if (!identifier || !password) {
      throw new HttpError(400, "Email, username yoki telefon raqami hamda parolni kiriting");
    }

    // Identifikator turini aniqlaymiz:
    let user = null;
    const lowerIdent = identifier.toLowerCase();

    if (identifier.includes("@")) {
      // Email
      user = await User.findOne({ email: lowerIdent });
    } else {
      // Telefon yoki Username
      const digitsOnly = identifier.replace(/\D/g, "");
      const isLikelyPhone = digitsOnly.length >= 9 && (identifier.startsWith("+") || !/[a-zA-Z]/.test(identifier));

      if (isLikelyPhone) {
        // Telefon bo'yicha qidirish (oxirgi 9 ta raqam bo'yicha)
        user = await User.findOne({ phone: new RegExp(digitsOnly.slice(-9) + "$") });
      }

      // Agar telefon bo'yicha topilmasa, username bo'yicha qidiramiz
      if (!user) {
        user = await User.findOne({ username: lowerIdent });
      }

      // Agar hali ham topilmasa, email maydonini ham tekshirib ko'ramiz
      if (!user) {
        user = await User.findOne({ email: lowerIdent });
      }
    }

    if (!user) {
      throw new HttpError(401, "Kirish ma'lumotlari yoki parol noto'g'ri");
    }

    let ok = user.passwordHash && (await bcrypt.compare(password, user.passwordHash));

    // Agar hisob Google orqali ochilgan bo'lsa va hali shaxsiy parol kiritilmagan bo'lsa:
    if (!ok && user.googleId && !user.hasCustomPassword) {
      user.passwordHash = await bcrypt.hash(password, 12);
      user.hasCustomPassword = true;
      await user.save();
      ok = true;
    }

    if (!ok) {
      throw new HttpError(401, "Kirish ma'lumotlari yoki parol noto'g'ri");
    }

    // Agar foydalanuvchida username bo'lmasa, uni yaratib qo'yamiz
    if (!user.username) {
      user.username = await generateUniqueUsername(user.email.split("@")[0]);
      await user.save();
    }

    res.json({
      accessToken: signAccessToken(user),
      user: formatUserResponse(user),
    });
  })
);

// Google OAuth autentifikatsiyasi
router.post(
  "/google",
  asyncHandler(async (req, res) => {
    const rawToken = req.body?.credential || req.body?.idToken || req.body?.token;
    if (!rawToken || typeof rawToken !== "string") {
      throw new HttpError(400, "Google tokeni (credential yoki idToken) kiritilmagan");
    }

    const googleProfile = await googleAuth.verifyGoogleToken(rawToken);

    let user = await User.findOne({ email: googleProfile.email });
    if (!user) {
      // Google orqali yangi ro'yxatdan o'tgan foydalanuvchi
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const generatedUsername = await generateUniqueUsername(googleProfile.email.split("@")[0]);

      user = await User.create({
        email: googleProfile.email,
        username: generatedUsername,
        name: googleProfile.name || undefined,
        picture: googleProfile.picture || undefined,
        googleId: googleProfile.googleId || undefined,
        passwordHash,
        hasCustomPassword: false,
        role: "user",
      });
    } else {
      // Agar foydalanuvchi bazada mavjud bo'lsa, mavjud akkauntga ulaymiz
      let modified = false;
      if (!user.googleId && googleProfile.googleId) {
        user.googleId = googleProfile.googleId;
        modified = true;
      }
      if (!user.name && googleProfile.name) {
        user.name = googleProfile.name;
        modified = true;
      }
      if (!user.picture && googleProfile.picture) {
        user.picture = googleProfile.picture;
        modified = true;
      }
      if (!user.username) {
        user.username = await generateUniqueUsername(user.email.split("@")[0]);
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    }

    const accessToken = signAccessToken(user);

    res.json({
      accessToken,
      user: formatUserResponse(user),
    });
  })
);

// Joriy foydalanuvchi profilini olish
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.sub);
    if (!user) throw new HttpError(404, "Foydalanuvchi topilmadi");

    if (!user.username) {
      user.username = await generateUniqueUsername(user.email.split("@")[0]);
      await user.save();
    }

    res.json(formatUserResponse(user));
  })
);

// Profil ma'lumotlarini tahrirlash (Ism, Username, Telefon, Profil rasmi)
router.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.sub);
    if (!user) throw new HttpError(404, "Foydalanuvchi topilmadi");

    const body = req.body || {};

    // Ism
    if (typeof body.name === "string") {
      user.name = body.name.trim().slice(0, 100);
    }

    // Telefon
    if (typeof body.phone === "string") {
      user.phone = body.phone.trim().slice(0, 30);
    }

    // Profil rasmi
    if (typeof body.picture === "string") {
      const pic = body.picture.trim();
      // URL yoki preset avatar kodi
      user.picture = pic.slice(0, 500);
    }

    // Username o'zgartirish
    if (typeof body.username === "string") {
      const newUsername = body.username.trim().toLowerCase();
      if (newUsername && newUsername !== user.username) {
        if (!/^[a-z0-9_.]{3,30}$/.test(newUsername)) {
          throw new HttpError(
            400,
            "Username 3-30 ta belgidan iborat bo'lib, faqat lotin harflari, raqamlar, nuqta va pastki chiziqdan iborat bo'lishi mumkin"
          );
        }

        const existing = await User.findOne({ username: newUsername, _id: { $ne: user._id } });
        if (existing) {
          throw new HttpError(409, `"${newUsername}" username allaqachon band. Iltimos boshqasini tanlang.`);
        }
        user.username = newUsername;
      }
    }

    await user.save();
    res.json({
      success: true,
      message: "Profil ma'lumotlari muvaffaqiyatli yangilandi",
      user: formatUserResponse(user),
    });
  })
);

// Parol o'rnatish yoki yangilash
router.post(
  "/set-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak").max(128),
      })
      .safeParse(req.body || {});

    if (!body.success || !body.data.password) {
      throw new HttpError(400, "Yangi parolni to'g'ri kiriting (kamida 6 ta belgi)");
    }

    const user = await User.findById(req.user.sub);
    if (!user) throw new HttpError(404, "Foydalanuvchi topilmadi");

    user.passwordHash = await bcrypt.hash(body.data.password, 12);
    user.hasCustomPassword = true;
    await user.save();

    res.json({ success: true, message: "Parol muvaffaqiyatli saqlandi" });
  })
);

module.exports = router;
