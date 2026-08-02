import Budget from "../models/Budget.js";

// Create or Update Budget
export const setBudget = async (req, res) => {
  try {
    const { amount } = req.body;

    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    let budget = await Budget.findOne({
      user: req.user._id,
      month,
      year,
    });

    let isUpdated = false;

    if (budget) {
      budget.amount = amount;
      await budget.save();
      isUpdated = true;
    } else {
      budget = await Budget.create({
        user: req.user._id,
        amount,
        month,
        year,
      });
    }

    // ⚡ Socket Notification Emit
    const io = req.app.get("io");
    if (io) {
      const userId = req.user._id.toString();

      io.to(userId).emit("new_notification", {
        title: isUpdated ? "Budget Updated 🎯" : "Budget Set 🎯",
        message: `Your monthly budget for ${month}/${year} has been set to Rs. ${amount.toLocaleString()}`,
        type: "success", // 👈 Added Type
        data: budget,
      });
    }

    res.json(budget);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get Current Month Budget
export const getBudget = async (req, res) => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const budget = await Budget.findOne({
      user: req.user._id,
      month,
      year,
    });

    res.json(budget || { amount: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};