/**
 * It is responsible for modifying problem in the database.
 * Cache would be handled separately
 */

import { ProblemAction, type ProblemActionInput } from "types/problem"
import type { SwResult } from "types/service-worker"

import type { PlasmoMessaging } from "@plasmohq/messaging"

import {
  finishProblem,
  saveProblem,
  startProblem
} from "~background/lib/problem-api"
import { SWFail, SWOk } from "~background/types"

export type ActionResponseBody = { duration: number } | { lastStartedAt: string } | null

/* start / finish / update */
const handler: PlasmoMessaging.MessageHandler<
  { type: ProblemAction; input: ProblemActionInput },
  SwResult<{ success: boolean; body: ActionResponseBody }>
> = async (req, res) => {
  try {
    if (!req.body) {
      throw new Error("Request body missing")
    }

    let resBody: ActionResponseBody = null
    if (req.body.type === ProblemAction.StartAction) {
      const apiRes = await startProblem(req.body.input.problemId)
      resBody = (await apiRes.json()) as { lastStartedAt: string }
    }
    if (req.body.type === ProblemAction.FinishAction) {
      const apiRes = await finishProblem(req.body.input)
      resBody = (await apiRes.json()) as { duration: number }
    }
    if (req.body.type === ProblemAction.UpdateAction) {
      await saveProblem(req.body.input)
    }
    res.send(SWOk({ success: true, body: resBody }))
  } catch (err) {
    res.send(SWFail((err as Error).message))
  }
}

export default handler
