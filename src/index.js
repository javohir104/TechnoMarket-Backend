
const { config, assertConfig } = require("./config");
const { connectDB } = require("./db");
const { createApp } = require("./app");
const { runProductDiagnostics } = require("./utils/productDiagnostics");

async function main() {
  assertConfig();

  const app = createApp();

  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`TechnoMarket API: port ${config.port}`);
  });

  try {
    await connectDB();
    console.log("MongoDB muvaffaqiyatli ulandi");
    await runProductDiagnostics(config).catch((err) => {
      console.error("Diagnostika xatosi:", err.message);
    });
  } catch (err) {
    console.error("MongoDB ulanish xatosi:", err);
    server.close(() => process.exit(1));
  }
}

main().catch((err) => {
  console.error("Server ishga tushmadi:", err);
  process.exit(1);
});
