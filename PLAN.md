# Floating note-taker for LeetCode pages

## Context

Today all note-taking (notes, time/space complexity, timer, start/solve/tried) lives in
the **extension popup** (`src/popup.tsx`). The popup closes the moment the user clicks
back into the LeetCode editor, so they can't take notes while coding. We want the same
tracker available as an **optional floating panel injected onto the LeetCode page** that
stays open while the user works — draggable, resizable, collapsible, with a toggle button.
The popup stays exactly as-is for the toolbar-icon click.

### Why a service worker is required (the core constraint)

- The popup is an extension page (`chrome-extension://` origin). Its `fetch(...,
  {credentials:"include"})` to cptracker.org works because extension-page requests use the
  extension's `host_permissions` to bypass CORS **and** send cptracker.org cookies as
  first-party.
- The floating panel is a **content script** injected into `leetcode.com`. Its own React
  tree (separate from the popup) lives in a style-isolated Shadow DOM. Since MV3, a
  content-script `fetch` is governed by the **host page's** CORS policy — NOT the
  extension's `host_permissions`. A direct call to cptracker.org from the content script
  would be cross-origin from `https://leetcode.com` and fail on CORS + third-party-cookie
  blocking.
- The **background service worker (SW)** runs in the extension origin, so it keeps the
  CORS bypass + first-party cptracker.org cookies. Solution: the content script (and, for a
  single code path, the popup too) sends a **message** to the SW; the SW does the real
  `fetch`/auth and returns the result.

### How SW messaging works (quick primer)

