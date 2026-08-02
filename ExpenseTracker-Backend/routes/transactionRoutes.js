import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  addTransaction,
  getTransactions,
  updateTransaction,
  getSummary,
} from "../controllers/transactionController.js";

const router = express.Router();

// Get All + Add
router
  .route("/")
  .get(protect, getTransactions)
  .post(protect, addTransaction);

// Summary Route
router.get("/summary", protect, getSummary);

// Update by ID
router
  .route("/:id")
  .put(protect, updateTransaction);

export default router;