// ============================================================
// The pitch detector, started before the microphone is.
//
// createF0Stream spawns its YIN worker once a live stream exists: after
// the tap on a gate, after the permission prompt, after the capture
// worklet's module has loaded. A module worker is a thread, a fetch and a
// parse, and until now all of that sat inside the wait between "the
// microphone is live" and "the first pitch" -- the wait Beside Cue's perf
// chip calls `f0`.
//
// None of it needs the microphone, an AudioContext or a gesture: the
// worker learns the sample rate by message, later. So a screen that knows
// a stream is coming (Beside Cue's games list) can start the worker early,
// and the next stream adopts it instead of spawning its own.
//
// One spare at most, and taken once: a stream owns its worker and
// terminates it on dispose, so a worker two streams shared would die with
// the first of them.
// ============================================================

/** A fresh detector worker. The only place its URL is written, so the
 * bundler emits one worker file whichever path spawns it. */
export const spawnDetectorWorker = (): Worker =>
  new Worker(new URL('./f0-detector.worker.ts', import.meta.url), {
    type: 'module',
  })

let spare: Worker | null = null

/**
 * Start the detector worker now, for the next createF0Stream to adopt.
 *
 * Asks for nothing a player would notice: no microphone, no AudioContext,
 * no permission. A spare already waiting is kept rather than doubled.
 * False where the engine has no workers at all -- the stream's frame-loop
 * fallback already covers that engine.
 */
export function preloadF0Detector(): boolean {
  if (spare !== null) return true
  if (typeof Worker === 'undefined') return false
  let worker: Worker
  try {
    worker = spawnDetectorWorker()
  } catch {
    // A CSP that refuses workers throws here rather than reporting later.
    return false
  }
  // A script that never loads (a stale index.html after a redeploy, a CSP
  // without worker-src) reports it here, possibly before any stream
  // exists. That spare is dropped, so the stream spawns its own and meets
  // the failure with the fallback it already has.
  worker.onerror = () => {
    worker.terminate()
    if (spare === worker) spare = null
  }
  spare = worker
  return true
}

/** The waiting spare, or null. Whoever takes it owns it, errors included. */
export function takePreloadedDetector(): Worker | null {
  const taken = spare
  spare = null
  if (taken !== null) taken.onerror = null
  return taken
}

/** Terminate a spare nobody took: the screen that asked for it was left. */
export function releasePreloadedDetector(): void {
  const unused = spare
  spare = null
  unused?.terminate()
}
