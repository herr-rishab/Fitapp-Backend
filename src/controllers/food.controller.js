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
// Recipe Search (Edamam Recipe API)
// ============================
async function searchRecipes(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({
      error: "Please enter a recipe search term",
    });
  }

  try {
    // searchRecipes already returns formatted array
    const recipes = await edamam.searchRecipes(q);

    res.json({
      source: "edamam",
      total: recipes.length,
      recipes,
    });
  } catch (err) {
    console.error("Recipe search error:", err.message);
    res.status(500).json({
      error: "Recipe search failed",
    });
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

};

