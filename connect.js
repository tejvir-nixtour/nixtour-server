const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
    return;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    setInterval(() => connectDB(), 5000);
  }
};

module.exports = connectDB;
