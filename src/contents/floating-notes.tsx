/**
 * Injected JS into the page & enables to have same access as inline js
 */

import styleText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { Resizable } from "re-resizable"
import { useEffect, useRef, useState } from "react"
import Draggable, { type DraggableProps } from "react-draggable"
import type { ProblemStatus, UserProblemFullClient } from "types/problem"
import { ProblemAction, type ProblemActionInput } from "types/problem"
import { type SwResult } from "types/service-worker"

import { sendToBackground } from "@plasmohq/messaging"

import { type SessionData } from "~auth/auth-client"
import type { ActionResponseBody } from "~background/messages/action-problem"
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
const DEFAULT_POPUP_HEIGHT = 460
const MIN_POPUP_WIDTH = 340
const MAX_POPUP_WIDTH = 600
const MIN_POPUP_HEIGHT = 360
const MAX_POPUP_HEIGHT = 700

// Single global layout shared across every LeetCode problem (not per-URL),
// persisted in chrome.storage.local so it survives refreshes.
const LAYOUT_STORAGE_KEY = "floating-note-taker-layout"

type PopupLayout = { width: number; height: number; x: number; y: number }

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

// react-draggable's bundled types mark every prop as required (a defaultProps
// quirk); alias it back to a normal partial-props component.
const DraggablePanel = Draggable as unknown as React.ComponentClass<
  Partial<DraggableProps>
>

// Message sent by the toolbar popup (popup.tsx) when the extension icon is
// pressed, asking this content script to reveal the floating note-taker.
const OPEN_FLOATING_NOTES = "OPEN_FLOATING_NOTES"

// Thin pill handles shown on the resizable (bottom / right) edges.
const resizeHandleStyles = {
  bottom: { height: "14px", bottom: "-7px" },
  right: { width: "14px", right: "-7px" },
  bottomRight: { width: "16px", height: "16px", bottom: "-8px", right: "-8px" }
}
const resizeHandleComponents = {
  bottom: (
    <div
      style={{
        position: "absolute",
        left: "14px",
        right: "14px",
        bottom: "4px",
        height: "2px",
        borderRadius: "9999px",
        backgroundColor: "rgba(120, 113, 108, 0.55)"
      }}
    />
  ),
  right: (
    <div
      style={{
        position: "absolute",
        top: "14px",
        bottom: "14px",
        right: "4px",
        width: "2px",
        borderRadius: "9999px",
        backgroundColor: "rgba(120, 113, 108, 0.55)"
      }}
    />
  )
}

