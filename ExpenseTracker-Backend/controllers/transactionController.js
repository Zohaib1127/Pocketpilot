import Transaction from "../models/Transaction.js";

const normalizePaymentMethod = (rawMode, fallback = "cash") => {
  if (!rawMode) return fallback;

  let cleanMode = String(rawMode).toLowerCase().trim();
  cleanMode = cleanMode.replace(/[\s\-_]+/g, "");

  if (cleanMode === "cash") return "cash";
  if (cleanMode === "creditcard") return "credit_card";
  if (cleanMode === "debitcard") return "debit_card";
  if (cleanMode === "banktransfer" || cleanMode === "bank") return "bank_transfer";

  if (cleanMode.includes("debit")) return "debit_card";
  if (cleanMode.includes("credit")) return "credit_card";
  if (
    cleanMode.includes("bank") ||
    cleanMode.includes("transfer") ||
    cleanMode.includes("online") ||
    cleanMode.includes("upi") ||
    cleanMode.includes("neft") ||
    cleanMode.includes("imps") ||
    cleanMode.includes("rtgs")
  ) {
    return "bank_transfer";
  }
  if (cleanMode.includes("cash")) return "cash";

  return fallback;
};

// Add Transaction
export const addTransaction = async (req, res) => {
  try {
    const {
      title,
      amount,
      type,
      category,
      paymentMethod,
      paymentMode,
      payment_method,
      date,
    } = req.body;

    if (!title || !amount || !type || !category) {
      return res.status(400).json({
        message: "Please fill all required fields",
      });
    }

    const rawMode = paymentMethod || paymentMode || payment_method;
    const finalPaymentMethod = normalizePaymentMethod(rawMode, "cash");

    const transaction = await Transaction.create({
      title: title.trim(),
      amount: Number(amount),
      type: type.toLowerCase(),
      category,
      paymentMethod: finalPaymentMethod,
      date: date || new Date(),
      user: req.user._id,
    });

    const io = req.app.get("io");
    if (io) {
      const isIncome = type.toLowerCase() === "income";
      const emoji = isIncome ? "📈" : "📉";
      
      io.to(req.user._id.toString()).emit("new_notification", {
        title: `Transaction Added ${emoji}`,
        message: `${isIncome ? "Received" : "Spent"} ${amount} for "${title}"`,
        type: isIncome ? "success" : "warning", // 👈 Dynamic Success/Warning Type
        data: transaction,
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Transactions
export const getTransactions = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = { user: req.user._id };

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Transaction
export const updateTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    transaction.title = req.body.title ? req.body.title.trim() : transaction.title;
    transaction.amount = req.body.amount !== undefined ? Number(req.body.amount) : transaction.amount;
    transaction.type = req.body.type ? req.body.type.toLowerCase() : transaction.type;
    transaction.category = req.body.category || transaction.category;

    const rawMode =
      req.body.paymentMethod ||
      req.body.paymentMode ||
      req.body.payment_method ||
      req.body.payment_mode;

    transaction.paymentMethod = normalizePaymentMethod(
      rawMode,
      transaction.paymentMethod || "cash"
    );

    transaction.date = req.body.date || transaction.date;

    const updatedTransaction = await transaction.save();

    const io = req.app.get("io");
    if (io) {
      const userId = req.user._id.toString();
      io.to(userId).emit("new_notification", {
        title: "Transaction Updated ✏️",
        message: `"${updatedTransaction.title}" has been updated.`,
        type: "success", // 👈 Added Type
        data: updatedTransaction,
      });
    }

    res.json(updatedTransaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Summary
export const getSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = { user: req.user._id };

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const transactions = await Transaction.find(query);

    let income = 0;
    let expense = 0;

    transactions.forEach((item) => {
      if (item.type === "income") {
        income += item.amount;
      } else {
        expense += item.amount;
      }
    });

    res.json({
      balance: income - expense,
      income,
      expense,
      totalTransactions: transactions.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};