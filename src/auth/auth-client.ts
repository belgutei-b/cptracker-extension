import { createAuthClient } from "better-auth/client"

import { APP_BASE_URL } from "~config/base-url"

export const authClient = createAuthClient({
  baseURL: APP_BASE_URL,
  plugins: []
})

// Full session payload returned by better-auth (`{ user, session }` | null)
export type SessionData = Awaited<
  ReturnType<typeof authClient.getSession>
>["data"]
