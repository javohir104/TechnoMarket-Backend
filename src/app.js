const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { config } = require("./config");
const { notFound, errorHandler } = require("./middleware/errors");
const { requireAdmin } = require("./middleware/auth");

const limiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || config.clientOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
      exposedHeaders: ["X-Total-Count", "X-Total-Pages"],
      optionsSuccessStatus: 204,
    })
  );
  app.use(express.json({ limit: "100kb" }));

  app.use(
    "/uploads",
    express.static(config.uploadDir, {
      index: false,
      dotfiles: "deny",
      maxAge: "30d",
      immutable: true,
      setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
    })
  );

  app.use(limiter(60 * 1000, 300, "So'rovlar juda ko'p. Birozdan keyin urinib ko'ring."));
  app.get("/", (_req, res) => res.json({ ok: true, service: "Techno Market API" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Techno Market API" }));

  app.use("/auth", limiter(15 * 60 * 1000, 30, "Urinishlar juda ko'p. 15 daqiqadan keyin urinib ko'ring."), require("./routes/auth"));
  app.use("/products", require("./routes/products"));
  app.use("/categories", require("./routes/categories"));
  app.use("/orders", limiter(60 * 60 * 1000, 60, "Buyurtmalar juda ko'p yuborildi. Keyinroq urinib ko'ring."), require("./routes/orders"));

  app.use("/admin", limiter(60 * 1000, 200, "So'rovlar juda ko'p."), requireAdmin);
  app.use("/admin/products", require("./routes/admin/products"));
app.use("/admin/diagnostics", require("./routes/admin/diagnostics"));
  app.use("/admin/categories", require("./routes/admin/categories"));
  app.use("/admin/orders", require("./routes/admin/orders"));
  app.use("/admin/finance", require("./routes/admin/finance"));
  app.use("/admin/users", require("./routes/admin/users"));
  app.use("/admin/uploads", require("./routes/admin/uploads"));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
