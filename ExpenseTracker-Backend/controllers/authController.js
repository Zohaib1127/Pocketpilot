import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import generateToken from "../utils/generateToken.js";

// Clean env variables (Spaces strip karna zaroori hai)
const EMAIL_USER = (process.env.EMAIL_USER || "").trim();
const EMAIL_PASS = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");

console.log("--------------------------------------------------");
console.log("⚙️  [AUTH CONTROLLER] Initializing Transporter...");
console.log("📧  EMAIL_USER:", EMAIL_USER ? EMAIL_USER : "❌ NOT SET");
console.log("🔑  EMAIL_PASS:", EMAIL_PASS ? "******** (Loaded)" : "❌ NOT SET");
console.log("--------------------------------------------------");

// Render & Cloud Friendly Transporter Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Bypass SSL Cert restrictions on cloud servers
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

// 5. Forgot Password
export const forgotPassword = async (req, res) => {
  console.log("==================================================");
  console.log("📩 [FORGOT PASSWORD] Process started...");
  console.log("📥 [FORGOT PASSWORD] Raw Body:", req.body);

  try {
    const { email } = req.body;
    const cleanEmail = email ? email.toString().trim().toLowerCase() : "";

    console.log("🔍 [FORGOT PASSWORD] Cleaned Email:", cleanEmail);

    if (!cleanEmail) {
      console.log("⚠️ [FORGOT PASSWORD] Email is empty or undefined");
      return res.status(400).json({ message: "Email is required" });
    }

    console.log("🔎 [FORGOT PASSWORD] Searching user in MongoDB...");
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      console.log(`⚠️ [FORGOT PASSWORD] No user found in Database for: "${cleanEmail}"`);
      return res
        .status(404)
        .json({ message: "No account found with this email address." });
    }

    console.log(`✅ [FORGOT PASSWORD] User found: ${user.name} (${user._id})`);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔑 [FORGOT PASSWORD] Generated OTP: ${otp}`);

    user.resetOtp = otp;
    user.resetOtpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 Min Expiry
    await user.save();

    console.log("💾 [FORGOT PASSWORD] OTP and Expiry Date saved to MongoDB successfully");

    const mailOptions = {
      from: `"Walletly Support" <${EMAIL_USER}>`,
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

    console.log(`📤 [FORGOT PASSWORD] Attempting Nodemailer send to: ${user.email}...`);
    
    const info = await transporter.sendMail(mailOptions);
    console.log("🎉 [FORGOT PASSWORD] Nodemailer Success! MessageId:", info.messageId);

    res.status(200).json({
      message: "6-digit OTP code sent successfully!",
    });
  } catch (error) {
    console.error("🔴 [FORGOT PASSWORD ERROR] Catch block triggered:");
    console.error("    Error Name:", error.name);
    console.error("    Error Code:", error.code);
    console.error("    Error Message:", error.message);
    if (error.response) console.error("    SMTP Response:", error.response);

    res.status(500).json({ 
      message: error.message.includes("EAUTH") 
        ? "Email Auth Failed. Check Gmail App Password." 
        : `Email delivery failed: ${error.message}` 
    });
  }
  console.log("==================================================");
};

// 6. Reset Password
export const resetPassword = async (req, res) => {
  console.log("==================================================");
  console.log("🔄 [RESET PASSWORD] Process started...");
  console.log("📥 [RESET PASSWORD] Body received:", { 
    email: req.body?.email, 
    otp: req.body?.otp, 
    newPassword: "***" 
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

    console.log("🔍 [RESET PASSWORD] DB Reset OTP:", user.resetOtp, "VS Entered OTP:", cleanOtp);

    if (!user.resetOtp || user.resetOtp.toString().trim() !== cleanOtp) {
      console.log("⚠️ [RESET PASSWORD] OTP Mismatch");
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    const isExpired = !user.resetOtpExpire || Date.now() > new Date(user.resetOtpExpire).getTime();
    console.log("⏱️ [RESET PASSWORD] OTP Expired Status:", isExpired);

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
  console.log("==================================================");
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