`@plasmohq/messaging` (Plasmo's helper) makes each file in `src/background/messages/<name>.ts`
a request handler. Plasmo auto-generates the SW that registers them — you don't hand-write the
SW. The UI calls `sendToBackground({ name: "<name>", body })`, which returns a Promise that
resolves with whatever the handler returns. Think of it as a typed function call where the
function body runs in the privileged SW context.

## Approach

Reuse the existing, well-layered code. The same components (`ProblemTimer`,
`ComplexityField`, `NotesEditor`) and hooks (`useProblemTracker`, `useAuthSession`) drive
both surfaces; only the network layer underneath the hooks moves into the SW. Popup and
floating panel already share state for free via `chrome.storage.session` caches
(`src/lib/problem-cache.ts`, `src/lib/session-cache.ts`).

### 1. Install dependencies (pnpm)
```
pnpm add @plasmohq/messaging react-rnd
```
- `@plasmohq/messaging` — SW messaging.
- `react-rnd` — drag + resize for the floating panel in one component (same author as the
  `re-resizable` already used by `NotesEditor`).

### 2. Make the auth client SW-safe — `src/auth/auth-client.ts`
Switch from `better-auth/react` to the vanilla `better-auth/client` (`createAuthClient`).
The app only ever calls `getSession()` (never the reactive `useSession`), so the vanilla
client works in both React and the SW. Update the `SessionData` type in
`src/hooks/use-auth-session.ts` to derive from `getSession` instead of `useSession`.

### 3. Move real network calls into the SW — `src/background/messages/`
Create one handler per operation, each importing the existing implementation functions:
- `get-session.ts` → `authClient.getSession()`
- `fetch-problem.ts` → `fetchProblem(link)` (from `~services/problem-api`)
- `start-problem.ts` → `startProblem(id)`
- `finish-problem.ts` → `finishProblem(input)`
- `save-problem.ts` → `saveProblem(input)`

`src/services/problem-api.ts` stays as the **SW-side** implementation (the actual `fetch`
now executes in SW context → CORS bypass + cookies). No change to its fetch logic.

### 4. UI-side messaging wrapper — `src/services/problem-client.ts` (new)
Thin functions with the *same signatures* as `problem-api.ts` but implemented with
`sendToBackground(...)`. Update the hooks to import from here:
- `use-problem-tracker.ts` imports `fetchProblem/startProblem/finishProblem/saveProblem`
  from `~services/problem-client` instead of `~services/problem-api`.
- `use-auth-session.ts` calls `sendToBackground({ name: "get-session" })` instead of
  `authClient.getSession()` (session-cache logic unchanged).

This gives one network path used by **both** popup and floating panel.

### 5. Extract shared UI — `src/components/tracker-panel.tsx` (new)
Move the body of `src/popup.tsx` (lines ~89–177: timer + complexity grid + notes editor +
action buttons + error/footer) into a `TrackerPanel` component that takes the
`useProblemTracker` result + `useAuthSession` result (or accepts `currentUrl`/`session` and
calls the hooks itself). Refactor `popup.tsx` to render `<TrackerPanel currentUrl={...} />`.
This keeps the floating panel and popup visually identical with zero JSX duplication.

### 6. The floating panel content script — `src/contents/floating-notes.tsx` (new)
Plasmo CSUI:
```ts
export const config: PlasmoCSConfig = { matches: ["https://leetcode.com/problems/*"] }
```
- `getStyle()` injects the compiled Tailwind (`import styleText from "data-text:~style.css"`)
  into the Shadow DOM so existing `plasmo-`/`popup-btn` classes render correctly.
- Renders a fixed-position **toggle launcher button**. When open, renders an `<Rnd>`
  (react-rnd) panel — **draggable** (by header) + **resizable** — containing `<TrackerPanel>`.
- **Collapse/minimize**: header button toggles a collapsed state that shows header only.
- Persist panel position/size/open/collapsed in `localStorage` (mirrors the pattern already
  in `NotesEditor`).
- **Current URL + SPA navigation**: LeetCode is an SPA, so the content script loads once and
  the URL changes without reload. Add a small URL watcher (patch `history.pushState`/
  `replaceState` + listen to `popstate`) that updates a `currentUrl` state, which is passed
  to `useProblemTracker` so it re-fetches when navigating between problems.

### 7. Manifest / Plasmo wiring
Plasmo auto-generates `content_scripts` (from `src/contents/`) and the `background` SW (from
`src/background/`). Existing `host_permissions` (`https://www.cptracker.org/*`,
`http://localhost:3000/*` in `package.json`) already cover the SW fetch. The content-script
`matches` grant injection on LeetCode. No manual manifest edits expected — verify the
generated `build/chrome-mv3-dev/manifest.json` lists the SW, the content script, and the
host permissions after a dev build.

## Critical files

| Action | File |
|---|---|
| Edit (vanilla client) | `src/auth/auth-client.ts` |
| Edit (call SW for session) | `src/hooks/use-auth-session.ts` |
| Edit (import from problem-client) | `src/hooks/use-problem-tracker.ts` |
| Edit (render TrackerPanel) | `src/popup.tsx` |
| Keep as SW-side impl | `src/services/problem-api.ts` |
| New (SW handlers) | `src/background/messages/{get-session,fetch-problem,start-problem,finish-problem,save-problem}.ts` |
| New (UI messaging wrapper) | `src/services/problem-client.ts` |
| New (shared UI) | `src/components/tracker-panel.tsx` |
| New (floating panel CSUI) | `src/contents/floating-notes.tsx` |
| Reused as-is | `src/components/{notes-editor,complexity-field,problem-timer,popup-message}.tsx`, `src/lib/{problem-cache,session-cache}.ts`, `src/config/base-url.ts`, `types/problem.ts` |

## Risks / watch items
- **better-auth in SW**: confirm `better-auth/client` `getSession()` runs in the SW (no
  `window` usage at import). If it throws, fall back to a plain `fetch` to the better-auth
  session endpoint inside `get-session.ts`.
- **Tailwind rem units in Shadow DOM**: CSUI `rem` resolves against the page root font-size;
  if sizing looks off, set an explicit `font-size` on the shadow host or use the px-based
  classes already present.
- **20+ live users**: the popup path is being rerouted through the SW. Verify the popup still
  works end-to-end before shipping (it's the published surface).

## Verification

1. `pnpm dev`, load `build/chrome-mv3-dev` as an unpacked extension (chrome://extensions, dev
   mode on).
2. **Popup still works** (regression): click toolbar icon on a LeetCode problem → auth gate,
   load, edit notes, Start/Solved/Tried, Update notes all succeed.
3. **SW is doing the fetch**: chrome://extensions → "service worker" → Inspect → Network tab
   shows requests to cptracker.org with cookies; no CORS errors.
4. **Floating panel**: on `leetcode.com/problems/*` the launcher button appears; open it →
   panel shows the same tracker; drag, resize, collapse, close all work and survive reload.
5. **Shared state**: edit notes in the floating panel → open the popup → same notes appear
   (shared `chrome.storage.session` cache); changes persist to the backend.
6. **SPA navigation**: navigate from one problem to another without reload → panel re-fetches
   and shows the new problem.
7. **Auth gating**: signed out → both surfaces show the sign-in message.
8. `pnpm build` produces a clean `build/chrome-mv3-prod` with SW + content script in the
   generated manifest.
