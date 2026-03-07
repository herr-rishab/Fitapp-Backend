const express = require("express");
const router = express.Router();

const {
  getNearbyRestaurants,
  geocodeCity,
} = require("../services/googlePlaces.service");

// ===============================
// GET /api/google/nearby
// Destekler:
// ?lat=41.0082&lng=28.9784&radius=5000
// ?query=New York&radius=5000
// ===============================
router.get("/nearby", async (req, res) => {
  try {
    let { lat, lng, radius = 5000, query } = req.query;

    console.log("📥 GOOGLE ROUTE INPUT:", { lat, lng, radius, query });

    // Eğer şehir adı gönderildiyse → geocode
    if ((!lat || !lng) && query) {
      console.log("🌍 Geocoding query:", query);

      const geo = await geocodeCity(query);

      if (!geo) {
        console.log("❌ Geocode failed");
        return res.json([]);
      }

      lat = geo.lat;
      lng = geo.lng;

      console.log("✅ Geocode success:", { lat, lng });
    }

    // Hâlâ yoksa hata
    if (!lat || !lng) {
      return res.status(400).json({
        error: "Location required: provide lat/lng or query",
      });
    }

    const restaurants = await getNearbyRestaurants(lat, lng, radius);

    console.log(`📤 Sending ${restaurants.length} restaurants`);

    res.json(restaurants);

  } catch (err) {
    console.error("❌ GOOGLE ROUTE ERROR:", err.message);
    res.status(500).json([]);
  }
});

module.exports = router;
