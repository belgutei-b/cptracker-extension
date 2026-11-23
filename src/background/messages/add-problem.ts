
import type { PlasmoMessaging } from "@plasmohq/messaging"
import type { SwResult } from "types/service-worker"

import { SWFail, SWOk } from "~background/types"

const handler: PlasmoMessaging.MessageHandler<undefined, SwResult<null>> = async (req, res) => {
  try {
    await chrome.action.openPopup({ windowId: req.sender?.tab?.windowId })
    res.send(SWOk(null))
  } catch (err) {
    console.error("SW: open-popup failed")
    res.send(SWFail((err as Error).message))
  }
}

export default handler
