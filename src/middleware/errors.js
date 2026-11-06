const { ZodError } = require("zod");

function notFound(_req, res) {
  res.status(404).json({ error: "Topilmadi" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first && first.path.length ? first.path.join(".") : "";
    return res.status(400).json({ error: first ? first.message : "Ma'lumotlar noto'g'ri", field });
  }
  if (err && err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  if (err && err.code === 11000) return res.status(409).json({ error: "Bunday yozuv allaqachon mavjud" });
  if (err && (err.name === "ValidationError" || err.name === "CastError")) {
    return res.status(400).json({ error: "Ma'lumotlar noto'g'ri" });
  }
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON noto'g'ri" });
  if (err && err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Rasm hajmi 5 MB dan oshmasligi kerak" : "Rasm yuklashda xatolik";
    return res.status(400).json({ error: msg });
  }
  console.error(err && err.stack ? err.stack : err); // maxfiy ma'lumotlar mijozga chiqmaydi
  return res.status(500).json({ error: "Serverda xatolik. Keyinroq urinib ko'ring." });
}

module.exports = { notFound, errorHandler };
