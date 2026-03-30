import { useEffect, useRef, useState } from "react"
import { type UserProblemFullClient } from "types/problem"

import { authClient } from "~auth/auth-client"
import ComplexityField from "~components/complexity-field"
import PopupMessage from "~components/popup-message"
import { APP_BASE_URL } from "~config/base-url"
import { readProblemCache, writeProblemCache } from "~lib/problem-cache"
import { readSessionCache, writeSessionCache } from "~lib/session-cache"

// RIGHT NOW

// FUTURE
// TODO: if there is local changes, use service worker to update the db
// TODO: add http://localhost:3000/* to host_permissions in dev

import "~style.css"

type SessionData = ReturnType<typeof authClient.useSession>["data"]
type ProblemStatus = "TODO" | "IN_PROGRESS" | "TRIED" | "SOLVED"
type StoredDimension = { value: number | null; isInvalid: boolean }

const NOTES_HEIGHT_STORAGE_KEY = "notes-height"
const NOTES_WIDTH_STORAGE_KEY = "notes-width"
const DEFAULT_NOTES_HEIGHT = 150
const MIN_NOTES_HEIGHT = 120
const MAX_NOTES_HEIGHT = 320
const DEFAULT_NOTES_WIDTH = 308
const MIN_NOTES_WIDTH = 308
const MAX_NOTES_WIDTH = 450

function readStoredDimension(
  key: string,
  min: number,
  max: number
): StoredDimension {
  const saved = localStorage.getItem(key)
  if (saved === null) {
    return { value: null, isInvalid: false }
  }

  const parsed = Number.parseInt(saved, 10)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { value: min, isInvalid: true }
  }

  return { value: parsed, isInvalid: false }
}

