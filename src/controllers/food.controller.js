const {
  getNearbyRestaurants: getNearbyRestaurantsFromGoogle,
} = require("../services/googlePlaces.service");

const {
  searchRestaurantsFromMealMe,
  getRestaurantMenuFromMealMe,
} = require("../services/mealme.service");

const fatsecret = require("../services/fatsecret.service");
const edamam = require("../services/edamam.service");
const nutritionix = require("../services/nutritionix.service");


// ============================
// Directions (returns Google Maps URL)
// ============================
async function getDirections(req, res) {
  try {
    const { lat, lng, destLat, destLng } = req.query;

    if (!lat || !lng || !destLat || !destLng) {
      return res.status(400).json({
        error: "lat,lng,destLat,destLng are required",
      });
    }

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destLat},${destLng}&travelmode=driving`;
    res.json({ url: mapsUrl });
  } catch (err) {
    console.error("Directions API error:", err.message);
    res.status(500).json({ error: "Directions API failed" });
  }
}


// ============================
// Nearby Restaurants (Geoapify)
// ============================
async function getNearbyRestaurants(req, res) {
  try {
    const { lat, lon, radius = 5 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: "lat and lon are required" });
    }

    // Geoapify service returns already formatted restaurants
    const restaurants = await getNearbyRestaurantsFromGoogle(
      lat,
      lon,
      radius * 1000
    );

    res.json(restaurants);
  } catch (err) {
    console.error("Nearby restaurants error:", err.message);
    res.status(500).json({ error: "Failed to fetch nearby restaurants" });
  }
}


// ============================
// 🔍 MealMe - Search Restaurants
// ============================
async function searchRestaurants(req, res) {
  try {
    const { q, lat, lon } = req.query;

    if (!q || !lat || !lon) {
      return res.status(400).json({
        error: "q, lat and lon are required",
      });
    }

    const data = await searchRestaurantsFromMealMe({
      query: q,
      lat,
      lon,
    });

    res.json(data);
  } catch (err) {
    console.error("MealMe search error:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
}


// ============================
// 📋 MealMe - Restaurant Menu
// ============================
async function getRestaurantMenu(req, res) {
  try {
    const { id } = req.params;
    const data = await getRestaurantMenuFromMealMe(id);
    res.json(data);
  } catch (err) {
    console.error("MealMe menu error:", err.message);
    res.status(500).json({ error: "Menu fetch failed" });
  }
}


// ============================
// 🍎 Food Search (FatSecret)
// ============================
async function searchFood(req, res) {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    const results = await fatsecret.searchFoods(q);
    res.json({ source: "fatsecret", results });
  } catch (err) {
    console.error("Food search error:", err.message);
    res.status(500).json({ error: "Food search failed" });
  }
}


// ============================
// NLP Food (Nutritionix natural language + FatSecret fallback)
// ============================
async function nlpFood(req, res) {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  // Try Nutritionix NLP first (real natural language parsing)
  if (process.env.NUTRITIONIX_APP_ID && process.env.NUTRITIONIX_API_KEY) {
    try {
      const foods = await nutritionix.nlpSearch(text);
      if (foods.length > 0) {
        return res.json({ source: "nutritionix", results: foods });
      }
    } catch (err) {
      console.error("Nutritionix NLP error, falling back to FatSecret:", err.message);
    }
  }

  // Fallback to FatSecret search
  try {
    const results = await fatsecret.searchFoods(text);
    res.json({ source: "fatsecret", results });
  } catch (err) {
    console.error("NLP error:", err.message);
    res.status(500).json({ error: "NLP failed" });
  }
}


// ============================
// 📦 Barcode (Edamam)
// ============================
async function barcodeFood(req, res) {
  const code = req.params.code;
  if (!code) return res.status(400).json({ error: "Missing barcode" });

  try {
    const hints = await edamam.barcodeLookup(code);

    res.json({
      source: "edamam",
      count: hints.length,
      hints,   // 👈 results yerine hints
    });
  } catch (err) {
    console.error("Barcode error:", err.message);
    res.status(500).json({ error: "Barcode lookup failed" });
  }
}



// ============================
// 🖼️ Image Recognition (Edamam Vision)
// ============================
async function imageFood(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required" });
  }

  try {
    const data = await edamam.imageFood(null);
    res.json({
      source: "image",
      hints: data?.hints || [],
    });
  } catch (err) {
    console.error("Image recognition error:", err.message);
    res.status(500).json({ error: "Image recognition failed" });
  }
}


// ============================
// 📋 Food Details (FatSecret)
// ============================
async function getFoodDetails(req, res) {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Missing food id" });

  try {
    const data = await fatsecret.getFoodDetails(id);
    res.json(data);
  } catch (err) {
    console.error("Food details error:", err.message);
    res.status(500).json({ error: "Food details failed" });
  }
}

// ============================
// Recipe Search (Edamam Recipe API with FatSecret fallback)
// ============================
async function searchRecipes(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      error: "Please enter a recipe search term",
    });
  }

  // Try Edamam first (recipe API -> food database fallback built in)
  try {
    const recipes = await edamam.searchRecipes(q);

    if (recipes && recipes.length > 0) {
      return res.json({
        source: "edamam",
        total: recipes.length,
        recipes,
      });
    }
  } catch (err) {
    console.error("Edamam recipe search failed, trying FatSecret fallback:", err.message);
  }

  // Final fallback: use FatSecret to provide food-based results
  try {
    const results = await fatsecret.searchFoods(q);
    const foods = Array.isArray(results) ? results : [];

    const recipes = foods.slice(0, 20).map((food) => ({
      label: food.food_name || "Unknown",
      image: null,
      source: "FatSecret",
      url: food.food_url || null,
      calories: parseNutrientFromDescription(food.food_description, "Calories"),
      servings: 1,
      protein: parseNutrientFromDescription(food.food_description, "Protein"),
      fat: parseNutrientFromDescription(food.food_description, "Fat"),
      carbs: parseNutrientFromDescription(food.food_description, "Carbs"),
      ingredients: [],
      description: food.food_description || null,
    }));

    return res.json({
      source: "fatsecret",
      total: recipes.length,
      recipes,
    });
  } catch (fallbackErr) {
    console.error("Recipe fallback also failed:", fallbackErr.message);
    res.status(500).json({ error: "Recipe search failed" });
  }
}

// Helper to parse nutrients from FatSecret description string
// e.g. "Per 101g - Calories: 197kcal | Fat: 7.79g | Carbs: 0.00g | Protein: 29.80g"
function parseNutrientFromDescription(desc, nutrient) {
  if (!desc) return 0;
  const regex = new RegExp(`${nutrient}:\\s*([\\d.]+)`, "i");
  const match = desc.match(regex);
  return match ? Math.round(parseFloat(match[1])) : 0;
}
// ============================
// Curated Food Lists (FatSecret search by category)
// ============================
const CURATED_SEARCH_TERMS = {
  high_protein: [
    "chicken breast", "salmon", "tuna", "eggs", "greek yogurt",
    "beef steak", "turkey breast", "cottage cheese", "whey protein", "shrimp"
  ],
  low_carb: [
    "grilled chicken", "avocado", "almonds", "cheese", "spinach",
    "broccoli", "salmon", "olive oil", "eggs", "cauliflower"
  ],
  superfoods: [
    "quinoa", "blueberries", "kale", "chia seeds", "sweet potato",
    "avocado", "salmon", "almonds", "spinach", "acai"
  ],
  keto: [
    "bacon", "avocado", "butter", "cheese", "coconut oil",
    "almonds", "beef", "eggs", "cream cheese", "olive oil"
  ],
  vegan: [
    "tofu", "tempeh", "lentils", "chickpeas", "quinoa",
    "black beans", "edamame", "nutritional yeast", "hemp seeds", "oatmeal"
  ],
  pre_workout: [
    "banana", "oatmeal", "rice cakes", "peanut butter", "sweet potato",
    "apple", "whole wheat bread", "granola", "energy bar", "trail mix"
  ],
};

async function getCuratedFoods(req, res) {
  const { category } = req.body;

  if (!category) {
    return res.status(400).json({
      error: "Missing category",
      validCategories: Object.keys(CURATED_SEARCH_TERMS),
    });
  }

  const searchTerms = CURATED_SEARCH_TERMS[category];
  if (!searchTerms) {
    return res.status(400).json({
      error: `Invalid category: ${category}`,
      validCategories: Object.keys(CURATED_SEARCH_TERMS),
    });
  }

  try {
    // Search FatSecret for each term in parallel
    const searchPromises = searchTerms.map(async (term) => {
      try {
        const results = await fatsecret.searchFoods(term);
        // Take the first (most relevant) result for each search term
        if (Array.isArray(results) && results.length > 0) {
          return {
            ...results[0],
            curated_category: category,
            search_term: term,
          };
        }
        return null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(searchPromises);
    const foods = results.filter(Boolean);

    res.json({
      source: "fatsecret",
      category,
      total: foods.length,
      foods,
    });
  } catch (err) {
    console.error("Curated foods error:", err.message);
    res.status(500).json({ error: "Failed to fetch curated foods" });
  }
}


// ============================
// Nutrition Calculator (BMI, TDEE, macros, protein, water)
// ============================
function calculateNutrition({ weight, height, age, gender, activity }) {
  // weight in kg, height in cm, age in years
  const w = Number(weight);
  const h = Number(height);
  const a = Number(age);
  const g = (gender || "male").toLowerCase();

  // Activity multipliers
  const activityMultipliers = {
    sedentary: 1.2,        // little or no exercise
    light: 1.375,          // light exercise 1-3 days/week
    moderate: 1.55,        // moderate exercise 3-5 days/week
    active: 1.725,         // hard exercise 6-7 days/week
    very_active: 1.9,      // very hard exercise, physical job
  };

  const activityFactor = activityMultipliers[activity] || activityMultipliers.moderate;

  // ---- BMI ----
  const heightM = h / 100;
  const bmi = w / (heightM * heightM);

  let bmiCategory;
  if (bmi < 18.5) bmiCategory = "Underweight";
  else if (bmi < 25) bmiCategory = "Normal weight";
  else if (bmi < 30) bmiCategory = "Overweight";
  else bmiCategory = "Obese";

  // ---- BMR (Mifflin-St Jeor) ----
  let bmr;
  if (g === "female") {
    bmr = 10 * w + 6.25 * h - 5 * a - 161;
  } else {
    bmr = 10 * w + 6.25 * h - 5 * a + 5;
  }

  // ---- TDEE ----
  const tdee = bmr * activityFactor;

  // ---- Macros (balanced split) ----
  // Protein: 30%, Carbs: 40%, Fat: 30%
  const proteinCals = tdee * 0.30;
  const carbsCals = tdee * 0.40;
  const fatCals = tdee * 0.30;

  const macros = {
    protein: { grams: Math.round(proteinCals / 4), calories: Math.round(proteinCals), percent: 30 },
    carbs: { grams: Math.round(carbsCals / 4), calories: Math.round(carbsCals), percent: 40 },
    fat: { grams: Math.round(fatCals / 9), calories: Math.round(fatCals), percent: 30 },
  };

  // ---- Protein needs (different goals) ----
  const proteinNeeds = {
    sedentary: { grams: Math.round(w * 0.8), perKg: 0.8, description: "Minimum recommended" },
    maintain: { grams: Math.round(w * 1.2), perKg: 1.2, description: "Maintain muscle" },
    build_muscle: { grams: Math.round(w * 1.6), perKg: 1.6, description: "Build muscle" },
    athlete: { grams: Math.round(w * 2.0), perKg: 2.0, description: "Athlete / intense training" },
  };

  // ---- Water intake ----
  // Base: 30-35ml per kg, adjusted for activity
  const baseWaterMl = w * 33;
  const activityWaterBonus = {
    sedentary: 0,
    light: 350,
    moderate: 500,
    active: 700,
    very_active: 1000,
  };

  const totalWaterMl = baseWaterMl + (activityWaterBonus[activity] || 500);

  const water = {
    liters: Math.round(totalWaterMl / 100) / 10,  // round to 1 decimal
    ml: Math.round(totalWaterMl),
    cups: Math.round(totalWaterMl / 237),          // 237ml per cup
    oz: Math.round(totalWaterMl / 29.574),         // fl oz
  };

  // ---- Weight goals ----
  const weightGoals = {
    lose_0_5_kg_week: { calories: Math.round(tdee - 500), description: "Lose 0.5kg/week" },
    lose_1_kg_week: { calories: Math.round(tdee - 1000), description: "Lose 1kg/week" },
    maintain: { calories: Math.round(tdee), description: "Maintain weight" },
    gain_0_5_kg_week: { calories: Math.round(tdee + 500), description: "Gain 0.5kg/week" },
    gain_1_kg_week: { calories: Math.round(tdee + 1000), description: "Gain 1kg/week" },
  };

  return {
    input: { weight: w, height: h, age: a, gender: g, activity: activity || "moderate" },
    bmi: {
      value: Math.round(bmi * 10) / 10,
      category: bmiCategory,
    },
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    macros,
    proteinNeeds,
    water,
    weightGoals,
  };
}

async function nutritionCalc(req, res) {
  const { weight, height, age, gender, activity } = req.body;

  if (!weight || !height || !age) {
    return res.status(400).json({
      error: "weight (kg), height (cm), and age are required",
      optional: "gender (male/female), activity (sedentary/light/moderate/active/very_active)",
    });
  }

  try {
    const results = calculateNutrition({ weight, height, age, gender, activity });
    res.json(results);
  } catch (err) {
    console.error("Nutrition calc error:", err.message);
    res.status(500).json({ error: "Nutrition calculation failed" });
  }
}


// ============================
// EXPORT
// ============================
module.exports = {
  getDirections,
  getNearbyRestaurants,
  searchRestaurants,
  getRestaurantMenu,
  searchFood,
  nlpFood,
  barcodeFood,
  imageFood,
  getFoodDetails,
  searchRecipes,
  getCuratedFoods,
  nutritionCalc,
};

