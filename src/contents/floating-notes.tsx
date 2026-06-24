/**
 * Injected JS into the page & enables to have same access as inline js
 */

import styleText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"
import type { ProblemStatus, UserProblemFullClient } from "types/problem"
import { ProblemAction, type ProblemActionInput } from "types/problem"
import { type SwResult } from "types/service-worker"

import { sendToBackground } from "@plasmohq/messaging"

import { type SessionData } from "~auth/auth-client"
import ComplexityField from "~components/complexity-field"
import NotesEditor from "~components/notes-editor"
import PopupMessage from "~components/popup-message"
import ProblemTimer from "~components/problem-timer"

export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*"]
}

// Inject the compiled Tailwind into the CSUI shadow root.
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}

const DEFAULT_POPUP_WIDTH = 340

export default function FloatingNotes() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [problem, setProblem] = useState<UserProblemFullClient | null>(null)

  const [popupWidth, setPopupWidth] = useState<number>(DEFAULT_POPUP_WIDTH)

  useEffect(() => {
    let cancelled = false

    async function getSession(): Promise<{ success: boolean }> {
      try {
        const res = await sendToBackground<undefined, SwResult<SessionData>>({
          name: "get-session" // file name in /src/background/messages
        })

        if (res.ok) {
          setUserId(res.data?.user?.id ?? null)
          return { success: Boolean(res.data?.user?.id) }
        } else {
          setError(res.error)
        }
      } catch (err) {
        console.error("Error: getSession", err)
        if (!cancelled) setError("Unexpected error occurred")
      }
      return { success: false }
    }

    async function getProblem() {
      try {
        const res = await sendToBackground<
          { url: string },
          SwResult<UserProblemFullClient>
        >({
          name: "get-problem",
          body: {
            url: window.location.href
          }
        })

        if (res.ok) {
          setProblem(res.data)
        } else {
          setError(res.error)
        }
      } catch (err) {
        console.error("Error: getProblem", err)
        if (!cancelled) setError("Unexpected error occurred")
      }
    }

    async function loadUserAndProblem() {
      setLoading(true)

      const session = await getSession()
      if (cancelled) return

      if (session.success) {
        await getProblem()
      }

      if (!cancelled) setLoading(false)
    }

    loadUserAndProblem()

    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Start problem by calling Service Worker (SW).
   * TODO or TRIED -> IN_PROGRESS
   */
  async function handleStart() {
    try {
      if (!problem) throw new Error("User problem hasn't loaded")

      const res = await sendToBackground<
        { type: ProblemAction; input: ProblemActionInput },
        SwResult<UserProblemFullClient>
      >({
        name: "action-problem",
        body: {
          type: ProblemAction.StartAction,
          input: {
            problemId: problem.problemId
          }
        }
      })

      if (!res.ok) {
        throw new Error("Error updating notes")
      }

      setProblem({ ...problem, status: "IN_PROGRESS" })
      // TODO: also update lastStartedAt on problem
      // it is in res
    } catch (err) {
      console.error("Error: handleStart function")
    }
  }

  /**
   * Updating notes, time & space complexity
   * by calling Service Worker (SW)
   */
  async function handleUpdate() {
    try {
      if (!problem) throw new Error("User problem hasn't loaded")

      const res = await sendToBackground<
        { type: ProblemAction; input: ProblemActionInput },
        SwResult<UserProblemFullClient>
      >({
        name: "action-problem",
        body: {
          type: ProblemAction.UpdateAction,
          input: {
            problemId: problem.problemId,
            note: problem.note,
            timeComplexity: problem.timeComplexity,
            spaceComplexity: problem.spaceComplexity
          }
        }
      })

      if (!res.ok) {
        throw new Error("Error updating notes")
      }
    } catch (err) {
      console.error("Error: handleUpdate function")
    }
  }

  /**
   * IN_PROGRESS problem becomes TRIED or SOLVED by
   * calling SW
   * There is no thorough check on problem's current
   * status and newStatus. Backend is responsible for
   * correct status transition.
   * @param newStatus Solved or Tried
   */
  async function handleFinish(newStatus: ProblemStatus) {
    try {
      if (!problem) throw new Error("User problem hasn't loaded")

      const res = await sendToBackground<
        { type: ProblemAction; input: ProblemActionInput },
        SwResult<UserProblemFullClient>
      >({
        name: "action-problem",
        body: {
          type: ProblemAction.FinishAction,
          input: {
            problemId: problem.problemId,
            newStatus,
            note: problem.note,
            timeComplexity: problem.timeComplexity,
            spaceComplexity: problem.spaceComplexity
          }
        }
      })

      if (!res.ok) throw new Error("Error finishing problem")

      setProblem({ ...problem, status: newStatus })
      // TODO: update duration on problem
    } catch (err) {
      console.error("Error: handleFinish function")
    }
  }

  const elapsedMs = (problem?.duration ?? 0) * 1000
  const startedAtMs = problem?.lastStartedAt
    ? Date.parse(problem.lastStartedAt)
    : null

  const shell = (children: React.ReactNode, width?: number) => (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 2147483647,
        width
      }}
      className="plasmo-min-w-[340px] plasmo-overflow-hidden plasmo-rounded-lg plasmo-bg-[#282828] plasmo-text-white plasmo-shadow-xl">
      {children}
    </div>
  )

  if (loading) {
    return shell(<PopupMessage message="Loading..." />)
  }

  if (error) {
    return shell(<PopupMessage message={error} />)
  }

  if (!userId) {
    return shell(
      <PopupMessage message="Sign in at www.cptracker.org to use the tracker." />
    )
  }

  if (!problem) {
    return shell(
      <PopupMessage message="Open a LeetCode problem tab to start tracking." />
    )
  }

  return shell(
    <>
      <ProblemTimer
        elapsedMs={elapsedMs}
        startedAtMs={startedAtMs}
        isSolving={problem.status === "IN_PROGRESS"}
      />

      <div className="plasmo-px-4 plasmo-pt-3 plasmo-pb-0">
        <div className="plasmo-mb-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-4">
          <ComplexityField
            id="time"
            label="Time complexity"
            value={problem.timeComplexity}
            onChange={(value) =>
              setProblem({ ...problem, timeComplexity: value })
            }
            placeholder="O(n logn)"
            textClassName="plasmo-text-gray-200"
          />

          <ComplexityField
            id="space"
            label="Space Complexity"
            value={problem.spaceComplexity}
            onChange={(value) =>
              setProblem({ ...problem, spaceComplexity: value })
            }
            placeholder="O(n)"
          />
        </div>

        <NotesEditor
          value={problem.note}
          onChange={(value) => setProblem({ ...problem, note: value })}
          onPopupWidthChange={setPopupWidth}
        />
      </div>

      <div className="plasmo-flex plasmo-items-center plasmo-justify-end plasmo-gap-2 plasmo-border-[#3e3e3e] plasmo-p-4 plasmo-px-4 plasmo-py-2">
        {!(problem.status === "IN_PROGRESS") && (
          <button
            onClick={handleUpdate}
            className="popup-btn popup-btn--update">
            Update notes
          </button>
        )}

        {!(problem.status === "IN_PROGRESS") && problem.status !== "SOLVED" && (
          <button onClick={handleStart} className="popup-btn popup-btn--start">
            ▶ Start
          </button>
        )}

        {problem.status === "IN_PROGRESS" && (
          <>
            <button
              onClick={() => handleFinish("TRIED")}
              className="popup-btn popup-btn--tried">
              Tried
            </button>
            <button
              onClick={() => handleFinish("SOLVED")}
              className="popup-btn popup-btn--solved">
              Solved
            </button>
          </>
        )}
      </div>

      <div className="plasmo-border-t plasmo-border-[#3e3e3e] plasmo-py-2 plasmo-text-center plasmo-text-[11px] plasmo-text-stone-400">
        <a
          href="https://www.cptracker.org"
          target="_blank"
          rel="noreferrer"
          className="hover:plasmo-text-stone-200">
          www.cptracker.org
        </a>
      </div>
    </>,
    popupWidth
  )
}
