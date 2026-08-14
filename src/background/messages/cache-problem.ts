/**
 * This file is responsible for updating problem cache
 * in local storage. It is called from floating-note-taker.
 *
 * Content scripts cannot touch chrome.storage.session directly, so the
 * injected panel messages this handler to persist local edits (e.g. notes)
 * when it closes. Read the cache via `get-problem`; both go through the
 * helpers in ~background/lib/problem-cache.
 */
import type { UserProblemFullClient } from "types/problem"
import type { SwResult } from "types/service-worker"

import type { PlasmoMessaging } from "@plasmohq/messaging"

import { writeProblemCache } from "~background/lib/problem-cache"
import { SWFail, SWOk } from "~background/types"

const handler: PlasmoMessaging.MessageHandler<
  { url: string; problem: UserProblemFullClient },
  SwResult<null>
> = async (req, res) => {
  try {
    if (!req.body?.url) {
      throw new Error("Missing url")
    }
    if (!req.body?.problem) {
      throw new Error("Missing problem")
    }

    await writeProblemCache(req.body.url, req.body.problem)

    res.send(SWOk(null))
  } catch (err) {
    console.error("SW: cache-problem failed")
    res.send(SWFail((err as Error).message))
  }
}

export default handler
