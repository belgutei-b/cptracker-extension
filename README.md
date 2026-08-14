<p align="center">
  <a href="https://cptracker.org/">
    <img src="https://github.com/belgutei-b/cptracker/blob/main/public/favicon_io/android-chrome-512x512.png" width="140px" alt="CPTracker logo" />
  </a>
</p>

# CPTracker Extension

CPTracker Extension brings CPTracker directly into your LeetCode workflow — no tab switching. Solved count is a good metric, but it doesn't capture the hours you spent on a hard problem you didn't submit. Those sessions matter too. From the popup, you can add the current problem, start and stop the timer, write notes, and mark it Tried or Solved, all without leaving LeetCode.

## How it works

1. Sign in at [cptracker.org](https://www.cptracker.org)
2. Open any LeetCode problem page
3. Open the extension popup — the current problem is auto-added to your cptracker account
4. Start the timer and begin solving. Write down your observations, approach, and time/space complexity as you go
5. Mark it when you're done — either **Solved** or **Tried**. Your notes and session duration are saved
6. Check your analytics on [cptracker.org](https://www.cptracker.org) — a daily bar chart of time spent broken down by difficulty shows exactly where your hours are going

## Install

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/ojpjlobnleonmgehlhoibaicokoadcnm?utm_source=item-share-cb)

## Technology

Built with [Plasmo](https://docs.plasmo.com/), React, and TailwindCSS.

## File Structure

```
src/
├── popup.tsx                 # toolbar popup — tells the page to open the panel
├── contents/
│   └── floating-notes.tsx    # content script injected into leetcode.com/problems/*
├── background/               # service worker
│   ├── messages/             # SW handlers — one file = one message name
│   │   ├── get-session.ts        # cached auth session
│   │   ├── get-problem.ts        # cached problem fetch
│   │   ├── action-problem.ts     # start / finish / update
│   │   └── set-problem-cache.ts  # persist local edits (notes)
│   └── lib/                  # API calls + caching, no messaging
│       ├── problem-api.ts        # fetch/start/finish/save REST calls
│       ├── problem-cache.ts      # chrome.storage.session problem cache
│       └── session-cache.ts      # chrome.storage.session auth cache
├── hooks/                    # panel state (problem data, drag/resize layout)
└── auth/auth-client.ts       # better-auth client
```

## Submission checklist for chrome web store

1. update the version number in package.json
2. remove localhost from host permissions in package.json
3. change the backend to allow any extension origin to enable api request from the build
4. zip the prod in ./build/chrome-mv3-prod

## Extension Work Flow

1. User presses the extension icon in the browser tab which opens the Popup (@/src/popup.tsx)
2. If the current tab is in leetcode problem, the pop-up sends a message using Chrome API and the listener is in @/src/contents/floating-notes.tsx.
3. From here, floating-notes shows the react component containing timer & notes section and is also responsible for calling the CPTracker backend API using service worker.

## License

Licensed under the [MIT License](./LICENSE).
