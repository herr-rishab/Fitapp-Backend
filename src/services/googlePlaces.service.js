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

  // Extract complete address with street number
  let fullAddress = "";

  // Priority 1: Use address_line2 (contains full address without restaurant name)
  if (props.address_line2 && props.address_line2.length > 10) {
    fullAddress = props.address_line2;
  }
  // Priority 2: Use formatted address (contains name + full address)
  else if (props.formatted && props.formatted.length > 10) {
    // Remove restaurant name from formatted address if it starts with it
    const name = props.name || props.address_line1 || "";
    if (name && props.formatted.startsWith(name)) {
      fullAddress = props.formatted.substring(name.length).replace(/^,\s*/, "");
    } else {
      fullAddress = props.formatted;
    }
  }
  // Priority 3: Build manually from components
  else {
    const parts = [];
    const housenumber = props.housenumber || props.datasource?.raw?.["addr:housenumber"] || "";
    const street = props.street || props.datasource?.raw?.["addr:street"] || "";
    const city = props.city || props.datasource?.raw?.["addr:city"] || "";
    const state = props.state_code || props.state || "";
    const postcode = props.postcode || props.datasource?.raw?.["addr:postcode"] || "";

    if (housenumber && street) {
      parts.push(`${housenumber} ${street}`);
    } else if (street) {
      parts.push(street);
    }
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (postcode) parts.push(postcode);

    fullAddress = parts.join(", ") || "Address not available";
  }

  return {
    id: props.place_id || props.datasource?.raw?.place_id || props.datasource?.raw?.osm_id || `${props.lat},${props.lon}`,
    placeId: props.place_id || props.datasource?.raw?.place_id || null,
    name: props.name || props.address_line1 || "Unknown restaurant",
    type: categories[0] || "restaurant",
    address: fullAddress,
    rating: props.datasource?.raw?.rating || 0,
    lat: props.lat,
    lon: props.lon,
    tags: tagSource.slice(0, 3).map((tag) => String(tag).replaceAll("_", " ")),
    calories: Math.floor(Math.random() * 400) + 200,
    protein: Math.floor(Math.random() * 30) + 10,
    distanceMiles: toMiles(props.distance),
    website: props.website || props.datasource?.raw?.website || null,
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

  // Filter and score restaurants
  const scored = features.map((feature) => {
    const props = feature?.properties || {};
    const name = props.name || props.address_line1 || "";
    const categories = Array.isArray(props.categories) ? props.categories : [];

    let score = 0;

    // Priority 1: Has complete address with street number (most important)
    const hasStreetNumber = props.housenumber || props.datasource?.raw?.["addr:housenumber"];
    if (hasStreetNumber) score += 100;

    // Priority 2: Has good health keywords
    if (hasGoodKeyword(name, categories)) score += 50;

    // Priority 3: High rating
    const rating = Number(props.datasource?.raw?.rating || 0);
    if (rating >= 4.5) score += 30;
    else if (rating >= 4.0) score += 20;

    // Priority 4: Is a restaurant (not just a building)
    if (categories.includes("catering.restaurant") || categories.includes("catering.cafe")) score += 10;

    // Penalty: Has bad keywords (but don't exclude completely)
    if (hasBadKeyword(name, categories)) score -= 30;

    // Exclude if no name or score is too low
    if (!name || name.length < 2 || score < 0) return null;

    return { feature, score };
  }).filter(Boolean);

  // Sort by score (highest first) and take top results
  scored.sort((a, b) => b.score - a.score);

  const formatted = scored.slice(0, 20).map(item => normalizeRestaurant(item.feature));

  console.log(`🥗 FINAL RESTAURANTS: ${formatted.length} (prioritized by address completeness)`);

  return formatted;
}

module.exports = {
  geocodeCity,
  getNearbyRestaurants,
};
