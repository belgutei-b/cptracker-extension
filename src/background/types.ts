import { type SwResult } from "types/service-worker"

// constructor for generic type T
export const SWOk = <T>(data: T): SwResult<T> => ({ ok: true, data })

export const SWFail = (error: string, status?: number): SwResult<never> => ({
  ok: false,
  error,
  status
})
