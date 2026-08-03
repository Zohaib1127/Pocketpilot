import dns from "dns";
// ⚡ FIX: Force Node.js to use Google's Public DNS (Fixes querySrv ETIMEOUT)
// IPv4 ko priority do
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import os from "os"; // 👈 Local IP network interface nikalne ke liye
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import cron from "node-cron"; // 👈 Monthly Rollover Job

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

// Models Import (Rollover Logic Ke Liye)
import Transaction from "./models/Transaction.js"; 
import User from "./models/User.js";               

dotenv.config();

connectDB();

const app = express();

// 1. HTTP Server & Socket.IO Initialization
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// ES Modules ke liye __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// 2. Uploads folder ko static make karein
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 3. Socket.IO instance ko Express App me inject karna
app.set("io", io);

// Socket.IO Connection Handlers
io.on("connection", (socket) => {
  console.log(`⚡ New Client Connected: ${socket.id}`);

  socket.on("join_user_room", (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`👤 User ${userId} joined room: ${userId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client Disconnected: ${socket.id}`);
  });
});

// 🔄 4. AUTOMATED MONTHLY SAVINGS ROLLOVER CRON JOB
// Schedule: Har month ki 1st tarikh ko raat 12:00 AM baje ('0 0 1 * *')
cron.schedule("0 0 1 * *", async () => {
  console.log("🔄 Running Monthly Savings Rollover Job...");

  try {
    const users = await User.find({});
    const now = new Date();

    // Previous Month Range Calculation
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1);
    const endOfPrevMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0, 23, 59, 59);

    for (const user of users) {
      // Pichle month ki transactions fetch karein
      const prevTransactions = await Transaction.find({
        userId: user._id,
        date: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
      });

      const totalIncome = prevTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const totalExpense = prevTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const monthlySavings = totalIncome - totalExpense;

      // Agar bachat positive hai toh rollover income transaction add karein
      if (monthlySavings > 0) {
        const rolloverTx = await Transaction.create({
          userId: user._id,
          title: "Previous Month Rollover",
          amount: monthlySavings,
          type: "income",
          category: "Rollover",
          date: new Date(),
          notes: `Auto-credited savings from ${prevMonthDate.toLocaleString("default", { month: "long" })} ${prevMonthDate.getFullYear()}`,
        });

        // Real-time Update via Socket.IO
        io.to(user._id.toString()).emit("rollover_updated", {
          message: "Previous month savings rolled over successfully!",
          transaction: rolloverTx,
        });

        console.log(`✅ Rollover applied for user: ${user._id} | Amount: ${monthlySavings}`);
      }
    }
    console.log("🎉 Monthly Savings Rollover Process Completed!");
  } catch (error) {
    console.error("❌ Rollover Cron Error:", error);
  }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/user", userRoutes);
app.use("/api/report", reportRoutes);

app.get("/", (req, res) => {
  res.send("Walletly API Running with Socket.IO & Cron...");
});

// Helper function to get local IP address automatically
const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === "IPv4" && !alias.internal) {
        return alias.address;
      }
    }
  }
  return "localhost";
};

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0"; // 👈 Allows external devices (Mobile/Emulators) on local network to connect

server.listen(PORT, HOST, () => {
  const localIp = getLocalIpAddress();
  console.log(`\n🚀 Server Running with Socket.IO & Rollover Cron!`);
  console.log(`-------------------------------------------`);
  console.log(`💻 Local:            http://localhost:${PORT}`);
  console.log(`📱 Mobile/Emulator:  http://${localIp}:${PORT}`);
  console.log(`-------------------------------------------\n`);
});