const isDevelopment = process.env.NODE_ENV === "development"

export const APP_BASE_URL = isDevelopment
  ? "http://localhost:3000"
  : "https://cptracker.org"
