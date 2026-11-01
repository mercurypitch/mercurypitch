// ============================================================
// Studio input monitor — the armed microphone through the speakers, at its lane's volume and pan, off unless asked for
// ============================================================
//
// Off by default: the round trip makes a voice heard late against itself,
// and through speakers it feeds back into the microphone, so the Studio
// asks for headphones when it is on. It carries the lane's volume and pan,
// not its effects; the take itself is always recorded dry.
//
// Level changes follow the house envelopes (CONVENTIONS.md 5b): toward the
// new level with setTargetAtTime, and to silence with the release, the
// nodes coming apart only after it.

/** The house release, and the slack before the nodes come apart. */
const RELEASE_SECONDS = 0.18
const RELEASE_SLACK_SECONDS = 0.06
/** How fast a level the singer sets is reached. */
const MOVE_SECONDS = 0.05

export interface StudioMonitorLevel {
  readonly on: boolean
  /** The lane's volume, as a gain. */
  readonly gain: number
  /** The lane's pan, -1 to 1. */
  readonly pan: number
}

export function createStudioInputMonitor(
  context: BaseAudioContext,
  input: AudioNode,
) {
  const level = context.createGain()
  level.gain.value = 0
  const panner =
    typeof context.createStereoPanner === 'function'
      ? context.createStereoPanner()
      : null
  input.connect(level)
  if (panner === null) level.connect(context.destination)
  else level.connect(panner).connect(context.destination)
  let closed = false

  return {
    set(next: StudioMonitorLevel): void {
      if (closed) return
      const now = context.currentTime
      const target = next.on ? Math.max(0, next.gain) : 0
      level.gain.cancelScheduledValues(now)
      level.gain.setValueAtTime(level.gain.value, now)
      level.gain.setTargetAtTime(
        target,
        now,
        (target === 0 ? RELEASE_SECONDS : MOVE_SECONDS) / 5,
      )
      if (panner !== null)
        panner.pan.setTargetAtTime(
          Math.max(-1, Math.min(1, next.pan)),
          now,
          MOVE_SECONDS / 5,
        )
    },
    dispose(): void {
      if (closed) return
      closed = true
      const now = context.currentTime
      level.gain.cancelScheduledValues(now)
      level.gain.setValueAtTime(level.gain.value, now)
      level.gain.setTargetAtTime(0, now, RELEASE_SECONDS / 5)
      setTimeout(
        () => {
          try {
            input.disconnect(level)
          } catch {
            // Already apart.
          }
          level.disconnect()
          panner?.disconnect()
        },
        (RELEASE_SECONDS + RELEASE_SLACK_SECONDS) * 1000,
      )
    },
  }
}

export type StudioInputMonitor = ReturnType<typeof createStudioInputMonitor>
