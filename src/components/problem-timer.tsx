import { useEffect, useState } from "react"

type ProblemTimerProps = {
  elapsedMs: number
  startedAtMs: number | null
  isSolving: boolean
}

function formatProblemTimer(totalMs: number) {
  const safeMs = Math.max(0, Math.floor(totalMs))
  const safeSeconds = Math.floor(safeMs / 1000)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const centiseconds = Math.floor((safeMs % 1000) / 10)

  const hh = String(hours).padStart(2, "0")
  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")
  const xx = String(centiseconds).padStart(2, "0")

  return { main: `${hh}:${mm}:${ss}`, centiseconds: xx }
}

function ProblemTimer({
  elapsedMs,
  startedAtMs,
  isSolving
}: ProblemTimerProps) {
  const [liveNowMs, setLiveNowMs] = useState<number>(Date.now())

  useEffect(() => {
    setLiveNowMs(Date.now())

    if (!isSolving) {
      return
    }

    const intervalId = window.setInterval(() => {
      setLiveNowMs(Date.now())
    }, 50)

    return () => window.clearInterval(intervalId)
  }, [isSolving, startedAtMs])

  const displayedMs =
    elapsedMs +
    (isSolving && startedAtMs !== null
      ? Math.max(0, liveNowMs - startedAtMs)
      : 0)
  const formattedTimer = formatProblemTimer(displayedMs)

  return (
    <div className="plasmo-flex plasmo-w-full plasmo-justify-center plasmo-py-3.5">
      <span
        role="timer"
        className="plasmo-font-mono plasmo-text-2xl plasmo-font-medium plasmo-leading-none plasmo-tracking-tight plasmo-text-foreground plasmo-tabular-nums">
        {formattedTimer.main}
        <span className="plasmo-text-base plasmo-tracking-normal plasmo-text-muted-foreground">
          .{formattedTimer.centiseconds}
        </span>
      </span>
    </div>
  )
}

export default ProblemTimer
