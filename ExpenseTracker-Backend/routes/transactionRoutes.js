import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  addTransaction,
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
  router.get("/summary", protect, getSummary);

// Update + Delete by ID
router
  .route("/:id")
  .put(protect, updateTransaction)
  .delete(protect, deleteTransaction);

export default router;