const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");

const CONSUMER_KEY = process.env.FATSECRET_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.FATSECRET_CONSUMER_SECRET;

if (!CONSUMER_KEY || !CONSUMER_SECRET) {
  console.warn("⚠️ FatSecret env variables missing");
}

const oauth = OAuth({
  consumer: {
    key: CONSUMER_KEY,
    secret: CONSUMER_SECRET,
  },
  signature_method: "HMAC-SHA1",
  hash_function(base_string, key) {
    return crypto
      .createHmac("sha1", key)
      .update(base_string)
      .digest("base64");
  },
});

const BASE_URL = "https://platform.fatsecret.com/rest/server.api";

/* ===========================================================
   🔍 Food Search
   =========================================================== */
async function searchFoods(query) {
  try {
    const requestData = {
      url: BASE_URL,
      method: "GET",
      data: {
        method: "foods.search",
        search_expression: query,
        format: "json",
      },
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));

    const res = await axios.get(BASE_URL, {
      params: requestData.data,
      headers: { ...authHeader },
    });

    return res.data?.foods?.food || [];
  } catch (err) {
    console.error(
      "❌ FatSecret search error:",
      err.response?.data || err.message
    );
    throw err;
  }
}

/* ===========================================================
   📋 Food Details
   =========================================================== */
async function getFoodDetails(foodId) {
  try {
    const requestData = {
      url: BASE_URL,
      method: "GET",
      data: {
        method: "food.get.v2",
        food_id: foodId,
        format: "json",
      },
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData));

    const res = await axios.get(BASE_URL, {
      params: requestData.data,
      headers: { ...authHeader },
    });

    return res.data?.food || null;
  } catch (err) {
    console.error(
      "❌ FatSecret details error:",
      err.response?.data || err.message
    );
    throw err;
  }
}

module.exports = {
  searchFoods,
  getFoodDetails,
};
