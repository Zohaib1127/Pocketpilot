import express from "express";

import {
  setBudget,
  getBudget,
} from "../controllers/budgetController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, setBudget);

router.get("/", protect, getBudget);

export default router;