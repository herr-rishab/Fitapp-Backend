require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { loadEnv } = require("./src/config/env");

const foodRoutes = require("./src/routes/food.routes");
const exerciseRoutes = require("./src/routes/exercise.routes");
const googleRoutes = require("./src/routes/google.routes");
const assessportalRoutes = require("./src/routes/assessportal.routes");
const aiRoutes = require("./src/routes/ai.routes");

loadEnv();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    node: process.version,
    env: process.env.NODE_ENV || "local",
    time: new Date().toISOString(),
  });
});

app.use("/api/food", foodRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/google", googleRoutes);
app.use("/api/assessment", assessportalRoutes);
app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => {
  res.send("FitApp Backend is running");
});

module.exports = app;
