// ============================================================
// Studio transport retirement — free a handed-over run once its crossfade has played, or take back a handover not yet begun
// ============================================================
//
// Both used to live in transport.ts. They only touch the transport's
// retirement bookkeeping (the runs fading out, their release timers and the
// handovers in flight), so they take that bookkeeping as an argument and the
// transport stays under the 800-line ratchet.
import type { StudioHandoff } from './handoff'
import { cancelHandoff, HANDOFF_CANCEL_MARGIN_SECONDS } from './handoff'
import type { StudioRun } from './run'

// A handed-over run is silent once its crossfade ends; free it a little later.
const HANDOFF_RELEASE_SLACK_MS = 60

/** What the transport keeps about the runs it is letting go. */
export interface StudioRetirement {
  readonly timers: Map<StudioRun, ReturnType<typeof setTimeout>>
  readonly retired: Set<StudioRun>
  readonly handoffs: StudioHandoff[]
  /** Free a run that is silent now. */
  release(run: StudioRun): void
}

/** Free a handed-over run after its crossfade, by the audio clock, which can fall behind. */
export function releaseWhenSilent(
  retirement: StudioRetirement,
  run: StudioRun,
  silentAt: number,
): void {
  const wait = Math.max(0, silentAt - run.ctx.currentTime) * 1000
  retirement.timers.set(
    run,
    setTimeout(() => {
      if (run.ctx.state === 'running' && run.ctx.currentTime < silentAt)
        releaseWhenSilent(retirement, run, silentAt)
      else retirement.release(run)
    }, wait + HANDOFF_RELEASE_SLACK_MS),
  )
}

/**
 * Take back a handover that has not begun: its `from` plays on at full
 * level, and its `to`, never heard, is freed at once. False when it
 * begins too soon to take back.
 */
export function cancelHandover(
  retirement: StudioRetirement,
  handoff: StudioHandoff,
): boolean {
  const { from, to, at } = handoff
  if (at - to.ctx.currentTime < HANDOFF_CANCEL_MARGIN_SECONDS) return false
  cancelHandoff(from.envelope, at)
  from.openAt = Math.max(from.openAt, at)
  clearTimeout(retirement.timers.get(from))
  retirement.timers.delete(from)
  retirement.retired.delete(from)
  retirement.handoffs.splice(retirement.handoffs.indexOf(handoff), 1)
  retirement.release(to)
  return true
}
