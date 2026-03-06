const SESSION_CACHE_KEY = "session_cache_v1"
// 60 mins
const SESSION_CACHE_TTL_MS = 60 * 60 * 1000

type SessionCacheRecord<T> = {
  data: T
  expiresAtMs: number
}

export async function readSessionCache<T>(): Promise<T | null> {
  if (!chrome.storage?.session) return null

  const result = await chrome.storage.session.get(SESSION_CACHE_KEY)
  const record = result[SESSION_CACHE_KEY] as SessionCacheRecord<T> | undefined

  if (!record || typeof record.expiresAtMs !== "number") return null
  if (Date.now() > record.expiresAtMs) return null

  return record.data
}

export async function writeSessionCache<T>(data: T): Promise<void> {
  if (!chrome.storage?.session) return

  await chrome.storage.session.set({
    [SESSION_CACHE_KEY]: {
      data,
      expiresAtMs: Date.now() + SESSION_CACHE_TTL_MS
    } satisfies SessionCacheRecord<T>
  })
}
