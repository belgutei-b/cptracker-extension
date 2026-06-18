import { useEffect, useState } from "react"
import { type SwResult } from "types/service-worker"

import { sendToBackground } from "@plasmohq/messaging"

import { type SessionData } from "~auth/auth-client"

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

      try {
        // session (with caching) is resolved entirely in the service worker
        const res = await sendToBackground<undefined, SwResult<SessionData>>({
          name: "get-session"
        })

        if (cancelled) return

        if (res.ok) {
          setSession(res.data)
        } else {
          setError(res.error)
          setSession(null)
        }
      } catch {
        if (cancelled) return

        setError("Unexpected Error Occurred")
        setSession(null)
      } finally {
        if (!cancelled) setIsLoading(false)
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
