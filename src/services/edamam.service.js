const axios = require("axios");

// ============================
// 🌐 EDAMAM BASE URLS
// ============================
const FOOD_BASE = "https://api.edamam.com/api/food-database/v2";
const NUTRITION_BASE = "https://api.edamam.com/api";
const RECIPE_BASE = "https://api.edamam.com/api/recipes/v2"; // 👈 YENİ

// ============================
// 🔐 ENV
// ============================
const APP_ID = process.env.EDAMAM_APP_ID;
const APP_KEY = process.env.EDAMAM_APP_KEY;

function normalizeOpenFoodFactsProduct(product) {
  if (!product) return [];

  return [
    {
      food: {
        label: product.product_name || product.product_name_en || "Unknown product",
        brand: product.brands || "N/A",
        category:
          product.categories ||
          product.categories_tags?.[0]?.replace(/^en:/, "") ||
          "N/A",
        nutrients: product.nutriments || {},
      },
    },
  ];
}

/**
 * ============================
 * 📦 BARCODE LOOKUP
 * ============================
 * UPC / Barcode ile ürün arama
 */
async function barcodeLookup(upc) {
  if (!APP_ID || !APP_KEY) {
    const fallback = await axios.get(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(upc)}.json`,
      {
        timeout: 15000,
      }
    );

    return normalizeOpenFoodFactsProduct(fallback.data?.product);
  }

  console.log("====================================");
  console.log("📦 [BARCODE] Backend’e gelen barkod:");
  console.log("➡️ ", upc);
  console.log("====================================");

  try {
    const res = await axios.get(`${FOOD_BASE}/parser`, {
      params: {
        upc,
        app_id: APP_ID,
        app_key: APP_KEY,
      },
    });

    const hints = res.data?.hints || [];

    console.log("✅ [EDAMAM] API cevap verdi");
    console.log("🔢 Ürün sayısı (hints.length):", hints.length);

    if (hints.length === 0) {
      console.log("⚠️ [EDAMAM] Bu barkod için ürün bulunamadı");
    } else {
      console.log("🍎 [EDAMAM] İlk ürün:");
      console.log({
        label: hints[0]?.food?.label,
        brand: hints[0]?.food?.brand,
        category: hints[0]?.food?.category,
      });
    }

    return hints;

  } catch (error) {
    console.log("====================================");
    console.error("❌ [EDAMAM BARCODE ERROR]");
    console.error("🔢 Barkod:", upc);

    if (error.response) {
      console.error("📡 Status:", error.response.status);
      console.error("📨 Response Data:", error.response.data);
    } else {
      console.error("🔥 Error Message:", error.message);
    }

    console.log("====================================");
    // Fallback to OpenFoodFacts
    console.log("[BARCODE] Falling back to OpenFoodFacts...");
    try {
      const fallback = await axios.get(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(upc)}.json`,
        { timeout: 15000 }
      );
      return normalizeOpenFoodFactsProduct(fallback.data?.product);
    } catch (fallbackErr) {
      console.error("[BARCODE] OpenFoodFacts also failed:", fallbackErr.message);
      throw error;
    }
  }
}

/**
 * ============================
 * 🧠 NLP FOOD (Sentence Parsing)
 * ============================
 * Örnek: "2 eggs and 1 slice of bread"
 */
async function nlpFood(text) {
  console.log("🧠 [NLP] Gelen metin:", text);

  const res = await axios.post(
    `${NUTRITION_BASE}/nutrition-details`,
    {
      ingr: text,
    },
    {
      params: {
        app_id: APP_ID,
        app_key: APP_KEY,
      },
    }
  );

  return res.data;
}

/**
 * ============================
 * 🖼️ IMAGE RECOGNITION (VISION)
 * ============================
 * PUBLIC image URL ile çalışır
 */
async function imageFood(imageUrl) {
  if (!APP_ID || !APP_KEY || !imageUrl || typeof imageUrl !== "string") {
    return { hints: [] };
  }

  console.log("🖼️ [IMAGE] Görsel analizi başlatıldı");
  console.log("🔗 Image URL:", imageUrl);

  const res = await axios.post(
    `${FOOD_BASE}/parser`,
    {
      image: imageUrl,
    },
    {
      params: {
        app_id: APP_ID,
        app_key: APP_KEY,
      },
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return {
    hints: res.data?.hints || [],
  };
}

/**
 * ============================
 * RECIPE SEARCH (Edamam Recipe API with food database fallback)
 * ============================
 */
async function searchRecipes(query) {
  console.log("[RECIPE] Search:", query);

  // Try Edamam Recipe API v2 first
  try {
    const res = await axios.get(RECIPE_BASE, {
      params: {
        type: "public",
        q: query,
        app_id: APP_ID,
        app_key: APP_KEY,
      },
      timeout: 10000,
    });

    const hits = res.data?.hits || [];
    console.log("[RECIPE] Edamam recipe hits:", hits.length);

    if (hits.length > 0) {
      return hits.map((hit) => ({
        label: hit.recipe.label,
        image: hit.recipe.image,
        source: hit.recipe.source,
        url: hit.recipe.url,
        calories: Math.round(hit.recipe.calories),
        servings: hit.recipe.yield,
        protein: Math.round(
          hit.recipe.totalNutrients?.PROCNT?.quantity || 0
        ),
        fat: Math.round(
          hit.recipe.totalNutrients?.FAT?.quantity || 0
        ),
        carbs: Math.round(
          hit.recipe.totalNutrients?.CHOCDF?.quantity || 0
        ),
        ingredients: hit.recipe.ingredientLines,
      }));
    }
  } catch (error) {
    console.log(
      "[RECIPE] Edamam recipe API failed (status:",
      error.response?.status || error.message,
      "), falling back to food database"
    );
  }

  // Fallback: use Edamam food database parser to get food-based results
  try {
    const res = await axios.get(`${FOOD_BASE}/parser`, {
      params: {
        ingr: query,
        app_id: APP_ID,
        app_key: APP_KEY,
      },
      timeout: 10000,
    });

    const hints = res.data?.hints || [];
    console.log("[RECIPE] Food database fallback hits:", hints.length);

    return hints.slice(0, 20).map((hint) => {
      const food = hint.food || {};
      const nutrients = food.nutrients || {};
      return {
        label: food.label || "Unknown",
        image: food.image || null,
        source: "Edamam Food Database",
        url: null,
        calories: Math.round(nutrients.ENERC_KCAL || 0),
        servings: 1,
        protein: Math.round(nutrients.PROCNT || 0),
        fat: Math.round(nutrients.FAT || 0),
        carbs: Math.round(nutrients.CHOCDF || 0),
        ingredients: [],
        category: food.category || null,
        brand: food.brand || null,
      };
    });
  } catch (fallbackError) {
    console.error(
      "[RECIPE] Food database fallback also failed:",
      fallbackError.response?.status || fallbackError.message
    );
    throw fallbackError;
  }
}

// ============================
// 📦 EXPORTS
// ============================
module.exports = {
  barcodeLookup,
  nlpFood,
  imageFood,
  searchRecipes, // 
};
