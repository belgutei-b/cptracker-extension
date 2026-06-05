// CSUI: content script UI
// https://docs.plasmo.com/framework/content-scripts

import cssText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { Resizable } from "re-resizable"
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode
} from "react"
import Draggable, { type DraggableProps } from "react-draggable"

import ComplexityField from "~components/complexity-field"
import FloatingNotesEditor from "~components/floating-notes-editor"
import ProblemTimer from "~components/problem-timer"
import { useProblemTracker } from "~hooks/use-problem-tracker"

const SafeDraggable = Draggable as unknown as ComponentType<
  Partial<DraggableProps> & {
    children: ReactNode
  }
>
const FLOATING_NOTES_STORAGE_PREFIX = "cptracker:floating-notes:"
const DEFAULT_PANEL_WIDTH = 400
const DEFAULT_PANEL_HEIGHT = 360
const MIN_PANEL_WIDTH = 260

function getFloatingNotesStorageKey(url: string): string {
  const parsedUrl = new URL(url)
  return `${FLOATING_NOTES_STORAGE_PREFIX}${parsedUrl.origin}${parsedUrl.pathname}`
}

export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*"]
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `${cssText}
    .cptracker-floating-panel {
      container-type: inline-size;
    }

    .cptracker-floating-complexity-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    @container (max-width: 340px) {
      .cptracker-floating-complexity-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `
  return style
}

/**
 *
 * When extension popup opens, it sends message "CPTRACKER_OPEN_NOTES"
 * After receiving message, it opens the floating note taker
 * @returns
 */
