# Known bugs & improvements — floating note-taker

Review of `src/contents/floating-notes.tsx` (and the cache path it relies on). The note-taker reads
the session cache **cache-first** — `get-problem` returns the cached problem before hitting the
backend — so any time in-memory state diverges from what's written to the cache, a reload within the
60-min cache TTL shows stale data. Most bugs below stem from that.

Cache is written in only two places: `get-problem` (on fetch) and `flushOnExit` via the
`cache-problem` message. The exit write is gated on the **note** changing.

---

## 🔴 Bug 1 — Cache goes stale after "Update notes" / Tried / Solved  *(regression)*

Introduced by the exit-persistence change on this branch. `handleUpdate` and `handleFinish` now set
`lastPersistedNoteRef.current = problem.note` on success. Since `flushOnExit` is gated on
`note !== lastPersistedNoteRef.current`, that assignment makes the exit flush **skip the cache write
too**.

Repro: type a note → click "Update notes" → reload the page within 60 min. DB has the new note, but
`get-problem` returns the **old** cached note.

Root cause: the cache and DB share one change-guard ref, but "Update notes" only persists to the DB,
not the cache — so marking the note as persisted is a lie for the cache.

Fix (recommended): give the action handlers a cache write-through instead of a bare baseline
assignment. Add a helper near `flushOnExit`:

```ts
const cacheProblem = (p: UserProblemFullClient) => {
  if (!loadedUrlRef.current) return
  lastPersistedNoteRef.current = p.note
  void sendToBackground<
    { url: string; problem: UserProblemFullClient },
    SwResult<null>
  >({ name: "cache-problem", body: { url: loadedUrlRef.current, problem: p } })
    .catch((err) => console.error("Error: cacheProblem", err))
}
```

Then in `handleUpdate` success replace `lastPersistedNoteRef.current = problem.note` with
`cacheProblem(problem)`. (See Bug 2 for `handleStart`/`handleFinish`.) The exit DB write stays gated
on note-change (no redundant PATCH), but the cache is always refreshed.

Locations: `src/contents/floating-notes.tsx` — `handleUpdate` (~L395), `handleFinish` (~L438),
`flushOnExit` (~L263).

---

## 🔴 Bug 2 — Status / duration changes never reach the cache  *(pre-existing)*

`flushOnExit` is gated on **note change only**, and `handleStart` / `handleFinish` change
`status` / `duration` / `lastStartedAt` but never write the cache. So if you Start a problem (or hit
Tried/Solved) **without editing the note**, the exit flush skips and the cache keeps the old status.

Repro: Start a problem, don't touch the note, reload → panel shows the old status (e.g. a "Start"
button on an already in-progress problem, or a reset timer) until the 60-min TTL expires.

Fix: after each successful mutation, mirror the updated object into the cache. Build the updated
problem once, `setProblem(updated)`, then `cacheProblem(updated)` (helper from Bug 1) in both
`handleStart` and `handleFinish`. Net: exit DB write stays note-gated, cache always current.

---

## 🔴 Bug 3 — SPA navigation shows the wrong problem  *(pre-existing, larger)*

The load effect runs once (`[]` deps) and there is **no URL-change detection anywhere** (confirmed by
grep — nothing listens to `popstate` / `pushState` / location changes). LeetCode routes client-side,
so navigating problem A → B never re-fetches: the panel keeps showing A's note/timer/status while
you're on B, and any edit flushes under A's cache key. `loadedUrlRef` only protects the cache *key*,
not the displayed data.

Fix (if taken on): watch for URL changes — poll `window.location.href` in a `useEffect`, or patch
`history.pushState`/`replaceState` and listen for `popstate`. On change: `flushOnExit()` for the old
problem, then re-run the load flow and reset `loadedUrlRef` + `lastPersistedNoteRef` for the new URL.
Larger change; touches the load flow.

---

## 🟡 Minor

- **Debug log left in:** `console.error("session.success", session.success)` (~L237) — noise on every
  load, and it's `console.error` for a non-error. Remove.
- **Catch blocks drop the error:** handlers at ~L359 / ~L397 / ~L446 log a static string and never
  include the actual `err`. Change to e.g. `console.error("Error: handleStart", err)`.
- **Wrong error message:** `handleStart` throws `"Error updating notes"` (~L345) — copy-paste; should
  be "Error starting problem".
- **Eager load:** the session + problem fetch runs on **every** LeetCode problem page even if the user
  never opens the note-taker. Gating the load effect on `isOpen` (fetch on first open) removes needless
  backend calls, at the cost of a brief "Loading…" on first open.
- **No error dismissal:** the `error` / not-signed-in states rendered via `shell(...)` have no X
  button, so the panel can't be closed from those states. Matches the existing `TODO` at ~L95
  ("show errors to the client if SW requests fail").
