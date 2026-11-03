// ============================================================
// Studio take running — whether a take is counting in, recording or being kept, for the controls that wait for it
// ============================================================
//
// Export, Compare and Auto-balance render the whole song, and take the
// song's audio to do it (useStudioTransport.ts releaseAudio): started under
// a take, they would stop the song it records over. Repeat, Punch and the
// range decide what a take keeps when it starts (take-plan.ts), so they hold
// still until it is kept. The recorder says when a take runs
// (useStudioRecorder.ts), and those controls read it here instead of through
// every component between them. One Studio records at a time: there is one
// microphone.
import { createSignal } from 'solid-js'

const [running, setRunning] = createSignal(false)

/** True from a take's count-in until it is kept. */
export const studioTakeRunning = running

/** The recorder's report, each time its take starts or is over. */
export function setStudioTakeRunning(next: boolean): void {
  setRunning(next)
}
