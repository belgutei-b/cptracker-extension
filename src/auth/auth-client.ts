import { createAuthClient } from "better-auth/react"
import { APP_BASE_URL } from "~config/base-url"

export const authClient = createAuthClient({
  baseURL: APP_BASE_URL,
  plugins: []
})
