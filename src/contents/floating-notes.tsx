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

const SafeDraggable = Draggable as unknown as ComponentType<
  Partial<DraggableProps> & {
    children: ReactNode
  }
>
const FLOATING_NOTES_STORAGE_PREFIX = "cptracker:floating-notes:"

function getFloatingNotesStorageKey(url: string): string {
  const parsedUrl = new URL(url)
  return `${FLOATING_NOTES_STORAGE_PREFIX}${parsedUrl.origin}${parsedUrl.pathname}`
}

export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*"]
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
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
  const storageKey = getFloatingNotesStorageKey(window.location.href)

  const closeFloatingNotes = async () => {
    setIsOpen(false)
    await chrome.storage.local.set({ [storageKey]: false })
  }

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
    <SafeDraggable nodeRef={nodeRef} handle="strong">
      <div
        ref={nodeRef}
        style={{
          left: "calc(100vw - 344px)",
          top: "calc(100vh - 204px)"
        }}
        className="plasmo-fixed plasmo-z-[999999] plasmo-text-black">
        <Resizable
          defaultSize={{ width: 320, height: 180 }}
          minWidth={240}
          minHeight={140}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "solid 1px #ddd",
            background: "#f0f0f0"
          }}>
          <div className="plasmo-flex plasmo-h-full plasmo-w-full plasmo-flex-col plasmo-overflow-hidden plasmo-rounded-lg plasmo-border plasmo-border-slate-300 plasmo-bg-slate-50 plasmo-shadow-xl">
            <div className="plasmo-flex plasmo-items-center plasmo-bg-slate-200">
              <strong className="plasmo-block plasmo-flex-1 plasmo-cursor-grab plasmo-select-none plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-font-semibold">
                <div>Drag here</div>
              </strong>

              <button
                type="button"
                onClick={closeFloatingNotes}
                className="plasmo-px-3 plasmo-py-2 plasmo-text-sm plasmo-font-semibold">
                X
              </button>
            </div>

            <div className="plasmo-flex-1 plasmo-p-3 plasmo-text-sm">
              You must click my handle to drag me
            </div>
          </div>
        </Resizable>
      </div>
    </SafeDraggable>
  )
}

export default FloatingNotes
