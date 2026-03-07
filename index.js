require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { loadEnv } = require("./src/config/env");

const foodRoutes = require("./src/routes/food.routes");
const exerciseRoutes = require("./src/routes/exercise.routes");
const googleRoutes = require("./src/routes/google.routes");
const assessportalRoutes = require("./src/routes/assessportal.routes");

// Env loader
loadEnv();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    node: process.version,
    env: process.env.NODE_ENV || "local",
    time: new Date().toISOString(),
  });
});

// Routes
app.use("/api/food", foodRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/google", googleRoutes);
app.use("/api/assessment", assessportalRoutes);

// Root test
app.get("/", (req, res) => {
  res.send("FitApp Backend is running");
});

// Port
const PORT = process.env.PORT || 3000;

// Listen
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API running on http://localhost:${PORT}`);
  console.log(`Mobile access: http://192.168.1.176:${PORT}`);
});
