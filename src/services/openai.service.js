const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function chatWithCoach({
  message,
  coachName,
  coachPersonality,
  fitnessGoal,
  personalityScores,
  conversationHistory,
}) {
  const systemPrompt = buildSystemPrompt({
    coachName,
    coachPersonality,
    fitnessGoal,
    personalityScores,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory || []).slice(-10),
    { role: "user", content: message },
  ];

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 500,
    temperature: 0.8,
  });

  return {
    reply: response.choices[0]?.message?.content || "I'm here for you! How can I help?",
    usage: response.usage,
  };
}

async function generateWorkoutPlan({
  fitnessGoal,
  fitnessLevel,
  workoutDays,
  workoutStyle,
  targetBodyPart,
  exercises,
}) {
  const prompt = `You are a certified personal trainer. Create a structured weekly workout plan.

User Profile:
- Fitness Goal: ${fitnessGoal || "general fitness"}
- Fitness Level: ${fitnessLevel || "beginner"}
- Available Days: ${workoutDays || "3-4"} days/week
- Workout Style: ${workoutStyle || "mixed"}
${targetBodyPart ? `- Focus Area: ${targetBodyPart}` : ""}

${exercises && exercises.length > 0 ? `Available exercises from database:\n${exercises.map(e => `- ${e.name} (${e.bodyParts?.join(", ")}) [${e.equipments?.join(", ")}]`).join("\n")}` : ""}

Create a 7-day workout plan. For each day include:
- Day number and workout type (e.g. "Day 1: Upper Body Strength")
- 4-6 exercises with sets, reps, duration, and estimated calories burned
- Pre-workout food suggestion
- Post-workout food suggestion
- Rest days where appropriate

Format as JSON array:
[{"day":1,"title":"Upper Body","exercises":[{"name":"...","sets":3,"reps":12,"duration":"10 min","calories":80,"food_before":"...","food_after":"..."}]},...]

Return ONLY valid JSON, no markdown.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content || "[]";
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { raw: text, error: "Could not parse workout plan" };
  }
}

function buildSystemPrompt({ coachName, coachPersonality, fitnessGoal, personalityScores }) {
  let prompt = `You are ${coachName || "Coach Stacy"}, a personal fitness and wellness coach in a mobile app called FitApp. You are warm, knowledgeable, and supportive.`;

  if (coachPersonality === "friendly") {
    prompt += " Your style is friendly, casual, and encouraging. You use a conversational tone.";
  } else if (coachPersonality === "motivational") {
    prompt += " Your style is high-energy and motivational. You push users to their best.";
  } else if (coachPersonality === "calm") {
    prompt += " Your style is calm, measured, and therapeutic. You focus on mindfulness.";
  } else if (coachPersonality === "professional") {
    prompt += " Your style is professional and evidence-based. You cite science and data.";
  } else {
    prompt += " Your style is balanced - supportive yet direct, warm yet professional.";
  }

  if (fitnessGoal) {
    const goalMap = {
      "weight-loss": "helping them lose weight sustainably through nutrition and exercise",
      "fitness": "improving their overall fitness and strength",
      "nutrition": "optimizing their nutrition and eating habits",
      "mindfulness": "improving their mental wellness, stress management, and mindfulness",
    };
    prompt += ` Your primary focus is ${goalMap[fitnessGoal] || "general wellness"}.`;
  }

  if (personalityScores) {
    const ext = parseInt(personalityScores.extraversion, 10) || 50;
    const con = parseInt(personalityScores.conscientiousness, 10) || 50;
    const opn = parseInt(personalityScores.openness_to_experience, 10) || 50;
    const agr = parseInt(personalityScores.agreeableness, 10) || 50;

    prompt += "\n\nUser personality insights (Big 5 scores):";
    if (ext >= 70) prompt += "\n- High extraversion: recommend group activities, social workouts";
    else if (ext < 40) prompt += "\n- Introverted: recommend solo workouts, home exercises";
    if (con >= 70) prompt += "\n- Very disciplined: give structured plans with clear milestones";
    else if (con < 40) prompt += "\n- Flexible personality: keep plans varied and fun, avoid rigid schedules";
    if (opn >= 70) prompt += "\n- Very open: suggest trying new exercises, cuisines, and approaches";
    if (agr >= 70) prompt += "\n- Very agreeable: use encouraging, gentle language";
    else if (agr < 40) prompt += "\n- Direct personality: be straightforward, challenge-based";
  }

  prompt += `\n\nRules:
- Keep responses concise (2-4 sentences max unless asked for detail)
- Be encouraging and positive
- Give actionable advice
- If asked about exercises, suggest specific exercises with sets/reps
- If asked about food, give specific meal suggestions with portions
- Never give medical advice, suggest seeing a doctor for health concerns`;

  return prompt;
}

module.exports = {
  chatWithCoach,
  generateWorkoutPlan,
};
