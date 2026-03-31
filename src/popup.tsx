import { useEffect, useState } from "react"

import ComplexityField from "~components/complexity-field"
import NotesEditor from "~components/notes-editor"
import PopupMessage from "~components/popup-message"
import ProblemTimer from "~components/problem-timer"
import { useAuthSession } from "~hooks/use-auth-session"
import { useProblemTracker } from "~hooks/use-problem-tracker"

// RIGHT NOW

// FUTURE
// TODO: if there is local changes, use service worker to update the db
// TODO: add http://localhost:3000/* to host_permissions in dev

import "~style.css"

const DEFAULT_POPUP_WIDTH = 340

function IndexPopup() {
  const {
    session,
    isLoading: isAuthPending,
    error: authError
  } = useAuthSession()

  const [currentUrl, setCurrentUrl] = useState<string>("")
  const [popupWidth, setPopupWidth] = useState<number>(DEFAULT_POPUP_WIDTH)

  const getCurrentTabUrl = async (): Promise<string> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab?.url || ""
  }

  const isLeetCodeProblem = currentUrl.startsWith(
    "https://leetcode.com/problems/"
  )
  const {
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
  } = useProblemTracker({
    currentUrl,
    enabled: Boolean(session) && isLeetCodeProblem
  })

  // read the active tab URL once when the popup mounts.
  useEffect(() => {
    ;(async () => {
      const url = await getCurrentTabUrl()
      setCurrentUrl(url)
    })()
  }, [])

  if (isAuthPending) {
    return <PopupMessage message="Loading..." />
  }

  if (authError) {
    return <PopupMessage message={authError} />
  }

  // Unauthenticated User
  if (!session) {
    return (
      <PopupMessage message="Sign in at www.cptracker.org to use the tracker." />
    )
  }

  if (!isLeetCodeProblem) {
    return (
      <PopupMessage message="Open a LeetCode problem tab to start tracking." />
    )
  }

  if (problemError) {
    return <PopupMessage message={problemError} />
  }

  return (
    <div
      style={{ width: popupWidth }}
      className="plasmo-min-w-[340px] plasmo-bg-[#282828] plasmo-text-white plasmo-shadow-xl">
      <ProblemTimer
        elapsedMs={elapsedMs}
        startedAtMs={startedAtMs}
        isSolving={isSolving}
      />

      <div className="plasmo-px-4 plasmo-pt-3 plasmo-pb-0">
        <div className="plasmo-mb-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-4">
          <ComplexityField
            id="time"
            label="Time complexity"
            value={problem?.timeComplexity ?? ""}
            onChange={(value) => updateDraft({ timeComplexity: value })}
            placeholder="O(n logn)"
            textClassName="plasmo-text-gray-200"
          />

          <ComplexityField
            id="space"
            label="Space Complexity"
            value={problem?.spaceComplexity ?? ""}
            onChange={(value) => updateDraft({ spaceComplexity: value })}
            placeholder="O(n)"
          />
        </div>

        <NotesEditor
          value={problem?.note ?? ""}
          onChange={(value) => updateDraft({ note: value })}
          onPopupWidthChange={setPopupWidth}
        />
      </div>

      <div className="plasmo-flex plasmo-items-center plasmo-justify-end plasmo-gap-2 plasmo-border-[#3e3e3e] plasmo-p-4 plasmo-px-4 plasmo-py-2">
        {!isSolving && (
          <button
            onClick={saveNotes}
            disabled={isMutating}
            className="popup-btn popup-btn--update">
            Update notes
          </button>
        )}

        {!isSolving && status !== "SOLVED" && (
          <button
            onClick={start}
            disabled={isMutating}
            className="popup-btn popup-btn--start">
            ▶ Start
          </button>
        )}

        {status === "IN_PROGRESS" && (
          <>
            <button
              onClick={() => finish("TRIED")}
              disabled={isMutating}
              className="popup-btn popup-btn--tried">
              Tried
            </button>
            <button
              onClick={() => finish("SOLVED")}
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
