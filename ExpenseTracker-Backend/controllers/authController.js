import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import generateToken from "../utils/generateToken.js";

// Reusable Transporter (Performance Optimization)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const validatePasswordRule = (password) => {
  const minLength = password && password.length >= 8;
  const hasCapital = /[A-Z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return minLength && hasCapital && hasSpecial;
};

// 1. Register User
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const cleanEmail = email.toString().trim().toLowerCase();

    if (!validatePasswordRule(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long, contain at least 1 uppercase letter (A-Z), and 1 special character.",
      });
    }

    const userExists = await User.findOne({ email: cleanEmail });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const cleanEmail = email.toString().trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (user && (await user.matchPassword(password))) {
      return res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || "",
        token: generateToken(user._id),
      });
    }

    res.status(401).json({ message: "Invalid email or password" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Get User Profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Upload Profile Picture
export const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload an image file" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.avatar = req.file.path || req.file.filename;
    await user.save();

    const io = req.app.get("io");
    if (io) {
      const userId = req.user._id.toString();

      io.to(userId).emit("new_notification", {
        title: "Profile Updated 👤",
        message: "Your profile picture has been updated successfully.",
        type: "success",
        data: { avatar: user.avatar },
      });
    }

    res.status(200).json({
      message: "Profile picture uploaded successfully",
      avatar: user.avatar,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = email ? email.toString().trim().toLowerCase() : "";

    if (!cleanEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }

    // 6-digit OTP generate karein
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Reset OTP and 10 Min Expiry
    user.resetOtp = otp;
    user.resetOtpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    const mailOptions = {
      from: `"Walletly" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Code - Walletly",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #090A0F; color: #ffffff;">
          <div style="max-width: 500px; margin: 0 auto; background: #12151E; border-radius: 12px; padding: 25px; border: 1px solid #00F5A0;">
            <h2 style="color: #00F5A0; text-align: center; font-size: 26px; font-weight: 800; margin-bottom: 5px;">Walletly</h2>
            <p style="text-align: center; color: #888888; font-size: 12px; margin-top: 0;">Smart Financial Management</p>
            <hr style="border: none; border-top: 1px solid #1F1F1F; margin: 20px 0;" />
            <p style="color: #E2E8F0;">Hi <b>${user.name || "User"}</b>,</p>
            <p style="color: #A0AEC0;">You requested to reset your password. Use the following 6-digit OTP code to complete the process:</p>
            <div style="text-align: center; margin: 25px 0;">
              <span style="font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #00F5A0; background: rgba(0, 245, 160, 0.1); padding: 12px 24px; border-radius: 8px; border: 1px solid #00F5A0; display: inline-block;">${otp}</span>
            </div>
            <p style="color: #718096; font-size: 12px; text-align: center;">This code is valid for <b>10 minutes</b>. If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "6-digit OTP code sent successfully!",
    });
  } catch (error) {
    console.error("Email Error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to send OTP email." });
  }
};

// 6. Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const cleanEmail = email ? email.toString().trim().toLowerCase() : "";
    const cleanOtp = otp ? otp.toString().trim() : "";

    if (!cleanEmail || !cleanOtp || !newPassword) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    if (!validatePasswordRule(newPassword)) {
      return res.status(400).json({
        message:
          "New password must be at least 8 characters long, contain at least 1 uppercase letter (A-Z), and 1 special character.",
      });
    }

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }

    // Direct String Match Check
    if (!user.resetOtp || user.resetOtp.toString().trim() !== cleanOtp) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    // Expiry Check Fix
    if (!user.resetOtpExpire || Date.now() > Number(user.resetOtpExpire)) {
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpire = undefined;

    await user.save();

    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to reset password." });
  }
};

// 7. Delete User Account
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    await Transaction.deleteMany({ userId: userId });
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message:
        "Your Walletly account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to delete account." });
  }
};

// 8. Export User Data
export const exportUserData = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("-password");
    const transactions = await Transaction.find({ userId: userId });

    res.status(200).json({
      profile: user,
      transactions: transactions,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Failed to export data." });
  }
};