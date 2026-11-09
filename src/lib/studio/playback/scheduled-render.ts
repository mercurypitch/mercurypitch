// ============================================================
// Studio scheduled render — an offline render scheduled as it plays, a few seconds ahead of where it has reached
// ============================================================
//
// A run schedules its sources a little ahead of the clock (run.ts), and an
// offline render does the same: it schedules four seconds ahead, then stops
// every two seconds to schedule more. Scheduling a render whole costs far
// more than its notes. Chromium pulls every node the destination reaches at
// every render quantum, so a source scheduled minutes ahead costs work in
// every quantum until it has played. A 2,000-note take, 250 s with a synth
// voice per note, took 148 s to render scheduled whole in Chrome 153, and
// 3.0 s scheduled four seconds ahead.
//
// A failure to schedule fails the render once it has settled, and the
// context is never left suspended. An abort stops the scheduling; the
// render then plays out what was already scheduled, and settles.

/** What a scheduled render schedules: everything that starts before `time` on its clock. */
export interface StudioRenderSchedule {
  scheduleUntil(time: number): void
}

/** How far ahead of the render it schedules, and how often it stops to schedule more. */
const AHEAD_SECONDS = 4
const STEP_SECONDS = 2

/**
 * Render `ctx`, `seconds` long, scheduling `schedule` as the render reaches
 * it, the way a run is scheduled as it plays.
 */
export async function renderAsScheduled(
  ctx: OfflineAudioContext,
  schedule: StudioRenderSchedule,
  seconds: number,
  signal: AbortSignal,
): Promise<AudioBuffer> {
  const failures: unknown[] = []
  schedule.scheduleUntil(AHEAD_SECONDS)
  for (let at = STEP_SECONDS; at < seconds; at += STEP_SECONDS) {
    ctx
      .suspend(at)
      .then(() => {
        try {
          if (!failures.length && !signal.aborted)
            schedule.scheduleUntil(at + AHEAD_SECONDS)
        } catch (error) {
          failures.push(error)
        }
        return ctx.resume()
      })
      .catch((error: unknown) => failures.push(error))
  }
  const rendered = await ctx.startRendering()
  if (failures.length) throw failures[0]
  return rendered
}
