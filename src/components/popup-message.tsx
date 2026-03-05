function PopupMessage({ message }: { message: string }) {
  return (
    <div className="plasmo-w-[340px] plasmo-bg-[#282828] plasmo-text-xs plasmo-text-white">
      <p className="plasmo-p-4">{message}</p>
      <div className="plasmo-border-t plasmo-border-[#3e3e3e] plasmo-py-3 plasmo-text-center plasmo-text-[11px] plasmo-text-stone-400">
        <a
          href="https://www.cptracker.org"
          target="_blank"
          rel="noreferrer"
          className="hover:plasmo-text-stone-200">
          www.cptracker.org
        </a>
      </div>
    </div>
  )
}

export default PopupMessage
