import { useEffect, useState } from "react"
import { type ProblemStatus, type UserProblemFullClient } from "types/problem"

import { readProblemCache, writeProblemCache } from "~lib/problem-cache"
import {
  fetchProblem,
  finishProblem,
  saveProblem,
  startProblem,
  type FinishProblemStatus
} from "~services/problem-api"

type UseProblemTrackerOptions = {
  currentUrl: string
  enabled: boolean
}

type ProblemDraftPatch = Partial<
  Pick<UserProblemFullClient, "note" | "timeComplexity" | "spaceComplexity">
>

type UseProblemTrackerResult = {
  problem: UserProblemFullClient | null
  status: ProblemStatus
  elapsedMs: number
  startedAtMs: number | null
  isSolving: boolean
  isMutating: boolean
  problemError: string | null
  apiError: string | null
  updateDraft: (patch: ProblemDraftPatch) => void
  start: () => Promise<void>
  finish: (newStatus: FinishProblemStatus) => Promise<void>
  saveNotes: () => Promise<void>
}

export function useProblemTracker({
  currentUrl,
  enabled
}: UseProblemTrackerOptions): UseProblemTrackerResult {
  const [problem, setProblem] = useState<UserProblemFullClient | null>(null)
  const [elapsedMs, setElapsedMs] = useState<number>(0)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [isMutating, setIsMutating] = useState<boolean>(false)
  const [problemError, setProblemError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const status = problem?.status ?? "TODO"
  const isSolving = status === "IN_PROGRESS" && startedAtMs !== null

  function persistDraft(nextProblem: UserProblemFullClient) {
    void writeProblemCache(currentUrl, {
      ...nextProblem
    })
  }

  function hydrateProblemState(nextProblem: UserProblemFullClient) {
    const durationMs = Math.max(0, nextProblem.duration) * 1000
    const nextStatus = nextProblem.status
    const now = Date.now()
    let nextStartedAtMs: number | null = null
    let normalizedProblem = nextProblem

    if (nextStatus === "IN_PROGRESS") {
      const parsedStartedAtMs = nextProblem.lastStartedAt
        ? Date.parse(nextProblem.lastStartedAt)
        : Number.NaN

      if (Number.isFinite(parsedStartedAtMs)) {
        nextStartedAtMs = parsedStartedAtMs
      } else {
        nextStartedAtMs = now
        normalizedProblem = {
          ...nextProblem,
          lastStartedAt: new Date(now).toISOString()
        }
        persistDraft(normalizedProblem)
      }
    }

    setElapsedMs(durationMs)
    setStartedAtMs(nextStartedAtMs)
    setProblem(normalizedProblem)
    setProblemError(null)
  }

  function resetProblemState() {
    setProblem(null)
    setElapsedMs(0)
    setStartedAtMs(null)
    setIsMutating(false)
    setProblemError(null)
    setApiError(null)
  }

  useEffect(() => {
    if (!enabled) {
      resetProblemState()
      return
    }

    let cancelled = false

    void (async () => {
      setProblemError(null)

      const cachedProblem = await readProblemCache(currentUrl)

      if (cancelled) return

      if (cachedProblem) {
        hydrateProblemState(cachedProblem)
        return
      }

      try {
        const fetchedProblem = await fetchProblem(currentUrl)

        if (cancelled) return

        await writeProblemCache(currentUrl, fetchedProblem)

        if (cancelled) return

        hydrateProblemState(fetchedProblem)
      } catch {
        if (cancelled) return

        setProblemError("Failed to load problem data.")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentUrl, enabled])

  // updating text fields (notes, space & time complexity) and problem cache
  function updateDraft(patch: ProblemDraftPatch) {
    setProblem((currentProblem) => {
      if (!currentProblem) return currentProblem

      const nextProblem = {
        ...currentProblem,
        ...patch
      }
      persistDraft(nextProblem)
      return nextProblem
    })
  }

  async function start() {
    if (!problem) return
    if (isSolving) return
    if (isMutating) return

    const prevStartedAtMs = startedAtMs
    const prevProblem = problem

    const now = Date.now()
    const nextProblem: UserProblemFullClient = {
      ...problem,
      status: "IN_PROGRESS",
      lastStartedAt: new Date(now).toISOString()
    }

    setIsMutating(true)
    setProblem(nextProblem)
    setStartedAtMs(now)

    try {
      await startProblem(problem.problemId)
      await writeProblemCache(currentUrl, nextProblem)
      setApiError(null)
    } catch {
      setApiError("Failed to start problem")
      setProblem(prevProblem)
      setStartedAtMs(prevStartedAtMs)
      await writeProblemCache(currentUrl, prevProblem)
    } finally {
      setIsMutating(false)
    }
  }

  async function finish(newStatus: FinishProblemStatus) {
    if (!isSolving || startedAtMs === null) return
    if (!problem) return
    if (isMutating) return

    const prevStartedAtMs = startedAtMs
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

    setProblem(nextProblem)
    setElapsedMs(nextElapsedMs)
    setIsMutating(true)

    try {
      await finishProblem({
        problemId: problem.problemId,
        newStatus,
        note: problem.note,
        timeComplexity: problem.timeComplexity,
        spaceComplexity: problem.spaceComplexity
      })
      await writeProblemCache(currentUrl, nextProblem)
      setApiError(null)
    } catch {
      setApiError("Failed to finish problem")
      setProblem(prevProblem)
      setStartedAtMs(prevStartedAtMs)
      setElapsedMs(prevElapsedMs)
      await writeProblemCache(currentUrl, prevProblem)
    } finally {
      setIsMutating(false)
    }
  }

  async function saveNotes() {
    if (isSolving || !problem || isMutating) return

    const nextProblem: UserProblemFullClient = {
      ...problem,
      status,
      duration: Math.floor(elapsedMs / 1000)
    }

    setIsMutating(true)

    try {
      await saveProblem({
        problemId: problem.problemId,
        note: problem.note,
        timeComplexity: problem.timeComplexity,
        spaceComplexity: problem.spaceComplexity
      })
      await writeProblemCache(currentUrl, nextProblem)
      setApiError(null)
    } catch {
      setApiError("Failed to save notes")
    } finally {
      setIsMutating(false)
    }
  }

  return {
    problem,
    status,
    elapsedMs,
    startedAtMs,
    isSolving,
    isMutating,
    problemError,
    apiError,
    updateDraft,
    start,
    finish,
    saveNotes
  }
}
