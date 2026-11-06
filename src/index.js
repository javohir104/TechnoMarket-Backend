const { config, assertConfig } = require("./config");
const { connectDB } = require("./db");
const { createApp } = require("./app");

async function main() {
  assertConfig();
  await connectDB();
  const app = createApp();
  app.listen(config.port, () => console.log(`Telefon Market API: http://localhost:${config.port}`));
}

main().catch((err) => {
  console.error("Server ishga tushmadi:", err.message);
  process.exit(1);
});
