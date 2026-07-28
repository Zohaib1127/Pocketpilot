import dns from "dns";
// ⚡ FIX: Force Node.js to use Google's Public DNS (Fixes querySrv ETIMEOUT)
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

dotenv.config();

connectDB();

const app = express();

// 1. HTTP Server & Socket.IO Initialization
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ES Modules ke liye __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/user", userRoutes);
app.use("/api/report", reportRoutes);

app.get("/", (req, res) => {
  res.send("Expense Tracker API Running with Socket.IO...");
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server Running with Socket.IO on Port ${PORT}`);
});