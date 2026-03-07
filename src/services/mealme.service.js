const axios = require("axios");

const BASE_URL = process.env.MEALME_BASE_URL;
const CLIENT_ID = process.env.MEALME_CLIENT_ID;
const CLIENT_SECRET = process.env.MEALME_CLIENT_SECRET;
const TIMEOUT = Number(process.env.MEALME_TIMEOUT || 10000);

if (!BASE_URL) console.warn("⚠️ Missing MEALME_BASE_URL in .env");
if (!CLIENT_ID) console.warn("⚠️ Missing MEALME_CLIENT_ID in .env");
if (!CLIENT_SECRET) console.warn("⚠️ Missing MEALME_CLIENT_SECRET in .env");

// ===============================
// TOKEN CACHE
// ===============================
let accessToken = null;
let tokenExpiresAt = null;
let tokenPromise = null;

// ===============================
// TOKEN AL
// ===============================
async function fetchAccessToken() {
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      console.log("🔐 Requesting MealMe access token...");

      const res = await axios.post(
        `${BASE_URL}/oauth/token`,
        {
          grant_type: "client_credentials",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        },
        {
          timeout: TIMEOUT,
          headers: { "Content-Type": "application/json" },
        }
      );

      accessToken = res.data.access_token;
      const expiresIn = res.data.expires_in || 3600;
      tokenExpiresAt = Date.now() + expiresIn * 1000 - 60000;

      console.log("✅ MealMe token received");
      return accessToken;

    } catch (err) {
      console.error("❌ TOKEN ERROR STATUS:", err?.response?.status);
      console.error("❌ TOKEN ERROR DATA:", err?.response?.data);
      console.error("❌ TOKEN ERROR MESSAGE:", err.message);
      throw new Error("MealMe authentication failed");

    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

// ===============================
// TOKEN GET
// ===============================
async function getValidToken() {
  if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return accessToken;
  }
  return fetchAccessToken();
}

// ===============================
// REQUEST WRAPPER
// ===============================
async function mealmeRequest(method, url, options = {}) {
  const token = await getValidToken();

  try {
    console.log(`➡️ MealMe Request: ${method} ${url}`);
    if (options.params) console.log("   Params:", options.params);

    const res = await axios({
      method,
      url: `${BASE_URL}${url}`,
      timeout: TIMEOUT,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...options,
    });

    console.log("✅ MealMe Response OK");
    return res.data;

  } catch (err) {
    console.error("❌ REQUEST FAILED");
    console.error("URL:", `${BASE_URL}${url}`);
    console.error("STATUS:", err?.response?.status);
    console.error("DATA:", err?.response?.data);
    console.error("MESSAGE:", err.message);

    throw new Error("MealMe API request failed");
  }
}

// ===============================
// SERVİS FONKSİYONLARI
// ===============================

async function getNearbyRestaurants({ lat, lon, radius = 5 }) {
  if (!lat || !lon) throw new Error("lat and lon are required");

  const data = await mealmeRequest("GET", "/restaurants/search", {
    params: {
      latitude: lat,
      longitude: lon,
      radius,
    },
  });

  return data?.restaurants || [];
}

async function getRestaurantMenu(restaurantId) {
  if (!restaurantId) throw new Error("restaurantId is required");

  const data = await mealmeRequest(
    "GET",
    `/restaurants/${restaurantId}/menu`
  );

  return data?.menu || [];
}

async function searchRestaurants({ query, lat, lon }) {
  if (!query) throw new Error("query is required");

  const data = await mealmeRequest("GET", "/restaurants/search", {
    params: {
      query,
      latitude: lat,
      longitude: lon,
    },
  });

  return data?.restaurants || [];
}

module.exports = {
  getNearbyRestaurantsFromMealMe: getNearbyRestaurants,
  getRestaurantMenuFromMealMe: getRestaurantMenu,
  searchRestaurantsFromMealMe: searchRestaurants,
};

