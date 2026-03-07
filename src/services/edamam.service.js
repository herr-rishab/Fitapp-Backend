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
    throw error;
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
 * 🍳 RECIPE SEARCH 
 * ============================
 * Örnek: "chicken pasta"
 */
async function searchRecipes(query) {
  console.log("🍳 [RECIPE] Arama:", query);

  try {
    const res = await axios.get(RECIPE_BASE, {
      params: {
        type: "public",
        q: query,
        app_id: APP_ID,
        app_key: APP_KEY,
      },
    });

    const hits = res.data?.hits || [];

    console.log("✅ [RECIPE] Bulunan tarif sayısı:", hits.length);

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

  } catch (error) {
    console.error("❌ [EDAMAM RECIPE ERROR]");
    if (error.response) {
      console.error("📡 Status:", error.response.status);
      console.error("📨 Response Data:", error.response.data);
    } else {
      console.error("🔥 Error Message:", error.message);
    }
    throw error;
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
