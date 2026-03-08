const axios = require("axios");

// ===============================
// MealMe Configuration
// ===============================
const BASE_URL = process.env.MEALME_BASE_URL || "https://api.mealme.ai";
const CLIENT_ID = process.env.MEALME_CLIENT_ID;
const CLIENT_SECRET = process.env.MEALME_CLIENT_SECRET;
const TIMEOUT = Number(process.env.MEALME_TIMEOUT || 10000);

// ===============================
// MealMe API Request (tries multiple auth patterns)
// ===============================
async function mealmeRequest(method, path, options = {}) {
  const url = `${BASE_URL}${path}`;

  // Auth patterns to try in order:
  // 1. apikey header (from MealMe docs)
  // 2. Id-Token header with client secret
  // 3. Authorization Bearer with client secret
  // 4. Id-Token with client id
  const authPatterns = [
    { apikey: CLIENT_SECRET },
    { "Id-Token": CLIENT_SECRET },
    { Authorization: `Bearer ${CLIENT_SECRET}` },
    { apikey: CLIENT_ID },
    { "Id-Token": CLIENT_ID },
  ];

  for (const authHeaders of authPatterns) {
    try {
      const res = await axios({
        method,
        url,
        timeout: TIMEOUT,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        ...options,
      });

      // Check if we got HTML instead of JSON (means API portal is responding)
      const contentType = res.headers["content-type"] || "";
      if (contentType.includes("text/html")) {
        console.warn("MealMe returned HTML instead of JSON, trying next auth pattern...");
        continue;
      }

      // Check for empty response
      if (!res.data || (typeof res.data === "string" && res.data.trim() === "")) {
        console.warn("MealMe returned empty response, trying next auth pattern...");
        continue;
      }

      console.log("MealMe request succeeded with auth:", Object.keys(authHeaders)[0]);
      return res.data;
    } catch (err) {
      const status = err?.response?.status;
      const contentType = err?.response?.headers?.["content-type"] || "";

      // If we got HTML back (web portal), try next pattern
      if (contentType.includes("text/html")) {
        continue;
      }

      // 401/403 means auth failed, try next pattern
      if (status === 401 || status === 403) {
        continue;
      }

      // Other errors (network, timeout, etc) - stop trying
      console.error("MealMe request error:", err.message);
      throw err;
    }
  }

  // All auth patterns failed
  throw new Error("MEALME_UNAVAILABLE");
}

// ===============================
// Google Places Fallback - Restaurant Search
// ===============================
async function googlePlacesSearch({ query, lat, lon }) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("No GOOGLE_MAPS_API_KEY for fallback");
  }

  console.log("Using Google Places text search as MealMe fallback");

  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/place/textsearch/json",
    {
      params: {
        query: `${query} restaurant`,
        location: `${lat},${lon}`,
        radius: 8000,
        type: "restaurant",
        key: apiKey,
      },
      timeout: 10000,
    }
  );

  const results = res.data?.results || [];

  return results.map((place) => ({
    id: place.place_id,
    name: place.name,
    address: place.formatted_address || place.vicinity || "Unknown",
    rating: place.rating || 0,
    priceLevel: place.price_level || null,
    lat: place.geometry?.location?.lat,
    lon: place.geometry?.location?.lng,
    isOpen: place.opening_hours?.open_now ?? null,
    totalRatings: place.user_ratings_total || 0,
    types: (place.types || []).slice(0, 3),
    photo: place.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`
      : null,
    source: "google_places",
  }));
}

// ===============================
// Google Places Fallback - Restaurant Menu (no real menu, return info)
// ===============================
async function googlePlacesDetails(placeId) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("No GOOGLE_MAPS_API_KEY for fallback");
  }

  console.log("Using Google Places details as MealMe menu fallback");

  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/place/details/json",
    {
      params: {
        place_id: placeId,
        fields: "name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,price_level,url",
        key: apiKey,
      },
      timeout: 10000,
    }
  );

  const place = res.data?.result || {};

  return {
    name: place.name,
    address: place.formatted_address,
    phone: place.formatted_phone_number || null,
    website: place.website || null,
    mapsUrl: place.url || null,
    rating: place.rating || 0,
    priceLevel: place.price_level || null,
    hours: place.opening_hours?.weekday_text || [],
    reviews: (place.reviews || []).slice(0, 3).map((r) => ({
      author: r.author_name,
      rating: r.rating,
      text: r.text,
      time: r.relative_time_description,
    })),
    menuNote:
      "Menu data is not available. Visit the restaurant website for menu details.",
    source: "google_places",
  };
}

// ===============================
// SERVICE FUNCTIONS (with fallback)
// ===============================

async function searchRestaurants({ query, lat, lon }) {
  if (!query) throw new Error("query is required");

  // Try MealMe first
  try {
    const data = await mealmeRequest("GET", "/search/store/v3", {
      params: {
        query,
        latitude: lat,
        longitude: lon,
        store_type: "restaurant",
      },
    });

    const stores = data?.stores || data?.restaurants || [];
    if (stores.length > 0) {
      return stores.map((s) => ({
        id: s._id || s.id,
        name: s.name,
        address: s.address?.street_addr || s.address || "Unknown",
        rating: s.weighted_rating_value || s.rating || 0,
        lat: s.address?.latitude || s.latitude,
        lon: s.address?.longitude || s.longitude,
        cuisines: s.cuisines || [],
        isOpen: s.is_open ?? null,
        source: "mealme",
      }));
    }
  } catch (err) {
    if (err.message !== "MEALME_UNAVAILABLE") {
      console.error("MealMe search failed:", err.message);
    }
  }

  // Fallback to Google Places
  return googlePlacesSearch({ query, lat, lon });
}

async function getNearbyRestaurants({ lat, lon, radius = 5 }) {
  if (!lat || !lon) throw new Error("lat and lon are required");

  // Try MealMe first
  try {
    const data = await mealmeRequest("GET", "/search/store/v3", {
      params: {
        latitude: lat,
        longitude: lon,
        store_type: "restaurant",
      },
    });

    const stores = data?.stores || data?.restaurants || [];
    if (stores.length > 0) {
      return stores.map((s) => ({
        id: s._id || s.id,
        name: s.name,
        address: s.address?.street_addr || s.address || "Unknown",
        rating: s.weighted_rating_value || s.rating || 0,
        lat: s.address?.latitude || s.latitude,
        lon: s.address?.longitude || s.longitude,
        cuisines: s.cuisines || [],
        isOpen: s.is_open ?? null,
        source: "mealme",
      }));
    }
  } catch (err) {
    if (err.message !== "MEALME_UNAVAILABLE") {
      console.error("MealMe nearby failed:", err.message);
    }
  }

  // Fallback to Google Places
  return googlePlacesSearch({ query: "restaurant", lat, lon });
}

async function getRestaurantMenu(restaurantId) {
  if (!restaurantId) throw new Error("restaurantId is required");

  // Try MealMe first
  try {
    const data = await mealmeRequest("GET", `/restaurants/${restaurantId}/menu`);
    const menu = data?.menu || data?.items || [];
    if (menu.length > 0 || data?.name) {
      return { ...data, source: "mealme" };
    }
  } catch (err) {
    if (err.message !== "MEALME_UNAVAILABLE") {
      console.error("MealMe menu failed:", err.message);
    }
  }

  // Fallback to Google Places details
  return googlePlacesDetails(restaurantId);
}

module.exports = {
  getNearbyRestaurantsFromMealMe: getNearbyRestaurants,
  getRestaurantMenuFromMealMe: getRestaurantMenu,
  searchRestaurantsFromMealMe: searchRestaurants,
};
