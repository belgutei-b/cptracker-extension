/**
 * Injected JS into the page & enables to have same access as inline js
 */

import styleText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"
import type { ProblemStatus, UserProblemFullClient } from "types/problem"
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

type Draft = {
  note: string
  timeComplexity: string
  spaceComplexity: string
}

const EMPTY_DRAFT: Draft = {
  note: "",
  timeComplexity: "",
  spaceComplexity: ""
}

export default function FloatingNotes() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [problem, setProblem] = useState<UserProblemFullClient | null>(null)

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
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

  // Seed the editable draft from the problem returned by the SW.
  useEffect(() => {
    if (problem) {
      setDraft({
        note: problem.note ?? "",
        timeComplexity: problem.timeComplexity ?? "",
        spaceComplexity: problem.spaceComplexity ?? ""
      })
    }
  }, [problem])

  // Local-only draft update — backend mutations are intentionally skipped for now.
  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((prev) => ({ ...prev, ...patch }))

  const status: ProblemStatus = problem?.status ?? "TODO"
  const isSolving = status === "IN_PROGRESS"
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
        isSolving={isSolving}
      />

      <div className="plasmo-px-4 plasmo-pt-3 plasmo-pb-0">
        <div className="plasmo-mb-4 plasmo-grid plasmo-grid-cols-2 plasmo-gap-4">
          <ComplexityField
            id="time"
            label="Time complexity"
            value={draft.timeComplexity}
            onChange={(value) => updateDraft({ timeComplexity: value })}
            placeholder="O(n logn)"
            textClassName="plasmo-text-gray-200"
          />

          <ComplexityField
            id="space"
            label="Space Complexity"
            value={draft.spaceComplexity}
            onChange={(value) => updateDraft({ spaceComplexity: value })}
            placeholder="O(n)"
          />
        </div>

        <NotesEditor
          value={draft.note}
          onChange={(value) => updateDraft({ note: value })}
          onPopupWidthChange={setPopupWidth}
        />
      </div>

      <div className="plasmo-flex plasmo-items-center plasmo-justify-end plasmo-gap-2 plasmo-border-[#3e3e3e] plasmo-p-4 plasmo-px-4 plasmo-py-2">
        {!isSolving && (
          <button className="popup-btn popup-btn--update">Update notes</button>
        )}

        {!isSolving && status !== "SOLVED" && (
          <button className="popup-btn popup-btn--start">▶ Start</button>
        )}

        {status === "IN_PROGRESS" && (
          <>
            <button className="popup-btn popup-btn--tried">Tried</button>
            <button className="popup-btn popup-btn--solved">Solved</button>
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
