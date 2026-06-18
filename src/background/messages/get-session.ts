/**
 * Single Source of Truth for the auth session in local storage
 * the only file that should access local storage for the session.
 * To access the session, call the Service Worker (SW) via `get-session`.
 * 
 * Reading & writing cache (best-effort) must have its own error handler
 * as it must not fail the get-session as it has API fallback.
 */

import { type SwResult } from "types/service-worker"

import type { PlasmoMessaging } from "@plasmohq/messaging"

import { authClient, type SessionData } from "~auth/auth-client"
import {
  readSessionCache,
  writeSessionCache
} from "~background/lib/session-cache"
import { SWFail, SWOk } from "~background/types"

const handler: PlasmoMessaging.MessageHandler<
  undefined,
  SwResult<SessionData>
> = async (_req, res) => {
  try {
    // cache hit -> return immediately, no API request
    const cached = await readSessionCache()
    if (cached) {
      return res.send(SWOk(cached))
    }

    // cache miss -> hit the backend
    const { data, error } = await authClient.getSession()

    if (error) {
      return res.send(SWFail(error.message ?? "Auth request failed"))
    }

    // only cache an actual session
    if (data) {
      void writeSessionCache(data)
    }

    res.send(SWOk(data))
  } catch (err) {
    res.send(SWFail((err as Error).message))
  }
}

export default handler
