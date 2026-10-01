import Markdown from "markdown-to-jsx"
import { Fragment, useState } from "react"

import { EyeIcon } from "~components/icons"

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
      aria-pressed={active}
      className={[
        "popup-btn popup-btn--outline popup-btn--xs",
        active
          ? "plasmo-bg-input plasmo-text-foreground"
          : "plasmo-text-muted-foreground hover:plasmo-text-foreground"
      ].join(" ")}>
      <EyeIcon className="plasmo-size-3" />
      Markdown
    </button>
  )
}

function NotesEditor({ value, onChange }: NotesEditorProps) {
  const [mode, setMode] = useState<NotesMode>("edit")

  return (
    <div className="plasmo-flex plasmo-h-full plasmo-min-h-0 plasmo-flex-col">
      <div className="plasmo-mb-2 plasmo-flex plasmo-flex-none plasmo-items-center plasmo-justify-between plasmo-gap-2">
        <label
          htmlFor="notes"
          className="plasmo-block plasmo-text-xs plasmo-font-medium plasmo-text-muted-foreground">
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
            className="plasmo-block plasmo-rounded-lg plasmo-border plasmo-border-input plasmo-bg-input/30 plasmo-px-3 plasmo-py-2.5 plasmo-font-mono plasmo-text-[13px] plasmo-leading-relaxed plasmo-text-foreground placeholder:plasmo-text-muted-foreground focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-primary/50"
          />
        ) : (
          <div className="notes-markdown plasmo-h-full plasmo-overflow-auto">
            {value.trim() ? (
              <Markdown options={MARKDOWN_OPTIONS}>{value}</Markdown>
            ) : (
              <p className="plasmo-text-muted-foreground">
                Nothing to preview yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default NotesEditor
