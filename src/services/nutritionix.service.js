const axios = require("axios");

const headers = {
  "x-app-id": process.env.NUTRITIONIX_APP_ID,
  "x-app-key": process.env.NUTRITIONIX_API_KEY,
  "Content-Type": "application/json",
};

async function searchFoods(query) {
  const res = await axios.get(
    `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(query)}`,
    { headers }
  );
  return res.data.common || [];
}

async function nlpSearch(text) {
  const res = await axios.post(
    "https://trackapi.nutritionix.com/v2/natural/nutrients",
    { query: text },
    { headers }
  );
  return res.data.foods || [];
}

async function barcodeLookup(code) {
  try {
    const res = await axios.get(
      `https://trackapi.nutritionix.com/v2/search/item?upc=${code}`,
      { headers }
    );
    return res.data.foods || [];
  } catch {
    return [];
  }
}

module.exports = { searchFoods, nlpSearch, barcodeLookup };
