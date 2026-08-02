import express from "express";
import multer from "multer";
import protect from "../middleware/authMiddleware.js";

// Controllers
import {
  registerUser,
  loginUser,
  getUserProfile,
  uploadProfilePicture,
  forgotPassword,
  resetPassword,
  deleteAccount,   // 👈 Added
  exportUserData,  // 👈 Added
} from "../controllers/authController.js";

const router = express.Router();

// Multer setup for temporary image processing
const upload = multer({ dest: "uploads/" });

// Authentication & Password Reset Routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.post("/register", registerUser);
router.post("/login", loginUser);

// Profile
router.get("/profile", protect, getUserProfile);

// Profile Picture Upload Route
router.post(
  "/profile/avatar",
  protect,
  upload.single("image"),
  uploadProfilePicture
);

// Account Management Routes (Google Play Store Policy & User Data)
router.delete("/delete-account", protect, deleteAccount);
router.get("/export-data", protect, exportUserData);

export default router;