const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload.middleware");

const {
  getDirections,
  getNearbyRestaurants,
  searchRestaurants,
  getRestaurantMenu,
  searchFood,
  nlpFood,
  barcodeFood,
  imageFood,
  getFoodDetails,
  searchRecipes, // 👈 YENİ (Edamam Recipe)
} = require("../controllers/food.controller");


// ===============================
// 📍 Directions
// ===============================
router.get("/restaurant/:id/directions", getDirections);


// ===============================
// 🍽️ Google - Nearby Restaurants
// ===============================
router.get("/restaurants/nearby", getNearbyRestaurants);


// ===============================
// 🔍 MealMe - Search Restaurants
// ===============================
router.get("/restaurants/search", searchRestaurants);


// ===============================
// 📋 MealMe - Restaurant Menu
// ===============================
router.get("/restaurants/:id/menu", getRestaurantMenu);


// ===============================
// 🔎 Food Search (FatSecret)
// ===============================
router.get("/search", searchFood);


// ===============================
// 📋 Food Details (FatSecret)
// ===============================
router.get("/details/:id", getFoodDetails);


// ===============================
// 🧠 NLP Food (FatSecret)
// ===============================
router.post("/nlp", nlpFood);


// ===============================
// 📦 Barcode (Edamam)
// ===============================
router.get("/barcode/:code", barcodeFood);


// ===============================
// 🖼️ Image Recognition (Edamam Vision)
// multipart/form-data → image
// ===============================
router.post(
  "/image",
  upload.single("image"),
  imageFood
);


// ===============================
// 🍳 Recipe Search (Edamam Recipe API)  ✅ YENİ
// Örnek: /api/food/recipes?q=chicken pasta
// ===============================
router.get("/recipes", searchRecipes);


module.exports = router;
