const axios = require("axios");

const BASE_URL = process.env.ASSESSPORTAL_BASE_URL || "https://www.assessportal.com";
const USERNAME = process.env.ASSESSPORTAL_USERNAME;
const PASSWORD = process.env.ASSESSPORTAL_PASSWORD;

// Token cache
let accessToken = null;
let refreshToken = null;
let tokenExpiresAt = null;

/**
 * Authenticate and get JWT tokens
 */
async function authenticate() {
  if (!USERNAME || !PASSWORD) {
    throw new Error("Missing ASSESSPORTAL_USERNAME or ASSESSPORTAL_PASSWORD");
  }

  console.log("Requesting AssessPortal access token...");

  const res = await axios.post(
    `${BASE_URL}/api/token/`,
    { username: USERNAME, password: PASSWORD },
    { timeout: 15000, headers: { "Content-Type": "application/json" } }
  );

  accessToken = res.data.access;
  refreshToken = res.data.refresh;
  // Access token lasts 30 minutes, refresh before that
  tokenExpiresAt = Date.now() + 25 * 60 * 1000;

  console.log("AssessPortal token received");
  return accessToken;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken() {
  if (!refreshToken) {
    return authenticate();
  }

  try {
    const res = await axios.post(
      `${BASE_URL}/api/token/refresh/`,
      { refresh: refreshToken },
      { timeout: 15000, headers: { "Content-Type": "application/json" } }
    );

    accessToken = res.data.access;
    tokenExpiresAt = Date.now() + 25 * 60 * 1000;
    return accessToken;
  } catch {
    // Refresh token expired, re-authenticate
    return authenticate();
  }
}

/**
 * Get a valid access token
 */
async function getToken() {
  if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return accessToken;
  }
  if (refreshToken) {
    return refreshAccessToken();
  }
  return authenticate();
}

/**
 * Make an authenticated request to AssessPortal
 */
async function apiRequest(method, url, data = null) {
  const token = await getToken();

  const config = {
    method,
    url: `${BASE_URL}${url}`,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (data) {
    config.data = data;
  }

  const res = await axios(config);
  return res.data;
}

/**
 * Get list of available assessments
 */
async function getAssessments() {
  return apiRequest("GET", "/api/assessments/");
}

/**
 * Get assessment questions by package ID
 */
async function getQuestions(packageId) {
  return apiRequest("GET", `/api/assessments/${packageId}/`);
}

/**
 * Submit assessment responses and get scores
 */
async function submitAssessment({
  packageId,
  languageId,
  clientOrderId,
  subjectId,
  firstName,
  lastName,
  responses,
}) {
  const payload = {
    package_id: packageId || "1001",
    language_id: languageId || "en-UK",
    client_order_id: clientOrderId,
    subject_id: subjectId,
    first_name: firstName,
    last_name: lastName,
    responses: responses.map((r) => ({
      question_id: r.question_id,
      question_value: r.question_value,
    })),
  };

  return apiRequest("POST", "/api/v1/mini-big-5/", payload);
}

module.exports = {
  getAssessments,
  getQuestions,
  submitAssessment,
};
