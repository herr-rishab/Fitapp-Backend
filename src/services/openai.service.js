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
  weight,
  height,
  desiredWeight,
  age,
  gender,
}) {
  const prompt = `You are a certified personal trainer and sports nutritionist. Create a detailed structured weekly workout plan.

User Profile:
- Fitness Goal: ${fitnessGoal || "general fitness"}
- Fitness Level: ${fitnessLevel || "beginner"}
- Available Days: ${workoutDays || "4"} days/week
- Workout Style: ${workoutStyle || "gym"}
${targetBodyPart ? `- Focus Area: ${targetBodyPart}` : ""}
${weight ? `- Current Weight: ${weight} lbs` : ""}
${height ? `- Height: ${height} inches` : ""}
${desiredWeight ? `- Desired Weight: ${desiredWeight} lbs` : ""}
${age ? `- Age: ${age}` : ""}
${gender ? `- Gender: ${gender}` : ""}

Create a 7-day workout plan like a personal trainer spreadsheet. For each day include:
- Day number (1-7)
- Title for the day (e.g. "Legs & Glutes", "Upper Body Push", "Rest & Recovery")
- 4-5 exercises per workout day with: name, sets/reps format (e.g. "3 set/10"), duration in minutes, estimated calories burned
- food_before: specific pre-workout meal (e.g. "1 banana + 1 tbsp peanut butter")
- food_after: specific post-workout meal (e.g. "1 scoop whey + 1 cup rice + 100g chicken")
- Include 1-2 rest days with no exercises

Format as JSON array. EACH exercise has name, sets, reps, duration, calories, food_before, food_after:
[{"day":1,"title":"Legs & Glutes","exercises":[{"name":"Barbell Back Squat","sets":4,"reps":8,"duration":"12 min","calories":110,"food_before":"1 banana + 1 tbsp peanut butter","food_after":"1 scoop whey + 1 cup cooked rice + 100g chicken"}]},{"day":6,"title":"Rest & Recovery","exercises":[]}]

Return ONLY valid JSON, no markdown, no explanation.`;

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

async function generateRestaurantMenu({
  restaurantName,
  cuisineType,
  dietaryFilter,
}) {
  const filterDesc = {
    all: "balanced mix of dishes",
    vegan: "vegan dishes only",
    vegetarian: "vegetarian dishes only",
    organic: "organic/clean dishes",
    high_protein: "high-protein dishes (30g+ protein per serving)",
    high_carbs: "high-carb energy dishes",
    low_calories: "low-calorie dishes (under 400 cal)",
    keto: "keto-friendly low-carb dishes",
  };

  const filter = filterDesc[dietaryFilter] || filterDesc.all;

  const prompt = `You are a nutrition expert. Generate a realistic restaurant menu for "${restaurantName}" (${cuisineType || "restaurant"}).

Requirements:
- Generate 6-8 menu items that match: ${filter}
- Each item must have realistic name, description, price, calories, protein, carbs, and fat
- Prices should be realistic US restaurant prices ($8-$25 range)
- Nutrition values should be realistic and accurate for the dish described
- Include a mix of appetizers, mains, and healthy sides

Return ONLY valid JSON array, no markdown:
[{"name":"Grilled Salmon Bowl","description":"Wild-caught salmon, cauliflower rice, broccoli, lemon herb sauce","price":16.99,"calories":420,"protein":38,"carbs":22,"fat":18},...]`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1500,
    temperature: 0.7,
  });

  const text = response.choices[0]?.message?.content || "[]";
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

module.exports = {
  chatWithCoach,
  generateWorkoutPlan,
  generateRestaurantMenu,
};
