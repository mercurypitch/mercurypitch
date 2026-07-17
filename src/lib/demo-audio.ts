// ============================================================
// Audible guided demos (glass plan §17.4, decision 18).
//
// Every instruction demo must be HEARABLE, not just animated —
// users need to hear what a glide/hold/lock sounds like to know
// what to do with their voice. Synthesized on the caller's
// AudioContext (post-gesture), zero assets. Shared so the Voice
// Mirror's silent TaskDemo can adopt the same examples later.
//
// Each play* routes through one master gain and returns a handle
// the caller MUST be able to stop: demos overlap otherwise (a
// siren still ringing under the target hum, an approach sketch
// bleeding into the live sing). GlassApp stops the previous demo
// before starting the next and the moment recording begins.
// ============================================================

/** Master level for demo audio — examples, not performances. */
const DEMO_GAIN = 0.07

export interface DemoSound {
  /** Ramp down and stop immediately (safe to call more than once). */
  stop: () => void
}

/** Wrap a routed master gain + its oscillators into a stoppable handle. */
function sound(ctx: AudioContext): {
  master: GainNode
  track: (node: OscillatorNode) => void
  handle: DemoSound
} {
  const master = ctx.createGain()
  master.connect(ctx.destination)
  const oscillators: OscillatorNode[] = []
  let stopped = false
  return {
    master,
    track: (node) => oscillators.push(node),
    handle: {
      stop: () => {
        if (stopped) return
        stopped = true
        const t = ctx.currentTime
        try {
          master.gain.cancelScheduledValues(t)
          master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t)
          master.gain.linearRampToValueAtTime(0.0001, t + 0.04)
        } catch {
          // Context closed mid-stop — the nodes are already dead.
        }
        for (const osc of oscillators) {
          try {
            osc.stop(t + 0.06)
          } catch {
            // Already stopped.
          }
        }
      },
    },
  }
}

function envelope(
  gain: AudioParam,
  t: number,
  seconds: number,
  peak: number,
): void {
  gain.setValueAtTime(0.0001, t)
  gain.exponentialRampToValueAtTime(peak, t + 0.08)
  gain.setValueAtTime(peak, t + seconds - 0.15)
  gain.exponentialRampToValueAtTime(0.0001, t + seconds)
}

/**
 * "Like a siren": an exponential low→high sweep — the calibration glide's
 * audible example.
 */
export function playSirenSweep(
  ctx: AudioContext,
  { lowHz = 150, highHz = 640, seconds = 2.2 } = {},
): DemoSound {
  const { master, track, handle } = sound(ctx)
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(lowHz, t)
  osc.frequency.exponentialRampToValueAtTime(highHz, t + seconds)
  envelope(master.gain, t, seconds, DEMO_GAIN)
  osc.connect(master)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  track(osc)
  return handle
}

/** A steady example tone — "hold it like this". */
export function playHoldTone(
  ctx: AudioContext,
  hz: number,
  seconds = 1.6,
): DemoSound {
  const { master, track, handle } = sound(ctx)
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = hz
  envelope(master.gain, t, seconds, DEMO_GAIN)
  osc.connect(master)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  track(osc)
  return handle
}

/**
 * The glass's voice: two barely-detuned sines at its resonant note —
 * played when the target is announced ("this glass rings at G4").
 */
export function playTargetHum(
  ctx: AudioContext,
  hz: number,
  seconds = 1.8,
): DemoSound {
  const { master, track, handle } = sound(ctx)
  const t = ctx.currentTime
  envelope(master.gain, t, seconds, DEMO_GAIN * 0.9)
  for (const detune of [-4, 4]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz * Math.pow(2, detune / 1200)
    osc.connect(master)
    osc.start(t)
    osc.stop(t + seconds + 0.05)
    track(osc)
  }
  return handle
}

/**
 * "This is what winning sounds like": wanders below the target, settles onto
 * it, and blooms — played once before the first rep.
 */
export function playApproachAndLock(
  ctx: AudioContext,
  targetHz: number,
  { seconds = 2.4 } = {},
): DemoSound {
  const { master, track, handle } = sound(ctx)
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const start = targetHz * Math.pow(2, -5 / 12)
  const landAt = t + seconds * 0.45
  osc.frequency.setValueAtTime(start, t)
  osc.frequency.exponentialRampToValueAtTime(
    targetHz * 0.97,
    t + seconds * 0.25,
  )
  osc.frequency.exponentialRampToValueAtTime(
    targetHz * 1.015,
    t + seconds * 0.38,
  )
  osc.frequency.exponentialRampToValueAtTime(targetHz, landAt)
  envelope(master.gain, t, seconds, DEMO_GAIN)
  osc.connect(master)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  track(osc)

  // The bloom once locked: a soft fifth shimmering in above the note.
  const bloom = ctx.createOscillator()
  bloom.type = 'sine'
  bloom.frequency.value = targetHz * 1.5
  const bloomGain = ctx.createGain()
  bloomGain.gain.setValueAtTime(0.0001, t)
  bloomGain.gain.setValueAtTime(0.0001, landAt)
  bloomGain.gain.exponentialRampToValueAtTime(DEMO_GAIN * 0.4, landAt + 0.25)
  bloomGain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  bloom.connect(bloomGain).connect(master)
  bloom.start(t)
  bloom.stop(t + seconds + 0.05)
  track(bloom)
  return handle
}
