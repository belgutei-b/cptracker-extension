import Markdown from "markdown-to-jsx"
import { Resizable, type ResizeCallback } from "re-resizable"
import { Fragment, useEffect, useState } from "react"

type NotesEditorProps = {
  value: string
  onChange: (value: string) => void
  onPopupWidthChange: (width: number) => void
}

type NotesMode = "edit" | "preview"
type StoredDimension = { value: number | null; isInvalid: boolean }

const NOTES_HEIGHT_STORAGE_KEY = "notes-height"
const NOTES_WIDTH_STORAGE_KEY = "notes-width"
const DEFAULT_NOTES_HEIGHT = 150
const MIN_NOTES_HEIGHT = 120
const MAX_NOTES_HEIGHT = 320
const DEFAULT_NOTES_WIDTH = 308
const MIN_NOTES_WIDTH = 308
const MAX_NOTES_WIDTH = 450
const MIN_POPUP_WIDTH = 340
const MARKDOWN_OPTIONS = {
  disableParsingRawHTML: true,
  wrapper: Fragment,
  overrides: {
    a: {
      props: {
        target: "_blank",
        rel: "noreferrer"
      }
    }
  }
}

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

function MarkdownToggle({
  active,
  onToggle
}: {
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? "Back to editor" : "Preview markdown"}
      className={[
        "plasmo-rounded-md",
        "plasmo-border",
        "plasmo-px-1.5",
        "plasmo-py-0.5",
        "plasmo-text-[10px]",
        "plasmo-font-bold",
        "plasmo-tracking-wide",
        "plasmo-transition-all",
        "plasmo-duration-150",
        "popup-btn--start",
        active
          ? "plasmo-border-stone-500 plasmo-bg-stone-700"
          : "plasmo-border-[#3e3e3e] hover:plasmo-border-stone-500"
      ].join(" ")}>
      Markdown
    </button>
  )
}

function NotesEditor({
  value,
  onChange,
  onPopupWidthChange
}: NotesEditorProps) {
  const [mode, setMode] = useState<NotesMode>("edit")
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
  const [notesWidth, setNotesWidth] = useState<number>(
    initialNotesDimensions.width.value ?? DEFAULT_NOTES_WIDTH
  )

  const syncPopupWidth = (nextNotesWidth: number) => {
    onPopupWidthChange(Math.max(MIN_POPUP_WIDTH, nextNotesWidth + 32))
  }

  const syncNotesDimensions = (
    element: HTMLElement,
    shouldPersist: boolean
  ) => {
    const nextHeight = clampDimension(
      element.offsetHeight,
      MIN_NOTES_HEIGHT,
      MAX_NOTES_HEIGHT
    )
    const nextWidth = clampDimension(
      element.offsetWidth,
      MIN_NOTES_WIDTH,
      MAX_NOTES_WIDTH
    )

    setNotesHeight(nextHeight)
    setNotesWidth(nextWidth)

    if (shouldPersist) {
      localStorage.setItem(NOTES_HEIGHT_STORAGE_KEY, String(nextHeight))
      localStorage.setItem(NOTES_WIDTH_STORAGE_KEY, String(nextWidth))
    }
  }

  const handleNotesResizeStop: ResizeCallback = (
    _event,
    _direction,
    elementRef
  ) => {
    syncNotesDimensions(elementRef, true)
  }

  useEffect(() => {
    if (initialNotesDimensions.height.isInvalid) {
      localStorage.removeItem(NOTES_HEIGHT_STORAGE_KEY)
    }

    if (initialNotesDimensions.width.isInvalid) {
      localStorage.removeItem(NOTES_WIDTH_STORAGE_KEY)
    }
  }, [initialNotesDimensions])

  useEffect(() => {
    syncPopupWidth(notesWidth)
  }, [notesWidth, onPopupWidthChange])

  return (
    <>
      <div className="plasmo-mb-1 plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-2">
        <label
          htmlFor="notes"
          className="plasmo-block plasmo-text-xs plasmo-font-semibold plasmo-text-stone-300">
          Notes
        </label>
        <MarkdownToggle
          active={mode === "preview"}
          onToggle={() => setMode(mode === "edit" ? "preview" : "edit")}
        />
      </div>
      <Resizable
        defaultSize={{ width: notesWidth, height: notesHeight }}
        minWidth={MIN_NOTES_WIDTH}
        maxWidth={MAX_NOTES_WIDTH}
        minHeight={MIN_NOTES_HEIGHT}
        maxHeight={MAX_NOTES_HEIGHT}
        enable={{
          top: false,
          right: false,
          bottom: true,
          left: true,
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
          topLeft: false
        }}
        onResizeStop={handleNotesResizeStop}
        handleStyles={{
          left: {
            width: "14px",
            left: "-7px"
          },
          bottom: {
            height: "14px",
            bottom: "-7px"
          }
        }}
        handleComponent={{
          left: (
            <div
              style={{
                position: "absolute",
                top: "14px",
                left: "4px",
                bottom: "14px",
                width: "2px",
                borderRadius: "9999px",
                backgroundColor: "rgba(120, 113, 108, 0.55)"
              }}
            />
          ),
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
          )
        }}
        className="plasmo-ml-auto plasmo-max-w-[450px] plasmo-min-w-[308px] plasmo-min-h-[120px] plasmo-max-h-[320px]">
        {mode === "edit" ? (
          <textarea
            id="notes"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write notes (Markdown is supported)"
            style={{
              width: "100%",
              height: "100%",
              resize: "none"
            }}
            className="plasmo-block plasmo-rounded-xl plasmo-border plasmo-border-[#3e3e3e] plasmo-bg-[#1f1f1f] plasmo-p-2 plasmo-text-xs plasmo-text-gray-200"
          />
        ) : (
          <div className="notes-markdown">
            {value.trim() ? (
              <Markdown options={MARKDOWN_OPTIONS}>{value}</Markdown>
            ) : (
              <p className="plasmo-text-stone-400">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </Resizable>
    </>
  )
}

export default NotesEditor
