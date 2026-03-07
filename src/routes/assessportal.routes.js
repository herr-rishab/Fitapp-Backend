const express = require("express");
const router = express.Router();

const {
  getAssessments,
  getQuestions,
  submitAssessment,
} = require("../services/assessportal.service");

// GET /api/assessment/list
router.get("/list", async (req, res) => {
  try {
    const data = await getAssessments();
    res.json(data);
  } catch (err) {
    console.error("Assessment list error:", err.message);
    res.status(500).json({ error: "Failed to fetch assessments" });
  }
});

// GET /api/assessment/questions/:packageId
router.get("/questions/:packageId", async (req, res) => {
  try {
    const data = await getQuestions(req.params.packageId);
    res.json(data);
  } catch (err) {
    console.error("Assessment questions error:", err.message);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

// POST /api/assessment/submit
router.post("/submit", async (req, res) => {
  try {
    const {
      packageId,
      languageId,
      clientOrderId,
      subjectId,
      firstName,
      lastName,
      responses,
    } = req.body;

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: "Responses are required" });
    }

    if (!firstName) {
      return res.status(400).json({ error: "firstName is required" });
    }

    const data = await submitAssessment({
      packageId,
      languageId,
      clientOrderId,
      subjectId,
      firstName,
      lastName: lastName || "User",
      responses,
    });

    res.status(201).json(data);
  } catch (err) {
    console.error("Assessment submit error:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
    res.status(500).json({ error: "Failed to submit assessment" });
  }
});

module.exports = router;
