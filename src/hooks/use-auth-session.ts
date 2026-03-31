import { useEffect, useState } from "react"

import { authClient } from "~auth/auth-client"
import { readSessionCache, writeSessionCache } from "~lib/session-cache"

type SessionData = ReturnType<typeof authClient.useSession>["data"]

type UseAuthSessionResult = {
  session: SessionData
  isLoading: boolean
  error: string | null
}

export function useAuthSession(): UseAuthSessionResult {
  const [session, setSession] = useState<SessionData>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // is hook still alive
    let cancelled = false

    void (async () => {
      setIsLoading(true)
      setError(null)

      // retrieve the session from the local storage
      const cachedSession = await readSessionCache<SessionData>()

      if (cancelled) return

      if (cachedSession) {
        setSession(cachedSession)
        setIsLoading(false)
        return
      }

      // auth request to the backend
      try {
        const sessionResponse = (await authClient.getSession()) as {
          data: SessionData
          error: unknown
        }

        if (cancelled) return

        setSession(sessionResponse.data)
        setIsLoading(false)

        // write the session to the local storage
        await writeSessionCache(sessionResponse.data)
      } catch {
        if (cancelled) return

        setError("Unexpected Error Occurred")
        setSession(null)
        setIsLoading(false)
      }
    })()

    // clean up / runs after the component unmounts
    return () => {
      cancelled = true
    }
  }, [])

  return {
    session,
    isLoading,
    error
  }
}
