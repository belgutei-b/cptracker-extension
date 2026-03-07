import {
  type SessionProblemRecord,
  type UserProblemFullClient
} from "types/problem"

// 60 mins
const SESSION_CACHE_TTL_MS = 60 * 60 * 1000

function getProblemCacheKey(currentUrl: string): string | null {
  if (!currentUrl.startsWith("https://leetcode.com/problems")) {
    return null
  }
  const problemTitle = currentUrl.split("/")[4]

  return `https://leetcode.com/problems/${problemTitle}`
}

export async function readProblemCache(
  currentUrl: string
): Promise<UserProblemFullClient | null> {
  const cacheKey = getProblemCacheKey(currentUrl)
  if (!cacheKey) return null
  if (!chrome.storage?.session) return null

  /* retrieve */
  const result = await chrome.storage.session.get(cacheKey)
  const record = result[cacheKey] as SessionProblemRecord | undefined

  /* record expired */
  if (!record || typeof record.expiresAt !== "number") return null
  if (Date.now() > record.expiresAt) {
    await chrome.storage.session.remove(cacheKey)
    return null
  }

  return record.problem
}

export async function writeProblemCache(
  currentUrl: string,
  problem: UserProblemFullClient
) {
  const cacheKey = getProblemCacheKey(currentUrl)
  if (!cacheKey) return
  if (!chrome.storage?.session) return

  await chrome.storage.session.set({
    [cacheKey]: {
      problem,
      expiresAt: Date.now() + SESSION_CACHE_TTL_MS
    } satisfies SessionProblemRecord
  })
}
