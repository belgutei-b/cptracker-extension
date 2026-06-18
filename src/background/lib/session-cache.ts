import { type SessionData } from "~auth/auth-client"

const SESSION_CACHE_KEY = "session_cache_v2"
const SESSION_CACHE_TTL_MS = 60 * 60 * 1000 // 60 mins

type SessionCacheRecord = {
  data: SessionData
  expiresAtMs: number
}

export async function readSessionCache(): Promise<SessionData | null> {
  try {
    if (!chrome.storage?.session) return null

    const result = await chrome.storage.session.get(SESSION_CACHE_KEY)
    const record = result[SESSION_CACHE_KEY] as SessionCacheRecord | undefined

    if (!record || typeof record.expiresAtMs !== "number") return null
    if (Date.now() > record.expiresAtMs) return null

    return record.data
  } catch (err) {
    console.warn("[get-session] cache read failed, falling back to network", err)
    return null
  }
}

export async function writeSessionCache(data: SessionData): Promise<void> {
  try {
    if (!chrome.storage?.session) return

    await chrome.storage.session.set({
      [SESSION_CACHE_KEY]: {
        data,
        expiresAtMs: Date.now() + SESSION_CACHE_TTL_MS
      } satisfies SessionCacheRecord
    })
  } catch (err) {
    console.warn("[get-session] cache write failed)", err)
  }
}
