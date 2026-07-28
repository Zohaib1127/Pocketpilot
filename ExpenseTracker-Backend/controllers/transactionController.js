import Transaction from "../models/Transaction.js";

// Add Transaction
export const addTransaction = async (req, res) => {
  try {
    const { title, amount, type, category, date } = req.body;

    if (!title || !amount || !type || !category) {
      return res.status(400).json({
        message: "Please fill all required fields",
      });
    }

    const transaction = await Transaction.create({
      title,
      amount,
      type,
      category,
      date,
      user: req.user._id,
    });

    const io = req.app.get("io");
    if (io) {
      const emoji = type === "income" ? "📈" : "📉";
      const userId = req.user._id.toString();

      io.to(userId).emit("new_notification", {
        title: `Transaction Added ${emoji}`,
        message: `${type === "income" ? "Received" : "Spent"} Rs. ${amount} for "${title}"`,
        data: transaction,
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Transactions (With Month & Year Filter)
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

// Delete Transaction
export const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    await transaction.deleteOne();

    const io = req.app.get("io");
    if (io) {
      const userId = req.user._id.toString();
      io.to(userId).emit("new_notification", {
        title: "Transaction Deleted 🗑️",
        message: `Transaction "${transaction.title}" was removed.`,
      });
    }

    res.json({ message: "Transaction deleted successfully" });
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

    transaction.title = req.body.title || transaction.title;
    transaction.amount = req.body.amount || transaction.amount;
    transaction.type = req.body.type || transaction.type;
    transaction.category = req.body.category || transaction.category;
    transaction.date = req.body.date || transaction.date;

    const updatedTransaction = await transaction.save();

    const io = req.app.get("io");
    if (io) {
      const userId = req.user._id.toString();
      io.to(userId).emit("new_notification", {
        title: "Transaction Updated ✏️",
        message: `"${updatedTransaction.title}" has been updated.`,
        data: updatedTransaction,
      });
    }

    res.json(updatedTransaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Dashboard Summary (With Month & Year Filter)
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