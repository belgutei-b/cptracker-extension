import Markdown from "markdown-to-jsx"
import { Fragment, useState } from "react"

type NotesEditorProps = {
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

function NotesEditor({ value, onChange }: NotesEditorProps) {
  const [mode, setMode] = useState<NotesMode>("edit")

  return (
    <div className="plasmo-flex plasmo-h-full plasmo-min-h-0 plasmo-flex-col">
      <div className="plasmo-mb-1 plasmo-flex plasmo-flex-none plasmo-items-center plasmo-justify-between plasmo-gap-2">
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

      <div className="plasmo-min-h-0 plasmo-flex-1">
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
          <div className="notes-markdown plasmo-h-full plasmo-overflow-auto">
            {value.trim() ? (
              <Markdown options={MARKDOWN_OPTIONS}>{value}</Markdown>
            ) : (
              <p className="plasmo-text-stone-400">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotesEditor
