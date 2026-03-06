export type UserProblemFullClient = {
  duration: number // seconds
  createdAt: string
  updatedAt: string
  userId: string
  status: string // "TODO" | "IN_PROGRESS" | "TRIED" | "SOLVED"
  problemId: string
  note: string
  timeComplexity: string
  spaceComplexity: string
  solvedAt: string | null
  triedAt: string | null
  lastStartedAt: string | null
  problem: {
    id: string
    createdAt: string
    link: string
    questionId: string
    title: string
    titleSlug: string
    difficulty: string // "Easy" | "Medium" | "Hard"
    tags: string[]
  }
}

export type SessionProblemRecord = {
  problem: UserProblemFullClient
  expiresAt: number
}