const FloatingNotes = () => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isTimerVisible, setIsTimerVisible] = useState<boolean>(true)
  const storageKey = getFloatingNotesStorageKey(window.location.href)

  const closeFloatingNotes = async () => {
    setIsOpen(false)
    await chrome.storage.local.set({ [storageKey]: false })
  }

  const currentUrl = window.location.href

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
    enabled: true // checks completed in the pop-up
  })

  useEffect(() => {
    ;(async () => {
      const result = await chrome.storage.local.get(storageKey)
      setIsOpen(Boolean(result[storageKey]))
    })()

    const listener = (message: { type?: string }) => {
      if (message.type === "CPTRACKER_OPEN_NOTES") {
        setIsOpen(true)
      }

      if (message.type === "CPTRACKER_CLOSE_NOTES") {
        setIsOpen(false)
      }

      if (message.type === "CPTRACKER_TOGGLE_NOTES") {
        setIsOpen((current) => !current)
      }
    }

    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local" || !changes[storageKey]) {
        return
      }

      setIsOpen(Boolean(changes[storageKey].newValue))
    }

    chrome.runtime.onMessage.addListener(listener)
    chrome.storage.onChanged.addListener(storageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(listener)
      chrome.storage.onChanged.removeListener(storageListener)
    }
  }, [storageKey])

  if (!isOpen) return null

  return (
    <SafeDraggable nodeRef={nodeRef} handle=".cptracker-floating-timer">
      <div
        ref={nodeRef}
        style={{
          left: `calc(100vw - ${DEFAULT_PANEL_WIDTH + 24}px)`,
          top: `calc(100vh - ${DEFAULT_PANEL_HEIGHT + 24}px)`
        }}
        className="plasmo-fixed plasmo-z-[999999] plasmo-text-white">
        <Resizable
          defaultSize={{
            width: DEFAULT_PANEL_WIDTH,
            height: DEFAULT_PANEL_HEIGHT
          }}
          minWidth={MIN_PANEL_WIDTH}
          minHeight={360}
          enable={{
            top: false,
            right: false,
            bottom: false,
            left: false,
            topRight: false,
            bottomRight: true,
            bottomLeft: false,
            topLeft: false
          }}
          handleStyles={{
            bottomRight: {
              right: "0",
              bottom: "0",
              width: "18px",
              height: "18px",
              cursor: "nwse-resize"
            }
          }}
          handleComponent={{
            bottomRight: (
              <div
                style={{
                  position: "absolute",
                  right: "4px",
                  bottom: "4px",
                  width: "10px",
                  height: "10px",
                  borderRight: "2px solid rgba(168, 162, 158, 0.8)",
                  borderBottom: "2px solid rgba(168, 162, 158, 0.8)"
                }}
              />
            )
          }}>
          <div className="cptracker-floating-panel plasmo-flex plasmo-h-full plasmo-w-full plasmo-min-w-[260px] plasmo-flex-col plasmo-overflow-hidden plasmo-bg-[#282828] plasmo-text-white plasmo-shadow-xl">
            <div className="plasmo-flex plasmo-items-stretch plasmo-border-y plasmo-border-[#3e3e3e]">
              <div className="cptracker-floating-timer plasmo-w-[84%] plasmo-cursor-grab plasmo-select-none">
                {isTimerVisible ? (
                  <ProblemTimer
                    elapsedMs={elapsedMs}
                    startedAtMs={startedAtMs}
                    isSolving={isSolving}
                  />
                ) : (
                  <div className="plasmo-flex plasmo-h-full plasmo-min-h-[54px] plasmo-items-center plasmo-justify-center plasmo-font-mono plasmo-text-2xl plasmo-text-[#ffa116]">
                    Timer hidden
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsTimerVisible((current) => !current)}
                className="plasmo-w-[8%] plasmo-border-l plasmo-border-[#3e3e3e] plasmo-text-[11px] plasmo-font-semibold plasmo-text-stone-300 hover:plasmo-bg-white/10 hover:plasmo-text-white">
                {isTimerVisible ? "Hide" : "View"}
              </button>

              <button
                type="button"
                onClick={closeFloatingNotes}
                className="plasmo-w-[8%] plasmo-border-l plasmo-border-[#3e3e3e] plasmo-text-sm plasmo-font-semibold plasmo-text-stone-300 hover:plasmo-bg-white/10 hover:plasmo-text-white">
                X
              </button>
            </div>

            <div className="plasmo-flex-1 plasmo-overflow-auto">
              {problemError ? (
                <div className="plasmo-p-4 plasmo-text-xs">{problemError}</div>
              ) : (
                <div
                  onKeyDownCapture={(event) => event.stopPropagation()}
                  onKeyUpCapture={(event) => event.stopPropagation()}
                  onPointerDownCapture={(event) => event.stopPropagation()}>
                  <div className="plasmo-px-4 plasmo-pt-3 plasmo-pb-0">
                    <div className="cptracker-floating-complexity-grid plasmo-mb-4">
                      <ComplexityField
                        id="floating-time"
                        label="Time complexity"
                        value={problem?.timeComplexity ?? ""}
                        onChange={(value) =>
                          updateDraft({ timeComplexity: value })
                        }
                        placeholder="O(n logn)"
                        textClassName="plasmo-text-gray-200"
                      />

                      <ComplexityField
                        id="floating-space"
                        label="Space Complexity"
                        value={problem?.spaceComplexity ?? ""}
                        onChange={(value) =>
                          updateDraft({ spaceComplexity: value })
                        }
                        placeholder="O(n)"
                      />
                    </div>

                    <FloatingNotesEditor
                      value={problem?.note ?? ""}
                      onChange={(value) => updateDraft({ note: value })}
                    />
                  </div>

                  <div className="plasmo-flex plasmo-items-center plasmo-justify-end plasmo-gap-2 plasmo-border-[#3e3e3e] plasmo-px-4 plasmo-py-2">
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
                    <div className="plasmo-flex plasmo-justify-end plasmo-pr-4 plasmo-pb-2 plasmo-text-xs plasmo-font-medium plasmo-text-red-500">
                      {apiError}
                    </div>
                  )}
                </div>
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
          </div>
        </Resizable>
      </div>
    </SafeDraggable>
  )
}

export default FloatingNotes
