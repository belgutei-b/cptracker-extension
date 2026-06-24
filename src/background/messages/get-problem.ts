/**
 * Single Source of Truth for the problem cache
 * only this file should read & write to the problem cache in local storage
 * To access the problem cache, call the Service Worker (SW) via `get-problem`.
 */
import type { UserProblemFullClient } from "types/problem"
import type { SwResult } from "types/service-worker"

import type { PlasmoMessaging } from "@plasmohq/messaging"

import {
  readProblemCache,
  writeProblemCache
} from "~background/lib/problem-cache"
import { SWFail, SWOk } from "~background/types"
import { fetchProblem } from "~background/lib/problem-api"

const handler: PlasmoMessaging.MessageHandler<
  { url: string },
  SwResult<UserProblemFullClient>
> = async (req, res) => {
  try {
    if (!req.body?.url) {
      throw new Error("Missing url")
    }

    // cache hit -> return immediately, no API request
    const cached = await readProblemCache(req.body.url)
    if (cached) {
      return res.send(SWOk(cached))
    }

    // cache miss -> hit the backend
    const problem = await fetchProblem(req.body.url)

    void writeProblemCache(req.body.url, problem)

    return res.send(SWOk(problem))
  } catch (err) {
    res.send(SWFail((err as Error).message))
  }
}

export default handler
