/**
 * Content script injected on LeetCode problem pages.
 * Floating prompt asking whether to track the problem; "Yes" asks the SW to
 * open the extension popup (see src/background/messages/add-problem.ts).
 */

import styleText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useRef, useState } from "react"
import Draggable, { type DraggableProps } from "react-draggable"
import { type SwResult } from "types/service-worker"

import { sendToBackground } from "@plasmohq/messaging"

import { XIcon } from "~components/icons"

export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*"]
}

// Inject the compiled Tailwind into the CSUI shadow root.
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = styleText
  return style
}

const PROMPT_WIDTH = 300
// Rough height, only used to start the panel in the bottom-right corner.
const PROMPT_HEIGHT = 150

// react-draggable's bundled types mark every prop as required (a defaultProps
// quirk); alias it back to a normal partial-props component.
const DraggablePanel = Draggable as unknown as React.ComponentClass<
  Partial<DraggableProps>
>

export default function AddProblem() {
  const [isOpen, setIsOpen] = useState(true)

  const dragNodeRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(() => ({
    x: Math.max(20, window.innerWidth - PROMPT_WIDTH - 20),
    y: Math.max(20, window.innerHeight - PROMPT_HEIGHT - 20)
  }))

  async function handleSubmit(isAdding: boolean) {
    // hide the prompt right away, whichever button was pressed
    setIsOpen(false)

    if (isAdding) {
      // send message to the sw. which opens the popup
      const res = await sendToBackground<undefined, SwResult<null>>({
        name: "add-problem"
      })
      if (!res.ok) {
        console.error("add-problem failed:", res.error)
      }
    }
  }

  if (!isOpen) return null

  return (
    <DraggablePanel
      nodeRef={dragNodeRef}
      handle=".cp-drag-handle"
      cancel=".cp-no-drag"
      position={position}
      onStop={(_event, data) => setPosition({ x: data.x, y: data.y })}>
      <div
        ref={dragNodeRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 2147483647,
          width: PROMPT_WIDTH
        }}
        className="plasmo-overflow-hidden plasmo-rounded-xl plasmo-border plasmo-border-input plasmo-bg-card plasmo-font-sans plasmo-text-sm plasmo-text-foreground plasmo-shadow-xl">
        <div className="cp-drag-handle plasmo-relative plasmo-cursor-move plasmo-border-b plasmo-border-border plasmo-bg-background plasmo-px-3 plasmo-py-3 plasmo-text-center plasmo-font-medium">
          CPTracker
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
            className="cp-no-drag popup-btn popup-btn--outline popup-btn--icon plasmo-absolute plasmo-right-2.5 plasmo-top-1/2 -plasmo-translate-y-1/2 plasmo-text-muted-foreground hover:plasmo-text-foreground">
            <XIcon className="plasmo-size-3.5" />
          </button>
        </div>

        <div className="plasmo-px-3 plasmo-pt-3 plasmo-text-center">
          Track this problem with CPTracker?
        </div>

        <div className="plasmo-flex plasmo-items-center plasmo-justify-end plasmo-gap-2 plasmo-px-3 plasmo-py-3">
          <button
            onClick={() => handleSubmit(false)}
            className="popup-btn popup-btn--outline">
            No
          </button>
          <button
            onClick={() => handleSubmit(true)}
            className="popup-btn popup-btn--primary">
            Yes
          </button>
        </div>
      </div>
    </DraggablePanel>
  )
}
