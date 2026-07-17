// ============================================================
// Audible guided demos (glass plan §17.4, decision 18).
//
// Every instruction demo must be HEARABLE, not just animated —
// users need to hear what a glide/hold/lock sounds like to know
// what to do with their voice. Synthesized on the caller's
// AudioContext (post-gesture), zero assets. Shared so the Voice
// Mirror's silent TaskDemo can adopt the same examples later.
// ============================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Master level for demo audio — examples, not performances. */
const DEMO_GAIN = 0.07

function envGain(ctx: AudioContext, seconds: number, peak: number): GainNode {
  const gain = ctx.createGain()
  const t = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.08)
  gain.gain.setValueAtTime(peak, t + seconds - 0.15)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  return gain
}

/**
 * "Like a siren": an exponential low→high sweep — the calibration
 * glide's audible example. Resolves when the sound has finished.
 */
export async function playSirenSweep(
  ctx: AudioContext,
  { lowHz = 150, highHz = 640, seconds = 2.2 } = {},
): Promise<void> {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  const t = ctx.currentTime
  osc.frequency.setValueAtTime(lowHz, t)
  osc.frequency.exponentialRampToValueAtTime(highHz, t + seconds)
  const gain = envGain(ctx, seconds, DEMO_GAIN)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  await sleep(seconds * 1000)
}

/** A steady example tone — "hold it like this". */
export async function playHoldTone(
  ctx: AudioContext,
  hz: number,
  seconds = 1.6,
): Promise<void> {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = hz
  const gain = envGain(ctx, seconds, DEMO_GAIN)
  osc.connect(gain).connect(ctx.destination)
  const t = ctx.currentTime
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  await sleep(seconds * 1000)
}

/**
 * The glass's voice: two barely-detuned sines at its resonant note —
 * played when the target is announced ("this glass rings at G4").
 */
export async function playTargetHum(
  ctx: AudioContext,
  hz: number,
  seconds = 1.8,
): Promise<void> {
  const gain = envGain(ctx, seconds, DEMO_GAIN * 0.9)
  gain.connect(ctx.destination)
  const t = ctx.currentTime
  for (const detune of [-4, 4]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = hz * Math.pow(2, detune / 1200)
    osc.connect(gain)
    osc.start(t)
    osc.stop(t + seconds + 0.05)
  }
  await sleep(seconds * 1000)
}

/**
 * "This is what winning sounds like": wanders below the target, settles
 * onto it, and blooms — played once before the first rep.
 */
export async function playApproachAndLock(
  ctx: AudioContext,
  targetHz: number,
  { seconds = 2.4 } = {},
): Promise<void> {
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  // Start a fourth below, wobble in, land on the target for the back half.
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
  const gain = envGain(ctx, seconds, DEMO_GAIN)
  osc.connect(gain).connect(ctx.destination)

  // The "bloom" once locked: a soft fifth shimmering in above the note.
  const bloom = ctx.createOscillator()
  bloom.type = 'sine'
  bloom.frequency.value = targetHz * 1.5
  const bloomGain = ctx.createGain()
  bloomGain.gain.setValueAtTime(0.0001, t)
  bloomGain.gain.setValueAtTime(0.0001, landAt)
  bloomGain.gain.exponentialRampToValueAtTime(DEMO_GAIN * 0.4, landAt + 0.25)
  bloomGain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  bloom.connect(bloomGain).connect(ctx.destination)

  osc.start(t)
  bloom.start(t)
  osc.stop(t + seconds + 0.05)
  bloom.stop(t + seconds + 0.05)
  await sleep(seconds * 1000)
}
