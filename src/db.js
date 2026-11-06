const mongoose = require("mongoose");
const { config } = require("./config");

async function connectDB(uri = config.mongoUri) {
  await mongoose.connect(uri);
  console.log("MongoDB'ga ulandi");
}

module.exports = { connectDB };
