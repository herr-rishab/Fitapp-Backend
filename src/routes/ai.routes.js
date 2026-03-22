const express = require("express");
const router = express.Router();

const { chatWithCoach, generateWorkoutPlan, generateRestaurantMenu } = require("../services/openai.service");

// POST /api/ai/chat
router.post("/chat", async (req, res) => {
  try {
    const {
      message,
      coachName,
      coachPersonality,
      fitnessGoal,
      personalityScores,
      conversationHistory,
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const result = await chatWithCoach({
      message,
      coachName,
      coachPersonality,
      fitnessGoal,
      personalityScores,
      conversationHistory,
    });

    res.json(result);
  } catch (err) {
    console.error("AI chat error:", err.message);
    res.status(500).json({ error: "AI chat failed" });
  }
});

// POST /api/ai/workout-plan
router.post("/workout-plan", async (req, res) => {
  try {
    const {
      fitnessGoal,
      fitnessLevel,
      workoutDays,
      workoutStyle,
      targetBodyPart,
      exercises,
      duration,
      weight,
      height,
      desiredWeight,
      age,
      gender,
    } = req.body;

    const plan = await generateWorkoutPlan({
      fitnessGoal,
      fitnessLevel,
      workoutDays,
      workoutStyle,
      targetBodyPart,
      exercises,
      duration,
      weight,
      height,
      desiredWeight,
      age,
      gender,
    });

    res.json({ plan });
  } catch (err) {
    console.error("Workout plan error:", err.message);
    res.status(500).json({ error: "Workout plan generation failed" });
  }
});

// POST /api/ai/restaurant-menu
router.post("/restaurant-menu", async (req, res) => {
  try {
    const { restaurantName, cuisineType, dietaryFilter } = req.body;

    if (!restaurantName) {
      return res.status(400).json({ error: "restaurantName is required" });
    }

    const menuItems = await generateRestaurantMenu({
      restaurantName,
      cuisineType,
      dietaryFilter,
    });

    res.json({ menuItems });
  } catch (err) {
    console.error("Restaurant menu error:", err.message);
    res.status(500).json({ error: "Menu generation failed" });
  }
});

module.exports = router;