// TODO: write to cache / use onChange on text fields
// TODO: show errors to the client if SW requests fail
export default function FloatingNotes() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [problem, setProblem] = useState<UserProblemFullClient | null>(null)
  const [isMutating, setIsMutating] = useState<boolean>(false)

  // Outer popup size & drag position. Persisted through all problems
  const dragNodeRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({
    width: DEFAULT_POPUP_WIDTH,
    height: DEFAULT_POPUP_HEIGHT
  })
  // The panel is anchored top-left (so it resizes down/right toward the
  // bottom/right handles); start it in the bottom-right corner of the viewport.
  const [position, setPosition] = useState(() => ({
    x: Math.max(20, window.innerWidth - DEFAULT_POPUP_WIDTH - 20),
    y: Math.max(20, window.innerHeight - DEFAULT_POPUP_HEIGHT - 20)
  }))

  // Restore the saved size/position once on mount (before the panel is shown).
  useEffect(() => {
    chrome.storage.local.get(LAYOUT_STORAGE_KEY, (result) => {
      const saved = result?.[LAYOUT_STORAGE_KEY] as Partial<PopupLayout> | undefined
      if (
        !saved ||
        typeof saved.width !== "number" ||
        typeof saved.height !== "number" ||
        typeof saved.x !== "number" ||
        typeof saved.y !== "number"
      ) {
        return
      }

      const width = clamp(saved.width, MIN_POPUP_WIDTH, MAX_POPUP_WIDTH)
      const height = clamp(saved.height, MIN_POPUP_HEIGHT, MAX_POPUP_HEIGHT)

      setSize({ width, height })
      // Clamp into the current viewport so it never restores off-screen.
      setPosition({
        x: clamp(saved.x, 0, Math.max(0, window.innerWidth - width)),
        y: clamp(saved.y, 0, Math.max(0, window.innerHeight - height))
      })
    })
  }, [])

  const persistLayout = (layout: PopupLayout) => {
    void chrome.storage.local.set({ [LAYOUT_STORAGE_KEY]: layout })
  }

  // Hidden until the user presses the extension icon
  const [isOpen, setIsOpen] = useState<boolean>(false)

  // Reveal the note-taker when the toolbar popup tells us the icon was pressed.
  useEffect(() => {
    const handleMessage = (message: { type?: string }) => {
      if (message?.type === OPEN_FLOATING_NOTES) {
        setIsOpen(true)
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  /**
   * Checking user session -> loading problem using SW
  */
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

      console.error("session.success", session.success)
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
   * It expects the SW response to have lastStartedAt field
   * (better handle that in the future)
   */
  async function handleStart() {
    setIsMutating(true)
    try {
      if (!problem) throw new Error("User problem hasn't loaded")

      const res = await sendToBackground<
        { type: ProblemAction; input: ProblemActionInput },
        SwResult<{ success: boolean; body: ActionResponseBody }>
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

      const body = res.data.body
      // lastStartedAt should exist in body | checking to make sure
      // it is in response body
      if (body && "lastStartedAt" in body) {
        setProblem({
          ...problem,
          lastStartedAt: body.lastStartedAt,
          status: "IN_PROGRESS"
        })
      }
    } catch (err) {
      console.error("Error: handleStart function")
    } finally {
      setIsMutating(false)
    }
  }

  /**
   * Updating notes, time & space complexity
   * by calling Service Worker (SW)
   */
  async function handleUpdate() {
    setIsMutating(true)
    try {
      if (!problem) throw new Error("User problem hasn't loaded")

      const res = await sendToBackground<
        { type: ProblemAction; input: ProblemActionInput },
        SwResult<{ success: boolean; body: ActionResponseBody }>
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
    } finally {
      setIsMutating(false)
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
    setIsMutating(true)
    try {
      if (!problem) throw new Error("User problem hasn't loaded")

      // TODO: update SwResult (reference handleStart)
      const res = await sendToBackground<
        { type: ProblemAction; input: ProblemActionInput },
        SwResult<{ success: boolean; body: ActionResponseBody }>
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

      const body = res.data.body
      /* Expecting duration in body in the response of SW */
      if (body && "duration" in body) {
        setProblem({ ...problem, status: newStatus, duration: body.duration })
      }
    } catch (err) {
      console.error("Error: handleFinish function")
    } finally {
      setIsMutating(false)
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

  if (!isOpen) {
    return null
  }

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

  return (
    <DraggablePanel
      nodeRef={dragNodeRef}
      handle=".cp-drag-handle"
      cancel=".cp-no-drag"
      position={position}
      onStop={(_event, data) => {
        setPosition({ x: data.x, y: data.y })
        persistLayout({ ...size, x: data.x, y: data.y })
      }}>
      <div
        ref={dragNodeRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 2147483647
        }}>
        <Resizable
          size={size}
          minWidth={MIN_POPUP_WIDTH}
          maxWidth={MAX_POPUP_WIDTH}
          minHeight={MIN_POPUP_HEIGHT}
          maxHeight={MAX_POPUP_HEIGHT}
          enable={{ bottom: true, right: true, bottomRight: true }}
          onResizeStop={(_event, _direction, ref) => {
            const next = { width: ref.offsetWidth, height: ref.offsetHeight }
            setSize(next)
            persistLayout({ ...next, x: position.x, y: position.y })
          }}
          handleStyles={resizeHandleStyles}
          handleComponent={resizeHandleComponents}
          className="plasmo-overflow-hidden plasmo-rounded-lg plasmo-bg-[#282828] plasmo-text-white plasmo-shadow-xl">
          <div className="plasmo-flex plasmo-h-full plasmo-flex-col">
            <div className="cp-drag-handle plasmo-flex plasmo-flex-none plasmo-cursor-move plasmo-items-stretch">
              <div className="plasmo-basis-[85%] plasmo-min-w-0">
                <ProblemTimer
                  elapsedMs={elapsedMs}
                  startedAtMs={startedAtMs}
                  isSolving={problem.status === "IN_PROGRESS"}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="cp-no-drag plasmo-flex plasmo-basis-[15%] plasmo-items-center plasmo-justify-center plasmo-border-y plasmo-border-l plasmo-border-[#3e3e3e] plasmo-text-lg plasmo-text-stone-400 hover:plasmo-bg-white/10 hover:plasmo-text-white">
                ✕
              </button>
            </div>

            <div className="plasmo-flex plasmo-min-h-0 plasmo-flex-1 plasmo-flex-col plasmo-px-4 plasmo-pt-3">
              <div className="plasmo-mb-4 plasmo-grid plasmo-flex-none plasmo-grid-cols-2 plasmo-gap-4">
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

              <div className="plasmo-min-h-0 plasmo-flex-1">
                <NotesEditor
                  value={problem.note}
                  onChange={(value) => setProblem({ ...problem, note: value })}
                />
              </div>
            </div>

            <div className="plasmo-flex plasmo-flex-none plasmo-items-center plasmo-justify-end plasmo-gap-2 plasmo-border-[#3e3e3e] plasmo-p-4 plasmo-px-4 plasmo-py-2">
              {!(problem.status === "IN_PROGRESS") && (
                <button
                  onClick={handleUpdate}
                  disabled={isMutating}
                  className="popup-btn popup-btn--update">
                  Update notes
                </button>
              )}

              {!(problem.status === "IN_PROGRESS") &&
                problem.status !== "SOLVED" && (
                  <button
                    onClick={handleStart}
                    disabled={isMutating}
                    className="popup-btn popup-btn--start">
                    ▶ Start
                  </button>
                )}

              {problem.status === "IN_PROGRESS" && (
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

            <div className="plasmo-flex-none plasmo-border-t plasmo-border-[#3e3e3e] plasmo-py-2 plasmo-text-center plasmo-text-[11px] plasmo-text-stone-400">
              <a
                href="https://www.cptracker.org"
                target="_blank"
                rel="noreferrer"
                className="hover:plasmo-text-stone-200">
                www.cptracker.org
              </a>
            </div>
          </div>
        </Resizable>
      </div>
    </DraggablePanel>
  )
}