function clampDimension(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatProblemTimer(totalMs: number) {
  const safeMs = Math.max(0, Math.floor(totalMs))
  const safeSeconds = Math.floor(safeMs / 1000)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const centiseconds = Math.floor((safeMs % 1000) / 10)

  const hh = String(hours).padStart(2, "0")
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  const xx = String(centiseconds).padStart(2, "0")

  return { main: `${hh}:${mm}:${ss}`, centiseconds: xx }
}

function IndexPopup() {
  /* auth */
  const [data, setData] = useState<SessionData>(null)
  const [isAuthPending, setIsAuthPending] = useState<boolean>(true)

  const [currentUrl, setCurrentUrl] = useState<string>("")
  const [problem, setProblem] = useState<UserProblemFullClient | null>(null)
  const [status, setStatus] = useState<ProblemStatus>("TODO")
  /* timer */
  const [elapsedMs, setElapsedMs] = useState<number>(0)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [liveNowMs, setLiveNowMs] = useState<number>(Date.now())
  /* To prevent from multiple api request in FINISH/START/SAVE */
  const [isMutating, setIsMutating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const isSolving = status === "IN_PROGRESS" && startedAtMs !== null

  /* notes textarea height persistence */
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [initialNotesDimensions] = useState(() => ({
    height: readStoredDimension(
      NOTES_HEIGHT_STORAGE_KEY,
      MIN_NOTES_HEIGHT,
      MAX_NOTES_HEIGHT
    ),
    width: readStoredDimension(
      NOTES_WIDTH_STORAGE_KEY,
      MIN_NOTES_WIDTH,
      MAX_NOTES_WIDTH
    )
  }))
  const [notesHeight, setNotesHeight] = useState<number>(
    initialNotesDimensions.height.value ?? DEFAULT_NOTES_HEIGHT
  )

  /* notes textarea width persistence */
  const [notesWidth, setNotesWidth] = useState<number>(
    initialNotesDimensions.width.value ?? DEFAULT_NOTES_WIDTH
  )
  const hasExpandedNotesWidth = notesWidth > DEFAULT_NOTES_WIDTH

  const getCurrentTabUrl = async (): Promise<string> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab?.url || ""
  }

  const isLeetCodeProblem = currentUrl.startsWith(
    "https://leetcode.com/problems/"
  )

  async function loadProblem(
    problem: UserProblemFullClient | null,
    url: string
  ) {
    let fetchedProblem = problem
    if (!fetchedProblem) {
      try {
        const res = await fetch(`${APP_BASE_URL}/api/extension/problems`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemLink: url })
        })

        if (!res.ok) {
          setError("Failed to load problem data.")
          return
        }

        const body = (await res.json()) as { problem: UserProblemFullClient }
        fetchedProblem = body.problem
        await writeProblemCache(url, fetchedProblem)
      } catch {
        setError("Failed to load problem data.")
        return
      }
    }

    if (!fetchedProblem) return

    const durationSeconds = Math.max(0, fetchedProblem.duration)
    const durationMs = durationSeconds * 1000
    const statusFromApi = fetchedProblem.status as ProblemStatus
    const now = new Date()
    let fetchedStartedAtMs = null

    if (statusFromApi === "IN_PROGRESS") {
      if (fetchedProblem.lastStartedAt) {
        fetchedStartedAtMs = Date.parse(fetchedProblem.lastStartedAt)
      }

      if (Number.isFinite(fetchedStartedAtMs)) {
        setStartedAtMs(fetchedStartedAtMs)
      } else {
        // fallback (invalid lastStartedAt)
        setStartedAtMs(now.getTime())
        persistDraft({
          ...fetchedProblem,
          lastStartedAt: now.toISOString()
        })
      }
    }

    setStatus(statusFromApi)
    setElapsedMs(durationMs)
    setLiveNowMs(now.getTime())
    setProblem(fetchedProblem)
  }

  async function handleStart() {
    if (!problem) return
    if (isSolving) return
    if (isMutating) return

    // for rollback
    const prevStatus = status
    const prevStartedAtMs = startedAtMs
    const prevLiveNowMs = liveNowMs
    const prevProblem = problem

    // optimistic update
    const now = Date.now()
    const nextProblem: UserProblemFullClient = {
      ...problem,
      status: "IN_PROGRESS",
      lastStartedAt: new Date(now).toISOString()
    }
    setIsMutating(true)
    setProblem(nextProblem)
    setStatus("IN_PROGRESS")
    setStartedAtMs(now)
    setLiveNowMs(now)

    try {
      const res = await fetch(
        `${APP_BASE_URL}/api/extension/problems/${problem.problemId}/start`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" }
        }
      )

      if (!res.ok) {
        throw new Error("Error updating problem")
      }

      await writeProblemCache(currentUrl, nextProblem)
      setApiError(null)
    } catch (err) {
      console.log(err)
      setApiError("Failed to start problem")
      // rollback
      setProblem(prevProblem)
      setStatus(prevStatus)
      setStartedAtMs(prevStartedAtMs)
      setLiveNowMs(prevLiveNowMs)
      await writeProblemCache(currentUrl, prevProblem)
    } finally {
      setIsMutating(false)
    }
  }

  async function handleFinish(newStatus: "TRIED" | "SOLVED") {
    if (!isSolving || startedAtMs === null) return
    if (!problem) return
    if (isMutating) return

    const prevStatus = status
    const prevStartedAtMs = startedAtMs
    const prevLiveNowMs = liveNowMs
    const prevElapsedMs = elapsedMs
    const prevProblem = problem

    const now = Date.now()
    const elapsedDeltaMs = Math.max(0, now - startedAtMs)
    const nextElapsedMs = prevElapsedMs + elapsedDeltaMs
    const nextProblem: UserProblemFullClient = {
      ...problem,
      status: newStatus,
      duration: Math.floor(nextElapsedMs / 1000),
      triedAt:
        newStatus === "TRIED" ? new Date(now).toISOString() : problem.triedAt,
      solvedAt:
        newStatus === "SOLVED" ? new Date(now).toISOString() : problem.solvedAt
    }

    // optimistic update
    setProblem(nextProblem)
    setElapsedMs(nextElapsedMs)
    setLiveNowMs(now)
    setStatus(newStatus)
    setIsMutating(true)

    try {
      const res = await fetch(
        `${APP_BASE_URL}/api/extension/problems/${problem.problemId}/finish`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newStatus,
            note: problem.note,
            timeComplexity: problem.timeComplexity,
            spaceComplexity: problem.spaceComplexity
          })
        }
      )

      if (!res.ok) {
        throw new Error("Error finishing problem")
      }

      await writeProblemCache(currentUrl, nextProblem)
      setApiError(null)
    } catch {
      setApiError("Failed to finish problem")
      // rollback
      setProblem(prevProblem)
      setStatus(prevStatus)
      setStartedAtMs(prevStartedAtMs)
      setLiveNowMs(prevLiveNowMs)
      setElapsedMs(prevElapsedMs)
      await writeProblemCache(currentUrl, prevProblem)
    } finally {
      setIsMutating(false)
    }
  }

  async function handleSaveNotes() {
    if (isSolving || !problem || isMutating) return

    // optimistic update
    const nextProblem: UserProblemFullClient = {
      ...problem,
      status,
      duration: Math.floor(elapsedMs / 1000)
    }

    setIsMutating(true)
    try {
      const res = await fetch(
        `${APP_BASE_URL}/api/extension/problems/${problem.problemId}/save`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: problem.note,
            timeComplexity: problem.timeComplexity,
            spaceComplexity: problem.spaceComplexity
          })
        }
      )

      if (!res.ok) {
        throw new Error("Error saving notes")
      }

      await writeProblemCache(currentUrl, nextProblem)
      setApiError(null)
    } catch (err) {
      setApiError("Failed to save notes")
    } finally {
      setIsMutating(false)
    }
  }

  function persistDraft(nextProblem: UserProblemFullClient) {
    void writeProblemCache(currentUrl, {
      ...nextProblem
    })
  }

  // read the active tab URL once when the popup mounts.
  useEffect(() => {
    ;(async () => {
      const url = await getCurrentTabUrl()
      setCurrentUrl(url)
      setProblem(null)
    })()
  }, [])

  // auth session | 1st check session cache | fall back to api call
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setIsAuthPending(true)
      setError(null)

      const cachedSession = await readSessionCache<SessionData>()

      if (cancelled) return

      if (cachedSession) {
        setData(cachedSession)
        setIsAuthPending(false)
        return
      }

      try {
        const sessionResponse = (await authClient.getSession()) as {
          data: SessionData
          error: unknown
        }

        if (cancelled) return

        setData(sessionResponse.data)
        setIsAuthPending(false)

        await writeSessionCache(sessionResponse.data)
      } catch {
        if (cancelled) return

        setError("Unexpected Error Occurred")
        setData(null)
        setIsAuthPending(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // fetch problem from cache or backend
  useEffect(() => {
    if (!data || !isLeetCodeProblem) return
    void (async () => {
      const cachedProblem = await readProblemCache(currentUrl)
      await loadProblem(cachedProblem, currentUrl)
    })()
  }, [currentUrl, data, isLeetCodeProblem])

  // persist textarea height and width on resize
  useEffect(() => {
    if (initialNotesDimensions.height.isInvalid) {
      localStorage.removeItem(NOTES_HEIGHT_STORAGE_KEY)
    }

    if (initialNotesDimensions.width.isInvalid) {
      localStorage.removeItem(NOTES_WIDTH_STORAGE_KEY)
    }
  }, [initialNotesDimensions])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const nextHeight = clampDimension(
        el.offsetHeight,
        MIN_NOTES_HEIGHT,
        MAX_NOTES_HEIGHT
      )
      const nextWidth = clampDimension(
        el.offsetWidth,
        MIN_NOTES_WIDTH,
        MAX_NOTES_WIDTH
      )

      localStorage.setItem(NOTES_HEIGHT_STORAGE_KEY, String(nextHeight))
      localStorage.setItem(NOTES_WIDTH_STORAGE_KEY, String(nextWidth))
      setNotesHeight(nextHeight)
      setNotesWidth(nextWidth)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [problem])

  // update the timer while solving
  useEffect(() => {
    if (!isSolving) return

    const intervalId = window.setInterval(() => {
      setLiveNowMs(Date.now())
    }, 50)

    return () => window.clearInterval(intervalId)
  }, [isSolving])

  const displayedMs =
    elapsedMs +
    (isSolving && startedAtMs !== null
      ? Math.max(0, liveNowMs - startedAtMs)
      : 0)
  const formattedTimer = formatProblemTimer(displayedMs)

  if (isAuthPending) {
    return <PopupMessage message="Loading..." />
  }

  // Unauthenticated User
  if (!data) {
    return (
      <PopupMessage message="Sign in at www.cptracker.org to use the tracker." />
    )
  }

  if (!isLeetCodeProblem) {
    return (
      <PopupMessage message="Open a LeetCode problem tab to start tracking." />
    )
  }

  if (error) {
    return <PopupMessage message={error} />
  }

  return (
    <div
      className={`${hasExpandedNotesWidth ? "plasmo-min-w-[340px]" : "plasmo-w-[340px]"} plasmo-bg-[#282828] plasmo-text-white plasmo-shadow-xl`}>
      <div className="plasmo-flex plasmo-w-full plasmo-justify-center plasmo-border-y plasmo-border-[#3e3e3e] plasmo-py-3 plasmo-text-[#ffa116]">
        <span className="plasmo-font-mono plasmo-text-2xl">
          {formattedTimer.main}
          <span className="plasmo-text-lg">.{formattedTimer.centiseconds}</span>
        </span>
      </div>

      <div className="plasmo-px-4 plasmo-pt-3 plasmo-pb-0">
        <div className="plasmo-mb-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-4">
          <ComplexityField
            id="time"
            label="Time complexity"
            value={problem?.timeComplexity ?? ""}
            onChange={(value) => {
              if (!problem) return
              const next = { ...problem, timeComplexity: value }
              setProblem(next)
              persistDraft(next)
            }}
            placeholder="O(n logn)"
            textClassName="plasmo-text-gray-200"
          />

          <ComplexityField
            id="space"
            label="Space Complexity"
            value={problem?.spaceComplexity ?? ""}
            onChange={(value) => {
              if (!problem) return
              const next = { ...problem, spaceComplexity: value }
              setProblem(next)
              persistDraft(next)
            }}
            placeholder="O(n)"
          />
        </div>

        <label
          htmlFor="notes"
          className="plasmo-mb-1 plasmo-block plasmo-text-xs plasmo-font-semibold plasmo-text-stone-300">
          Notes
        </label>
        <textarea
          ref={textareaRef}
          id="notes"
          value={problem?.note ?? ""}
          onChange={(e) => {
            if (!problem) return
            const next = { ...problem, note: e.target.value }
            setProblem(next)
            persistDraft(next)
          }}
          style={{
            height: notesHeight,
            width: notesWidth,
            resize: "both"
          }}
          className="plasmo-rounded-xl plasmo-border plasmo-border-[#3e3e3e] plasmo-bg-[#1f1f1f] plasmo-p-2 plasmo-text-xs plasmo-text-gray-200 plasmo-max-w-[450px] plasmo-min-w-[308px] plasmo-min-h-[120px] plasmo-max-h-[320px]"
        />
      </div>

      <div className="plasmo-flex plasmo-items-center plasmo-justify-end plasmo-gap-2 plasmo-border-[#3e3e3e] plasmo-p-4 plasmo-px-4 plasmo-py-2">
        {!isSolving && (
          <button
            onClick={handleSaveNotes}
            disabled={isMutating}
            className="popup-btn popup-btn--update">
            Update notes
          </button>
        )}

        {!isSolving && status !== "SOLVED" && (
          <button
            onClick={handleStart}
            disabled={isMutating}
            className="popup-btn popup-btn--start">
            ▶ Start
          </button>
        )}

        {status === "IN_PROGRESS" && (
          <>
            <button
              onClick={() => handleFinish("TRIED")}
              disabled={isMutating}
              className="popup-btn popup-btn--tried">
              Tried
            </button>
            <button
              onClick={() => handleFinish("SOLVED")}
              disabled={isMutating}
              className="popup-btn popup-btn--solved">
              Solved
            </button>
          </>
        )}
      </div>
      {apiError && (
        <div className="plasmo-flex plasmo-justify-end plasmo-pr-4 plasmo-pb-2 plasmo-text-red-500 plasmo-text-xs plasmo-font-medium">
          {apiError}
        </div>
      )}

      <div className="plasmo-border-t plasmo-border-[#3e3e3e] plasmo-py-2 plasmo-text-center plasmo-text-[11px] plasmo-text-stone-400">
        <a
          href="https://www.cptracker.org"
          target="_blank"
          rel="noreferrer"
          className="hover:plasmo-text-stone-200">
          www.cptracker.org
        </a>
      </div>
    </div>
  )
}

export default IndexPopup
