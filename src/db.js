
const mongoose = require("mongoose");
const { config } = require("./config");

async function connectDB(uri = config.mongoUri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
  });

  console.log("MongoDB'ga ulandi");
}

module.exports = { connectDB };
