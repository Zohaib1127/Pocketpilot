import User from "../models/User.js";
import bcrypt from "bcryptjs";

export const updateProfile = async (req, res) => {
  try {
    const { name, password } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (name) {
      user.name = name;
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    // ⚡ Socket Notification Emit (Targeted User Room Only)
    const io = req.app.get("io");
    if (io) {
      const userId = req.user._id.toString();

      io.to(userId).emit("new_notification", {
        title: "Profile Updated 👤",
        message: password
          ? "Your profile details and password have been updated."
          : "Your profile details have been updated.",
        data: { name: user.name, email: user.email },
      });
    }

    res.json({
      message: "Profile Updated Successfully",
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};