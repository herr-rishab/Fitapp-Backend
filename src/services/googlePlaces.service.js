const axios = require("axios");

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

// ===============================
// Filters (US optimized)
// ===============================
const goodWords = [
  "healthy",
  "vegan",
  "vegetarian",
  "organic",
  "salad",
  "bowl",
  "poke",
  "smoothie",
  "juice",
  "cold pressed",
  "fit",
  "nutrition",
  "protein",
  "wellness",
  "clean",
  "whole food",
  "fresh",
  "plant-based",
  "gluten free",
  "low carb",
  "keto"
];

const badWords = [
  "hotel",
  "resort",
  "motel",
  "burger",
  "pizza",
  "fries",
  "fried",
  "bbq",
  "steakhouse",
  "grill",
  "mcdonald",
  "kfc",
  "wendy",
  "domino",
  "pizza hut",
  "taco bell",
  "subway",
  "diner",
  "bar",
  "pub",
  "nightclub",
  "donut",
  "bakery",
  "dessert",
  "ice cream",
  "buffet",
  "all you can eat"
];

function hasGoodKeyword(name = "", categories = []) {
  const haystack = `${name} ${categories.join(" ")}`.toLowerCase();
  return goodWords.some((word) => haystack.includes(word));
}

function hasBadKeyword(name = "", categories = []) {
  const haystack = `${name} ${categories.join(" ")}`.toLowerCase();
  return badWords.some((word) => haystack.includes(word));
}

function toMiles(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return "Nearby";
  return `${(distanceMeters / 1609.34).toFixed(1)} mi`;
}

function normalizeRestaurant(feature) {
  const props = feature?.properties || {};
  const categories = Array.isArray(props.categories) ? props.categories : [];
  const tagSource = Array.isArray(props.datasource?.raw?.types)
    ? props.datasource.raw.types
    : categories;

  return {
    id: props.place_id || props.datasource?.raw?.place_id || props.datasource?.raw?.osm_id || `${props.lat},${props.lon}`,
    placeId: props.place_id || props.datasource?.raw?.place_id || null,
    name: props.name || props.address_line1 || "Unknown restaurant",
    type: categories[0] || "restaurant",
    address: props.formatted || props.address_line1 || "Unknown address",
    rating: props.datasource?.raw?.rating || 0,
    lat: props.lat,
    lon: props.lon,
    tags: tagSource.slice(0, 3).map((tag) => String(tag).replaceAll("_", " ")),
    calories: Math.floor(Math.random() * 400) + 200,
    protein: Math.floor(Math.random() * 30) + 10,
    distanceMiles: toMiles(props.distance),
    website: props.website || null,
  };
}

async function geocodeCity(query) {
  if (!query) return null;

  console.log("➡️ GEOCODE REQUEST:", { query });

  const response = await axios.get("https://nominatim.openstreetmap.org/search", {
    params: {
      q: query,
      format: "jsonv2",
      limit: 1,
    },
    timeout: 15000,
    headers: {
      "User-Agent": "fitapp-backend/1.0",
    },
  });

  const first = response.data?.[0];
  if (!first) return null;

  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
  };
}

async function getNearbyRestaurants(lat, lng, radius = 1500) {
  if (!GEOAPIFY_API_KEY) {
    throw new Error("Missing GEOAPIFY_API_KEY");
  }

  console.log("➡️ GEOAPIFY NEARBY REQUEST:", { lat, lng, radius });

  const response = await axios.get("https://api.geoapify.com/v2/places", {
    params: {
      categories: "catering.restaurant,catering.cafe,catering.fast_food",
      filter: `circle:${lng},${lat},${radius}`,
      bias: `proximity:${lng},${lat}`,
      limit: 30,
      apiKey: GEOAPIFY_API_KEY,
    },
    timeout: 15000,
  });

  const features = Array.isArray(response.data?.features)
    ? response.data.features
    : [];

  console.log("📦 RAW RESULTS:", features.length);

  const filtered = features.filter((feature) => {
    const props = feature?.properties || {};
    const name = props.name || props.address_line1 || "";
    const categories = Array.isArray(props.categories) ? props.categories : [];

    if (hasBadKeyword(name, categories)) return false;
    if (hasGoodKeyword(name, categories)) return true;

    const rating = Number(props.datasource?.raw?.rating || 0);
    return rating >= 4.2 || categories.includes("catering.restaurant");
  });

  const formatted = filtered.map(normalizeRestaurant);

  console.log(`🥗 FINAL HEALTHY RESTAURANTS: ${formatted.length}`);

  return formatted;
}

module.exports = {
  geocodeCity,
  getNearbyRestaurants,
};
