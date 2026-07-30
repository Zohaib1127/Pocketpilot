import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  addTransaction,
  autoAddTransaction, // ✅ Imported auto-add controller
  getTransactions,
  updateTransaction,
  deleteTransaction,
  getSummary,
} from "../controllers/transactionController.js";

const router = express.Router();

// Get All + Add
router
  .route("/")
  .get(protect, getTransactions)
  .post(protect, addTransaction);

// 🤖 Auto-Detect SMS Transaction Route
router.post("/auto-add", protect, autoAddTransaction);

// Summary Route
router.get("/summary", protect, getSummary);

// Update + Delete by ID
router
  .route("/:id")
  .put(protect, updateTransaction)
  .delete(protect, deleteTransaction);

export default router;