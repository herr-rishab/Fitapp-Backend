const express = require("express");
const router = express.Router();

const {
  getExercises,
  getExerciseById,
  searchExercises,
  getBodyParts,
  getRandomExercise,
  recommendWorkout
} = require("../services/exercise.service");

// Liste + filtre
router.get("/", async (req, res) => {
  try {
    const data = await getExercises(req.query);
    res.json(data);
  } catch (err) {
    console.error("GET /exercises error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Search
router.get("/search", async (req, res) => {
  try {
    const q = req.query.q || "";
    const data = await searchExercises(q);
    res.json(data);
  } catch (err) {
    console.error("GET /exercises/search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Bodyparts
router.get("/bodyparts", async (req, res) => {
  try {
    const data = await getBodyParts();
    res.json(data);
  } catch (err) {
    console.error("GET /exercises/bodyparts error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Random
router.get("/random", async (req, res) => {
  try {
    const data = await getRandomExercise();
    res.json(data);
  } catch (err) {
    console.error("GET /exercises/random error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Recommend
router.post("/recommend", async (req, res) => {
  try {
    console.log("REQ BODY:", req.body); 

    const data = await recommendWorkout(req.body);
    res.json(data);
  } catch (err) {
    console.error("POST /exercises/recommend error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// By ID (en sona bırakılmalı)
router.get("/:id", async (req, res) => {
  try {
    const data = await getExerciseById(req.params.id);
    if (!data) {
      return res.status(404).json({ error: "Exercise not found" });
    }
    res.json(data);
  } catch (err) {
    console.error("GET /exercises/:id error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
