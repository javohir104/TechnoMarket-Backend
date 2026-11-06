const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { config } = require("../../config");
const { HttpError, asyncHandler } = require("../../utils/httpError");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 8 } });

// Fayl nomiga yoki Content-Type'ga ishonmaymiz: haqiqiy rasm imzosi (magic bytes) tekshiriladi
function detectExt(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return ".webp";
  return null;
}

router.post("/", upload.array("images", 8), asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length) throw new HttpError(400, "Rasm tanlanmagan");
  await fs.mkdir(config.uploadDir, { recursive: true });
  const urls = [];
  for (const file of req.files) {
    const ext = detectExt(file.buffer);
    if (!ext) throw new HttpError(400, "Faqat JPG, PNG yoki WEBP rasmlar qabul qilinadi");
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    await fs.writeFile(path.join(config.uploadDir, name), file.buffer);
    urls.push(`/uploads/${name}`);
  }
  res.status(201).json({ urls });
}));

module.exports = router;
