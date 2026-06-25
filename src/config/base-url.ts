const isDevelopment = process.env.NODE_ENV === "development"

// currently, using cptracker.org as a backend service
// TODO: change to localhost in development before commit
export const APP_BASE_URL = isDevelopment
  ? "https://www.cptracker.org"
  : "https://www.cptracker.org"

// export const APP_BASE_URL = isDevelopment
//   ? "http://localhost:3000"
//   : "https://www.cptracker.org"
