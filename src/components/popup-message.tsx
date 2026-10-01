function PopupMessage({ message }: { message: string }) {
  return (
    <div className="plasmo-w-[340px] plasmo-bg-card plasmo-font-sans plasmo-text-sm plasmo-text-foreground">
      <p className="plasmo-p-4">{message}</p>
      <div className="plasmo-border-t plasmo-border-border plasmo-py-2.5 plasmo-text-center plasmo-text-xs plasmo-text-muted-foreground">
        <a
          href="https://www.cptracker.org"
          target="_blank"
          rel="noreferrer"
          className="plasmo-transition-colors hover:plasmo-text-foreground">
          www.cptracker.org
        </a>
      </div>
    </div>
  )
}

export default PopupMessage
