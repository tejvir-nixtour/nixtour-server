const mongoose = require("mongoose");

const authSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
    },
    access_group: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Auth", authSchema);
