const axios = require("axios");

const API_KEY = process.env.SPOONACULAR_API_KEY;
const BASE_URL = "https://api.spoonacular.com";

async function searchRecipes(query) {
  if (!API_KEY || !query) {
    return [];
  }

  const res = await axios.get(`${BASE_URL}/recipes/complexSearch`, {
    params: {
      apiKey: API_KEY,
      query,
      number: 20,
      addRecipeInformation: true,
      fillIngredients: true,
    },
    timeout: 15000,
  });

  const results = Array.isArray(res.data?.results) ? res.data.results : [];

  return results.map((recipe) => ({
    label: recipe.title || "Recipe",
    image: recipe.image || null,
    source: "Spoonacular",
    url: recipe.sourceUrl || (recipe.id ? `https://spoonacular.com/recipes/${recipe.id}` : null),
    calories: Math.round(
      recipe.nutrition?.nutrients?.find((n) => n.name === "Calories")?.amount || 0
    ),
    servings: recipe.servings || 1,
    protein: Math.round(
      recipe.nutrition?.nutrients?.find((n) => n.name === "Protein")?.amount || 0
    ),
    fat: Math.round(
      recipe.nutrition?.nutrients?.find((n) => n.name === "Fat")?.amount || 0
    ),
    carbs: Math.round(
      recipe.nutrition?.nutrients?.find((n) => n.name === "Carbohydrates")?.amount || 0
    ),
    ingredients: Array.isArray(recipe.extendedIngredients)
      ? recipe.extendedIngredients.map((item) => item.original)
      : [],
  }));
}

module.exports = {
  searchRecipes,
};
