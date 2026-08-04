import dotenv from "dotenv";
dotenv.config();

import { Resend } from "resend";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import generateToken from "../utils/generateToken.js";

console.log("--------------------------------------------------");
console.log("⚙️  [AUTH CONTROLLER] Initialized with Resend OTP System");
console.log("--------------------------------------------------");

const resend = new Resend(process.env.RESEND_API_KEY);

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

    res.status(401).json({ message: "Invalid email or password" });
  } catch (error) {
    console.error("❌ [LOGIN ERROR]:", error.message);
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
    console.error("❌ [PROFILE ERROR]:", error.message);
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
    console.error("❌ [AVATAR UPLOAD ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 5. Forgot Password (Resend - Highly Reliable on Render)
export const forgotPassword = async (req, res) => {
  console.log("==================================================");
  console.log("📩 [FORGOT PASSWORD - RESEND OTP] Process started...");

  try {
    const { email } = req.body;
    const cleanEmail = email ? email.toString().trim().toLowerCase() : "";

    if (!cleanEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY missing");
      return res.status(500).json({
        message: "Email service is not configured properly.",
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

    // Send email with Resend
    const { data, error } = await resend.emails.send({
      from: "Walletly Security <onboarding@resend.dev>", // Testing ke liye. Baad mein apna domain lagana
      to: [cleanEmail],
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
    });

    if (error) {
      console.error("❌ [RESEND ERROR]:", error);
      return res.status(500).json({
        message: "Failed to send OTP email. Please try again later.",
      });
    }

    console.log("🎉 [OTP EMAIL SENT SUCCESSFULLY]:", data?.id);

    return res.status(200).json({
      message: "A 6-digit OTP code has been sent to your email!",
    });
  } catch (error) {
    console.error("❌ [FORGOT PASSWORD ERROR]:", error.message || error);
    return res.status(500).json({
      message: "Failed to send OTP email. Please try again later.",
    });
  }
};

// 6. Reset Password
export const resetPassword = async (req, res) => {
  console.log("==================================================");
  console.log("🔄 [RESET PASSWORD] Process started...");

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

    if (!user.resetOtp || user.resetOtp.toString().trim() !== cleanOtp) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    const isExpired =
      !user.resetOtpExpire ||
      Date.now() > new Date(user.resetOtpExpire).getTime();

    if (isExpired) {
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
    console.error("❌ [DELETE ACCOUNT ERROR]:", error.message);
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
    console.error("❌ [EXPORT DATA ERROR]:", error.message);
    res
      .status(500)
      .json({ message: error.message || "Failed to export data." });
  }
};