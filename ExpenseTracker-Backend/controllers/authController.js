import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import generateToken from "../utils/generateToken.js";

console.log("--------------------------------------------------");
console.log("⚙️  [AUTH CONTROLLER] Initialized with Nodemailer OTP System (Render Optimized)");
console.log("--------------------------------------------------");

const validatePasswordRule = (password) => {
  const minLength = password && password.length >= 8;
  const hasCapital = /[A-Z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return minLength && hasCapital && hasSpecial;
};

// ====================== CREATE TRANSPORTER (Render Optimized) ======================
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,                    // 465 more reliable on Render than 587
    secure: true,                 // true for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Google App Password (16 characters)
    },
    connectionTimeout: 30000,     // 30 seconds
    greetingTimeout: 20000,
    socketTimeout: 30000,
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// 1. Register User
export const registerUser = async (req, res) => {
  console.log("--------------------------------------------------");
  console.log("👤 [REGISTER] Hit endpoint with body:", { ...req.body, password: "***" });
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      console.log("⚠️ [REGISTER] Validation Failed: Missing fields");
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const cleanEmail = email.toString().trim().toLowerCase();

    if (!validatePasswordRule(password)) {
      console.log("⚠️ [REGISTER] Validation Failed: Password complexity rule not met");
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long, contain at least 1 uppercase letter (A-Z), and 1 special character.",
      });
    }

    const userExists = await User.findOne({ email: cleanEmail });

    if (userExists) {
      console.log(`⚠️ [REGISTER] User already exists with email: ${cleanEmail}`);
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
    });

    console.log(`✅ [REGISTER] User created successfully! ID: ${user._id}`);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("❌ [REGISTER ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 2. Login User
export const loginUser = async (req, res) => {
  console.log("--------------------------------------------------");
  console.log("🔐 [LOGIN] Hit endpoint for email:", req.body?.email);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("⚠️ [LOGIN] Missing email or password");
      return res.status(400).json({ message: "Please fill all fields" });
    }

    const cleanEmail = email.toString().trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });

    if (user && (await user.matchPassword(password))) {
      console.log(`✅ [LOGIN] Successful login for: ${cleanEmail}`);
      return res.status(200).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || "",
        token: generateToken(user._id),
      });
    }

    console.log(`⚠️ [LOGIN] Invalid credentials for: ${cleanEmail}`);
    res.status(401).json({ message: "Invalid email or password" });
  } catch (error) {
    console.error("❌ [LOGIN ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 3. Get User Profile
export const getUserProfile = async (req, res) => {
  console.log("--------------------------------------------------");
  console.log("📖 [PROFILE] Fetching profile for User ID:", req.user?._id);
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      console.log("⚠️ [PROFILE] User not found");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ [PROFILE] User profile loaded successfully");
    res.status(200).json(user);
  } catch (error) {
    console.error("❌ [PROFILE ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 4. Upload Profile Picture
export const uploadProfilePicture = async (req, res) => {
  console.log("--------------------------------------------------");
  console.log("🖼️ [AVATAR UPLOAD] Request received for User ID:", req.user?._id);
  try {
    if (!req.file) {
      console.log("⚠️ [AVATAR UPLOAD] No file provided in request");
      return res.status(400).json({ message: "Please upload an image file" });
    }

    console.log("📁 [AVATAR UPLOAD] File details:", req.file);

    const user = await User.findById(req.user._id);

    if (!user) {
      console.log("⚠️ [AVATAR UPLOAD] User not found");
      return res.status(404).json({ message: "User not found" });
    }

    user.avatar = req.file.path || req.file.filename;
    await user.save();

    console.log(`✅ [AVATAR UPLOAD] Saved new avatar: ${user.avatar}`);

    const io = req.app.get("io");
    if (io) {
      const userId = req.user._id.toString();

      io.to(userId).emit("new_notification", {
        title: "Profile Updated 👤",
        message: "Your profile picture has been updated successfully.",
        type: "success",
        data: { avatar: user.avatar },
      });
      console.log("📡 [SOCKET.IO] Notification emitted to room:", userId);
    }

    res.status(200).json({
      message: "Profile picture uploaded successfully",
      avatar: user.avatar,
    });
  } catch (error) {
    console.error("❌ [AVATAR UPLOAD ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 5. Forgot Password (Render Optimized + Better Error Handling)
export const forgotPassword = async (req, res) => {
  console.log("==================================================");
  console.log("📩 [FORGOT PASSWORD - NODEMAILER OTP] Process started...");

  try {
    const { email } = req.body;
    const cleanEmail = email ? email.toString().trim().toLowerCase() : "";

    if (!cleanEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("❌ EMAIL_USER or EMAIL_PASS missing in environment variables");
      return res.status(500).json({
        message: "Email service is not configured properly. Please contact support.",
      });
    }

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res
        .status(404)
        .json({ message: "No account found with this email address." });
    }

    // Generate 6-Digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpire = otpExpire;
    await user.save();

    console.log(`🔢 [FORGOT PASSWORD] OTP generated for ${cleanEmail}`);

    const transporter = createTransporter();

    const mailOptions = {
      from: `"Walletly Security" <${process.env.EMAIL_USER}>`,
      to: cleanEmail,
      subject: "Your Walletly Password Reset Code 🔑",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #090A0F; color: #ffffff; border-radius: 12px; border: 1px solid #1F2937;">
          <h2 style="color: #10B981; margin-bottom: 5px;">Walletly</h2>
          <p style="color: #9CA3AF; font-size: 14px;">Password Reset Verification Code</p>
          <hr style="border: 0; border-top: 1px solid #1F2937; margin: 15px 0;" />
          <p style="font-size: 15px; color: #E5E7EB;">Hello <strong>${user.name || "User"}</strong>,</p>
          <p style="font-size: 14px; color: #9CA3AF;">Use the 6-digit verification code below to reset your Walletly password:</p>
          <div style="text-align: center; margin: 25px 0;">
            <span style="background-color: #111827; letter-spacing: 6px; color: #10B981; font-size: 28px; font-weight: bold; padding: 12px 24px; border-radius: 8px; border: 1px solid #10B981;">
              ${otp}
            </span>
          </div>
          <p style="color: #EF4444; font-size: 13px; text-align: center;">⏱️ This code will expire in 10 minutes.</p>
          <p style="color: #6B7280; font-size: 12px; margin-top: 25px;">If you did not request this code, please ignore this email.</p>
        </div>
      `,
    };

    console.log("📧 Attempting to send OTP email via Nodemailer (Render)...");

    const info = await transporter.sendMail(mailOptions);
    console.log("🎉 [OTP EMAIL SENT SUCCESSFULLY]:", info.response || info.messageId);

    return res.status(200).json({
      message: "A 6-digit OTP code has been sent to your email!",
    });
  } catch (error) {
    console.error("❌ [NODEMAILER/SERVER ERROR]:", error.message || error);

    // Better user-friendly messages
    let message = "Failed to send OTP email. Please try again later.";

    if (error.message?.includes("Invalid login") || error.message?.includes("Username and Password not accepted")) {
      message = "Email service authentication failed. Please check App Password.";
    } else if (error.message?.includes("timeout") || error.message?.includes("Connection timeout")) {
      message = "Email server connection timed out. Please try again in a moment.";
    } else if (error.code === "ECONNECTION" || error.code === "ETIMEDOUT") {
      message = "Could not connect to email server. Please try again.";
    }

    return res.status(500).json({ message });
  }
};

// 6. Reset Password
export const resetPassword = async (req, res) => {
  console.log("==================================================");
  console.log("🔄 [RESET PASSWORD] Process started...");
  console.log("📥 [RESET PASSWORD] Body received:", {
    email: req.body?.email,
    otp: req.body?.otp,
    newPassword: "***",
  });

  try {
    const { email, otp, newPassword } = req.body;

    const cleanEmail = email ? email.toString().trim().toLowerCase() : "";
    const cleanOtp = otp ? otp.toString().trim() : "";

    if (!cleanEmail || !cleanOtp || !newPassword) {
      console.log("⚠️ [RESET PASSWORD] Validation failed: Missing fields");
      return res.status(400).json({ message: "Please fill all fields" });
    }

    if (!validatePasswordRule(newPassword)) {
      console.log("⚠️ [RESET PASSWORD] Validation failed: Password rule failed");
      return res.status(400).json({
        message:
          "New password must be at least 8 characters long, contain at least 1 uppercase letter (A-Z), and 1 special character.",
      });
    }

    console.log("🔎 [RESET PASSWORD] Searching user in DB...");
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      console.log(`⚠️ [RESET PASSWORD] No user found for: ${cleanEmail}`);
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }

    console.log("🔍 [RESET PASSWORD] Checking OTP...");

    if (!user.resetOtp || user.resetOtp.toString().trim() !== cleanOtp) {
      console.log("⚠️ [RESET PASSWORD] OTP Mismatch");
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    const isExpired =
      !user.resetOtpExpire ||
      Date.now() > new Date(user.resetOtpExpire).getTime();

    if (isExpired) {
      console.log("⚠️ [RESET PASSWORD] OTP Has Expired");
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpire = undefined;

    await user.save();
    console.log(`🎉 [RESET PASSWORD] Password updated successfully for: ${cleanEmail}`);

    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    console.error("❌ [RESET PASSWORD ERROR]:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to reset password." });
  }
};

// 7. Delete User Account
export const deleteAccount = async (req, res) => {
  console.log("--------------------------------------------------");
  console.log("🗑️ [DELETE ACCOUNT] Request for User ID:", req.user?._id);
  try {
    const userId = req.user._id;

    await Transaction.deleteMany({ userId: userId });
    console.log("🗑️ [DELETE ACCOUNT] Associated transactions deleted");

    await User.findByIdAndDelete(userId);
    console.log("🗑️ [DELETE ACCOUNT] User record deleted permanently");

    res.status(200).json({
      success: true,
      message:
        "Your Walletly account and all associated data have been permanently deleted.",
    });
  } catch (error) {
    console.error("❌ [DELETE ACCOUNT ERROR]:", error.message);
    res
      .status(500)
      .json({ message: error.message || "Failed to delete account." });
  }
};

// 8. Export User Data
export const exportUserData = async (req, res) => {
  console.log("--------------------------------------------------");
  console.log("📦 [EXPORT DATA] Fetching data for User ID:", req.user?._id);
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("-password");
    const transactions = await Transaction.find({ userId: userId });

    console.log(`✅ [EXPORT DATA] Exported profile + ${transactions.length} transactions`);

    res.status(200).json({
      profile: user,
      transactions: transactions,
    });
  } catch (error) {
    console.error("❌ [EXPORT DATA ERROR]:", error.message);
    res
      .status(500)
      .json({ message: error.message || "Failed to export data." });
  }
};