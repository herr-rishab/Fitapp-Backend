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
  duration,
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
${duration ? `- Target Session Length: ${duration} minutes` : ""}
${targetBodyPart ? `- Focus Area: ${targetBodyPart}` : ""}
${weight ? `- Current Weight: ${weight} lbs` : ""}
${height ? `- Height: ${height} inches` : ""}
${desiredWeight ? `- Desired Weight: ${desiredWeight} lbs` : ""}
${age ? `- Age: ${age}` : ""}
${gender ? `- Gender: ${gender}` : ""}

Create a 7-day workout plan like a personal trainer spreadsheet. For each day include:
- Day number (1-7)
- Title for the day (e.g. "Legs & Glutes", "Upper Body Push", "Rest & Recovery")
- A short training focus summary for the day
- 4-5 exercises per workout day with: name, sets, reps, duration in minutes, estimated calories burned
- day-level food_before: a specific pre-workout meal with portions
- day-level food_after: a specific post-workout meal with portions
- Include 1-2 rest days with no exercises
- Keep the plan practical for the user's level and goal
- Rest days must still include recovery guidance plus lighter meal suggestions

Format as JSON array. EACH day object must use this exact shape:
[{"day":1,"title":"Legs & Glutes","focus":"Compound lower-body strength and glute activation","food_before":"1 banana + 1 tbsp peanut butter","food_after":"1 scoop whey + 1 cup cooked rice + 100g chicken","exercises":[{"name":"Barbell Back Squat","sets":4,"reps":"8-10","duration":"12 min","calories":110},{"name":"Romanian Deadlift","sets":3,"reps":"10-12","duration":"10 min","calories":95}]},{"day":6,"title":"Rest & Recovery","focus":"Mobility, walking, and stretching","food_before":"Greek yogurt with berries","food_after":"Salmon, sweet potato, and vegetables","exercises":[]}]

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

  // Add uniqueness by including restaurant name prominently and asking for signature dishes
  const prompt = `You are a nutrition expert creating a UNIQUE menu specifically for "${restaurantName}".

Restaurant Details:
- Name: ${restaurantName}
- Cuisine Type: ${cuisineType || "restaurant"}
- Dietary Focus: ${filter}

IMPORTANT: Create UNIQUE dishes that match this specific restaurant's name and cuisine style. DO NOT use generic menu items.

Requirements:
- Generate 6-8 SIGNATURE menu items that are unique to "${restaurantName}"
- Each dish name should reflect the restaurant's cuisine type (${cuisineType})
- Include realistic descriptions, prices ($8-$25), and accurate nutrition (calories, protein, carbs, fat)
- Make the dishes creative and specific to this restaurant's style
- Include a mix of appetizers, mains, and healthy sides

Return ONLY valid JSON array, no markdown:
[{"name":"Grilled Salmon Bowl","description":"Wild-caught salmon, cauliflower rice, broccoli, lemon herb sauce","price":16.99,"calories":420,"protein":38,"carbs":22,"fat":18},...]`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1500,
    temperature: 0.9, // Increased for more variety
  });

  const text = response.choices[0]?.message?.content || "[]";
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

async function analyzeFoodImage({
  imageBuffer,
  mimeType = "image/jpeg",
}) {
  if (!process.env.OPENAI_API_KEY || !imageBuffer) {
    return {
      description: "",
      detectedFoods: [],
      recipes: [],
    };
  }

  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a food recognition assistant. Identify visible foods from an image and suggest simple recipes based on the detected ingredients. Return only valid JSON.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              'Analyze this food image. Return JSON with this exact shape: {"description":"short plain-English meal description","detectedFoods":[{"label":"food name","category":"category","confidence":"high|medium|low"}],"recipes":[{"label":"recipe name","description":"1 sentence recipe idea"}]}. Keep 1-5 detected foods and up to 4 recipe ideas.',
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
    max_tokens: 700,
    temperature: 0.2,
  });

  const text = response.choices[0]?.message?.content || "{}";

  try {
    return JSON.parse(text);
  } catch {
    return {
      description: "",
      detectedFoods: [],
      recipes: [],
    };
  }
}

module.exports = {
  chatWithCoach,
  generateWorkoutPlan,
  generateRestaurantMenu,
  analyzeFoodImage,
};
