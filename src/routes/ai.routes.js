const express = require("express");
const router = express.Router();

const { chatWithCoach, generateWorkoutPlan } = require("../services/openai.service");

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
    } = req.body;

    const plan = await generateWorkoutPlan({
      fitnessGoal,
      fitnessLevel,
      workoutDays,
      workoutStyle,
      targetBodyPart,
      exercises,
    });

    res.json({ plan });
  } catch (err) {
    console.error("Workout plan error:", err.message);
    res.status(500).json({ error: "Workout plan generation failed" });
  }
});

module.exports = router;
