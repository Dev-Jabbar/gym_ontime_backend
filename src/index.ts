import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db";

import cookieParser from "cookie-parser";

// 🛣 Routes
import classRoutes from "./routes/class.routes";
import trainerRoutes from "./routes/trainer-profile.routes";
import memberRoutes from "./routes/member-profile.route";
import userRoutes from "./routes/user.routes";
import paymentRoutes from "./routes/payment.route";

dotenv.config();

const app = express();

// 🧠 Global Middleware

app.use(
  cors({
    origin: ["http://localhost:3000", "https://gym-ontime.vercel.app"],
    credentials: true,
  }),
);

app.use(cookieParser());

// ⚠️ IMPORTANT: Raw body for webhook signature verification
// This MUST come BEFORE express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

// ⚡ Database
connectDB();

// 📡 API Routes
app.use("/api/classes", classRoutes);
app.use("/api/trainers", trainerRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);

// ❤️ Health check
app.get("/", (_req, res) => {
  res.send("API is running 🚀");
});

// 🚀 Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
