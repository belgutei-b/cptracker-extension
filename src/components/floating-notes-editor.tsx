import Markdown from "markdown-to-jsx"
import { Fragment, useState, type KeyboardEvent, type PointerEvent } from "react"

type FloatingNotesEditorProps = {
  value: string
  onChange: (value: string) => void
}

type NotesMode = "edit" | "preview"

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

function FloatingNotesEditor({ value, onChange }: FloatingNotesEditorProps) {
  const [mode, setMode] = useState<NotesMode>("edit")
  const stopKeyboardPropagation = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
  }
  const stopPointerPropagation = (event: PointerEvent<HTMLTextAreaElement>) => {
    event.stopPropagation()
  }

  return (
    <div className="plasmo-flex plasmo-min-h-[160px] plasmo-flex-col">
      <div className="plasmo-mb-1 plasmo-flex plasmo-items-center plasmo-justify-between plasmo-gap-2">
        <label
          htmlFor="floating-notes"
          className="plasmo-block plasmo-text-xs plasmo-font-semibold plasmo-text-stone-300">
          Notes
        </label>
        <MarkdownToggle
          active={mode === "preview"}
          onToggle={() => setMode(mode === "edit" ? "preview" : "edit")}
        />
      </div>

      {mode === "edit" ? (
        <textarea
          id="floating-notes"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={stopKeyboardPropagation}
          onKeyUp={stopKeyboardPropagation}
          onPointerDown={stopPointerPropagation}
          onPointerMove={stopPointerPropagation}
          onPointerUp={stopPointerPropagation}
          placeholder="Write notes (Markdown is supported)"
          className="plasmo-block plasmo-min-h-[160px] plasmo-w-full plasmo-flex-1 plasmo-resize-none plasmo-rounded-xl plasmo-border plasmo-border-[#3e3e3e] plasmo-bg-[#1f1f1f] plasmo-p-2 plasmo-text-xs plasmo-text-gray-200"
        />
      ) : (
        <div className="notes-markdown plasmo-min-h-[160px] plasmo-flex-1">
          {value.trim() ? (
            <Markdown options={MARKDOWN_OPTIONS}>{value}</Markdown>
          ) : (
            <p className="plasmo-text-stone-400">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default FloatingNotesEditor
