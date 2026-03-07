// src/services/exercise.service.js

const cache = require("./exerciseCache");

// Tüm egzersizleri veya filtreli egzersizleri getirir
async function getExercises(query = {}) {
  return cache.getExercises(query);
}

// ID'ye göre tek egzersiz getirir
async function getExerciseById(id) {
  return cache.getExerciseById(id);
}

// İsimle arama yapar
async function searchExercises(q) {
  return cache.searchExercises(q);
}

// Body part listesini döner
async function getBodyParts() {
  return cache.getBodyParts();
}

// Rastgele egzersiz döner
async function getRandomExercise() {
  return cache.getRandomExercise();
}

// Workout önerisi üretir
async function recommendWorkout(payload = {}) {
  return cache.recommendWorkout(payload);
}

module.exports = {
  getExercises,
  getExerciseById,
  searchExercises,
  getBodyParts,
  getRandomExercise,
  recommendWorkout,
};
