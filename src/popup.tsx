import { useEffect, useState } from "react"

import { authClient } from "~auth/auth-client"

import "~style.css"

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
  const { data, isPending, error } = authClient.useSession()
  const [currentUrl, setCurrentUrl] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [timeComplexity, setTimeComplexity] = useState<string>("")
  const [spaceComplexity, setSpaceComplexity] = useState<string>("")
  const [status, setStatus] = useState<string>("")
  const [elapsedMs, setElapsedMs] = useState<number>(0)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [liveNowMs, setLiveNowMs] = useState<number>(Date.now())
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [fetched, setFetched] = useState<boolean>(false)
  const [problem, setProblem] = useState<UserProblemFullClient | null>(null)
  const isSolving = status === "IN_PROGRESS" && startedAtMs !== null

  const getCurrentTabUrl = async (): Promise<string> => {
    // TODO: add "tabs" permission in the manifest
    // TODO: change the permission to only run in leetcode.com
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab?.url || ""
  }

  async function postProblem(url: string) {
    const res = await fetch("http://localhost:3000/api/extension/problems", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemLink: url })
    })

    if (res.ok) {
      const body = (await res.json()) as {
        problem: UserProblemFullClient
      }

      setNote(body.problem.note)
      setTimeComplexity(body.problem.timeComplexity)
      setSpaceComplexity(body.problem.spaceComplexity)
      setStatus(body.problem.status)
      setElapsedMs(Math.max(0, body.problem.duration) * 1000)
      setProblem(body.problem)
      setFetched(true)
    } else {
      // TODO: error handling
    }
    console.log(res.ok)
  }

  async function handleStart() {
    if (!fetched || !problem) return
    if (isSolving) return
    const res = await fetch(
      `http://localhost:3000/api/extension/problems/${problem.problemId}/start`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      }
    )

    if (res.ok) {
      const now = Date.now()
      setStatus("IN_PROGRESS")
      setStartedAtMs(now)
      setLiveNowMs(now)
    } else {
      // todo: handle error case
    }
  }

  async function handleFinish(newStatus: "TRIED" | "SOLVED") {
    if (!isSolving || startedAtMs === null) return
    if (!fetched || !problem) return

    const res = await fetch(
      `http://localhost:3000/api/extension/problems/${problem.problemId}/finish`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStatus,
          note,
          timeComplexity,
          spaceComplexity
        })
      }
    )

    if (res.ok) {
      const now = Date.now()
      setElapsedMs((prev) => prev + Math.max(0, now - startedAtMs))
      setStartedAtMs(null)
      setLiveNowMs(now)
      setStatus(newStatus)
    } else {
      // todo: handle error case
    }
  }

  async function handleSaveNotes() {
    if (isSolving || !fetched || !problem || isSaving) return

    setIsSaving(true)
    try {
      const res = await fetch(
        `http://localhost:3000/api/extension/problems/${problem.problemId}/save`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note,
            timeComplexity,
            spaceComplexity
          })
        }
      )

      if (!res.ok) {
        // todo: handle error case
      }
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const url = await getCurrentTabUrl()
      setCurrentUrl(url)
      setFetched(false)
    })()
  }, [])

  const isLeetCodeProblem = currentUrl.startsWith(
    "https://leetcode.com/problems/"
  )

  useEffect(() => {
    if (!data || !isLeetCodeProblem || fetched) return

    void postProblem(currentUrl)
  }, [currentUrl, data, fetched, isLeetCodeProblem])

  useEffect(() => {
    if (!isSolving) return

    const intervalId = window.setInterval(() => {
      setLiveNowMs(Date.now())
    }, 10)

    return () => window.clearInterval(intervalId)
  }, [isSolving])

  const displayedMs =
    elapsedMs +
    (isSolving && startedAtMs !== null
      ? Math.max(0, liveNowMs - startedAtMs)
      : 0)
  const formattedTimer = formatProblemTimer(displayedMs)

  if (isPending) {
    return <div className="plasmo-p-4 plasmo-text-sm">Loading...</div>
  }

  if (error) {
    // todo: better error ui
    return (
      <div className="plasmo-p-4 plasmo-text-sm">Error: {error.message}</div>
    )
  }

  // Unauthenticated User
  if (!data) {
    return (
      <div className="plasmo-p-4 plasmo-text-sm">
        Sign in at www.cptracker.org to use the tracker.
      </div>
    )
  }

  if (!isLeetCodeProblem) {
    return (
      <div className="plasmo-p-4 plasmo-text-sm">
        Open a LeetCode problem tab to start tracking.
      </div>
    )
  }

  return (
    <div className="plasmo-w-[360px] plasmo-rounded-2xl plasmo-border plasmo-border-[#3e3e3e] plasmo-bg-[#282828] plasmo-text-white plasmo-shadow-xl">
      <div className="plasmo-flex plasmo-w-full plasmo-justify-center plasmo-border-y plasmo-border-[#3e3e3e] plasmo-py-3 plasmo-text-[#ffa116]">
        <span className="plasmo-font-mono plasmo-text-4xl">
          {formattedTimer.main}
          <span className="plasmo-text-xl">.{formattedTimer.centiseconds}</span>
        </span>
      </div>

      <div className="plasmo-p-4">
        <div className="plasmo-mb-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-3">
          <div>
            <label
              htmlFor="time"
              className="plasmo-mb-1 plasmo-block plasmo-text-xs plasmo-font-semibold plasmo-text-stone-300">
              Time Complexity
            </label>
            <input
              id="time"
              type="text"
              value={timeComplexity}
              onChange={(e) => setTimeComplexity(e.target.value)}
              placeholder="O(n log n)"
              className="plasmo-w-full plasmo-rounded-lg plasmo-border plasmo-border-[#3e3e3e] plasmo-bg-[#1f1f1f] plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-gray-200 placeholder:plasmo-text-stone-600"
            />
          </div>

          <div>
            <label
              htmlFor="space"
              className="plasmo-mb-1 plasmo-block plasmo-text-xs plasmo-font-semibold plasmo-text-stone-300">
              Space Complexity
            </label>
            <input
              id="space"
              type="text"
              value={spaceComplexity}
              onChange={(e) => setSpaceComplexity(e.target.value)}
              placeholder="O(1)"
              className="plasmo-w-full plasmo-rounded-lg plasmo-border plasmo-border-[#3e3e3e] plasmo-bg-[#1f1f1f] plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-stone-200 placeholder:plasmo-text-stone-600"
            />
          </div>
        </div>

        <label
          htmlFor="notes"
          className="plasmo-mb-1 plasmo-block plasmo-text-xs plasmo-font-semibold plasmo-text-stone-300">
          Notes
        </label>
        <textarea
          id="notes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="plasmo-h-32 plasmo-w-full plasmo-rounded-xl plasmo-border plasmo-border-[#3e3e3e] plasmo-bg-[#1f1f1f] plasmo-p-2 plasmo-text-xs plasmo-text-gray-200"
        />
      </div>

      <div className="plasmo-flex plasmo-items-center plasmo-justify-end plasmo-gap-2 plasmo-border-t plasmo-border-[#3e3e3e] plasmo-p-4">
        {!isSolving && (
          <button
            onClick={handleSaveNotes}
            disabled={!fetched || !problem || isSaving}
            className="plasmo-rounded-lg plasmo-border plasmo-border-[#3e3e3e] plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-sky-300 hover:plasmo-bg-white/10 disabled:plasmo-cursor-not-allowed disabled:plasmo-opacity-50">
            {isSaving ? "Updating..." : "Update notes"}
          </button>
        )}

        {!isSolving && status !== "SOLVED" && (
          <button
            onClick={handleStart}
            className="plasmo-rounded-lg plasmo-border plasmo-border-[#3e3e3e] plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-[#ffa116] hover:plasmo-bg-white/10">
            ▶ Start
          </button>
        )}

        {status === "IN_PROGRESS" && (
          <>
            <button
              onClick={() => handleFinish("TRIED")}
              className="plasmo-rounded-lg plasmo-border plasmo-border-[#3e3e3e] plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-red-400 hover:plasmo-bg-white/10">
              Tried
            </button>
            <button
              onClick={() => handleFinish("SOLVED")}
              className="plasmo-rounded-lg plasmo-border plasmo-border-[#3e3e3e] plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-text-emerald-400 hover:plasmo-bg-white/10">
              Solved
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default IndexPopup
