function loadEnv() {
  const required = [
    'EDAMAM_APP_ID',
    'EDAMAM_APP_KEY',
    'FATSECRET_CONSUMER_KEY',
    'FATSECRET_CONSUMER_SECRET',
    'GEOAPIFY_API_KEY',
  ];

  const optional = [
    'GOOGLE_MAPS_API_KEY',
    'MEALME_CLIENT_ID',
    'MEALME_CLIENT_SECRET',
    'NUTRITIONIX_APP_ID',
    'NUTRITIONIX_API_KEY',
    'OPENAI_API_KEY',
    'ASSESSPORTAL_USERNAME',
    'ASSESSPORTAL_PASSWORD',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.warn(`Missing required env: ${key}`);
    }
  }

  for (const key of optional) {
    if (!process.env[key]) {
      console.warn(`Missing optional env: ${key}`);
    }
  }

  console.log('Environment loaded successfully');
}

module.exports = { loadEnv };
