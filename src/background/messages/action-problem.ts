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

// start / finish / update
const handler: PlasmoMessaging.MessageHandler<
  { type: ProblemAction; input: ProblemActionInput },
  SwResult<{ success: boolean }>
> = async (req, res) => {
  try {
    if (!req.body) {
      throw new Error("Request body missing")
    }

    if (req.body.type === ProblemAction.StartAction) {
      await startProblem(req.body.input.problemId)
    }
    if (req.body.type === ProblemAction.FinishAction) {
      await finishProblem(req.body.input)
    }
    if (req.body.type === ProblemAction.UpdateAction) {
      await saveProblem(req.body.input)
    }
    res.send(SWOk({ success: true }))
  } catch (err) {
    res.send(SWFail((err as Error).message))
  }
}

export default handler
