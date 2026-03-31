import { type ProblemStatus, type UserProblemFullClient } from "types/problem"

import { APP_BASE_URL } from "~config/base-url"

export type FinishProblemStatus = Extract<ProblemStatus, "TRIED" | "SOLVED">

export type FinishProblemInput = {
  problemId: string
  newStatus: FinishProblemStatus
  note: string
  timeComplexity: string
  spaceComplexity: string
}

export type SaveProblemInput = {
  problemId: string
  note: string
  timeComplexity: string
  spaceComplexity: string
}

type FetchProblemResponse = {
  problem: UserProblemFullClient
}

type ProblemApiRequest = {
  path: string
  method: "POST" | "PATCH"
  body?: unknown
}

async function requestProblemApi({
  path,
  method,
  body
}: ProblemApiRequest): Promise<Response> {
  const response = await fetch(`${APP_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    throw new Error(`Problem API request failed: ${response.status}`)
  }

  return response
}

/**
 * Fetching problem
 */
export async function fetchProblem(
  problemLink: string
): Promise<UserProblemFullClient> {
  const response = await requestProblemApi({
    path: "/api/extension/problems",
    method: "POST",
    body: { problemLink }
  })
  const body = (await response.json()) as FetchProblemResponse
  return body.problem
}

/**
 * Starting problem (TODO | TRIED -> IN_PROGRESS)
 */
export async function startProblem(problemId: string): Promise<void> {
  await requestProblemApi({
    path: `/api/extension/problems/${problemId}/start`,
    method: "POST"
  })
}

/**
 * Finishing problem (IN_PROGRESS -> SOLVED TRIED)
 */
export async function finishProblem(input: FinishProblemInput): Promise<void> {
  await requestProblemApi({
    path: `/api/extension/problems/${input.problemId}/finish`,
    method: "POST",
    body: {
      newStatus: input.newStatus,
      note: input.note,
      timeComplexity: input.timeComplexity,
      spaceComplexity: input.spaceComplexity
    }
  })
}

/**
 * Updating notes / time & space complexity
 */
export async function saveProblem(input: SaveProblemInput): Promise<void> {
  await requestProblemApi({
    path: `/api/extension/problems/${input.problemId}/save`,
    method: "PATCH",
    body: {
      note: input.note,
      timeComplexity: input.timeComplexity,
      spaceComplexity: input.spaceComplexity
    }
  })
}
