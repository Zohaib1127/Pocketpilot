import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
    },

    amount: {
      type: Number,
      required: [true, "Please add an amount"],
    },

    type: {
      type: String,
      enum: ["income", "expense"],
      required: [true, "Please specify type as income or expense"],
    },

    // Step 1: Updated category schema with enum & default
    category: {
      type: String,
      enum: [
        "Food",
        "Travel",
        "Shopping",
        "Salary",
        "Bills",
        "Health",
        "Education",
        "Entertainment",
        "Other",
      ],
      default: "Other",
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;