import dotenv from "dotenv";
dotenv.config(); // ⚡ Top-level env load guarantee

import nodemailer from "nodemailer";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

/**
 * 🔐 Password Validation Helper Rule:
 * - Minimum 8 characters long
 * - At least 1 Uppercase letter (A-Z)
 * - At least 1 Special character (@$!%*?& etc.)
 */
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

    // Check required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please fill all fields",
      });
    }

    const cleanEmail = email.toString().trim().toLowerCase();

    // Enforce Password Security Rule
    if (!validatePasswordRule(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long, contain at least 1 uppercase letter (A-Z), and 1 special character.",
      });
    }

    const userExists = await User.findOne({ email: cleanEmail });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists",
      });
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
    res.status(500).json({
      message: error.message,
    });
  }
};

// 2. Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please fill all fields",
      });
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

    res.status(401).json({
      message: "Invalid email or password",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// 3. Get User Profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// 4. Upload Profile Picture
export const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload an image file",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.avatar = req.file.path || req.file.filename;
    await user.save();

    const io = req.app.get("io");
    if (io) {
      const userId = req.user._id.toString();

      io.to(userId).emit("new_notification", {
        title: "Profile Updated 👤",
        message: "Your profile picture has been updated successfully.",
        data: { avatar: user.avatar },
      });
    }

    res.status(200).json({
      message: "Profile picture uploaded successfully",
      avatar: user.avatar,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// 5. Forgot Password (Generates 6-Digit OTP & Sends Email)
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

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP & expiry (10 minutes valid) in user document
    user.resetOtp = otp;
    user.resetOtpExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    console.log(`🔑 DEBUG OTP generated for ${cleanEmail}:`, otp);

    // Dynamic Transporter Setup inside function
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Send Email via Nodemailer
    const mailOptions = {
      from: `"PocketPilot" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Code - PocketPilot",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f9;">
          <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 10px; padding: 25px; border: 1px solid #e1e8ed;">
            <h2 style="color: #10B981; text-align: center;">PocketPilot</h2>
            <hr style="border: none; border-top: 1px solid #eee;" />
            <p>Hi <b>${user.name || "User"}</b>,</p>
            <p>You requested to reset your password. Use the following 6-digit OTP code to complete the process:</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #10B981; background: #ECFDF5; padding: 10px 20px; border-radius: 8px; display: inline-block;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 13px;">This code is valid for <b>10 minutes</b>. If you didn't request this, please ignore this email.</p>
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

// 6. Reset Password (Verifies OTP & Updates Password)
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const cleanEmail = email ? email.toString().trim().toLowerCase() : "";
    const cleanOtp = otp ? otp.toString().trim() : "";

    if (!cleanEmail || !cleanOtp || !newPassword) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    // Enforce Password Security Rule on Reset
    if (!validatePasswordRule(newPassword)) {
      return res.status(400).json({
        message:
          "New password must be at least 8 characters long, contain at least 1 uppercase letter (A-Z), and 1 special character.",
      });
    }

    console.log(
      `\n🔍 VERIFYING OTP -> Email: "${cleanEmail}" | OTP Input: "${cleanOtp}"`
    );

    // Step 1: Find user
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      console.log("❌ Reset Failed: User not found");
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }

    console.log(
      `💾 DB Stored OTP: "${user.resetOtp}" | Expiry: ${user.resetOtpExpire}`
    );

    // Step 2: Validate OTP
    if (!user.resetOtp || user.resetOtp !== cleanOtp) {
      console.log("❌ Reset Failed: OTP mismatch");
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    // Step 3: Validate Expiry
    if (
      !user.resetOtpExpire ||
      Date.now() > new Date(user.resetOtpExpire).getTime()
    ) {
      console.log("⏰ Reset Failed: OTP expired");
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    // Step 4: Save new password and clear OTP fields
    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpire = undefined;

    await user.save();

    console.log("✅ Password reset successfully!");
    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res
      .status(500)
      .json({ message: error.message || "Failed to reset password." });
  }
};