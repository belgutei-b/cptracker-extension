import { useEffect, useState } from "react"

import PopupMessage from "~components/popup-message"
import { useAuthSession } from "~hooks/use-auth-session"

import "~style.css"

const DEFAULT_POPUP_WIDTH = 340

// Tells the content script to reveal the floating note-taker (see
// src/contents/floating-notes.tsx).
const OPEN_FLOATING_NOTES = "OPEN_FLOATING_NOTES"

function IndexPopup() {
  const {
    session,
    isLoading: isAuthPending,
    error: authError
  } = useAuthSession()

  const [currentUrl, setCurrentUrl] = useState<string>("")

  const isLeetCodeProblem = currentUrl.startsWith(
    "https://leetcode.com/problems/"
  )

  // On open (icon press), read the active tab and ask its content script to
  // reveal the floating note-taker.
  useEffect(() => {
    ;(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })
      const url = tab?.url || ""
      setCurrentUrl(url)

      if (tab?.id && url.startsWith("https://leetcode.com/problems/")) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: OPEN_FLOATING_NOTES })
        } catch {
          // Content script may not be injected yet / not a matching page.
        }
      }
    })()
  }, [])

  if (isAuthPending) {
    return <PopupMessage message="Loading..." />
  }

  if (authError) {
    return <PopupMessage message={authError} />
  }

  // Unauthenticated User
  if (!session) {
    return (
      <PopupMessage message="Sign in at www.cptracker.org to use the tracker." />
    )
  }

  if (!isLeetCodeProblem) {
    return (
      <PopupMessage message="Open a LeetCode problem tab to start tracking." />
    )
  }

  return (
    <div
      style={{ width: DEFAULT_POPUP_WIDTH }}
      className="plasmo-min-w-[340px] plasmo-bg-[#282828] plasmo-text-white plasmo-shadow-xl">
      <div className="plasmo-px-4 plasmo-py-6 plasmo-text-center plasmo-text-sm plasmo-text-stone-200">
        Opening the note-taker.
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
  )
}

export default IndexPopup
