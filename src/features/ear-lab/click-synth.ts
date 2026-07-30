// ============================================================
// click-synth — sample-accurate clicks on the AudioContext clock.
//
// Shared by the latency wizard and The Grid: both live or die on
// onset precision, so clicks are scheduled with osc.start(t) and
// a 1 ms attack (sharp enough to detect, no speaker pop), wired
// straight to ctx.destination past the engine's effects chain.
// ============================================================

const CLICK_HZ = 2000
const CLICK_LEN_S = 0.03

export function scheduleClick(
  ctx: AudioContext,
  at: number,
  options?: { hz?: number; gainLevel?: number },
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = options?.hz ?? CLICK_HZ
  const peak = options?.gainLevel ?? 0.9
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.001)
  gain.gain.setValueAtTime(peak, at + CLICK_LEN_S - 0.005)
  gain.gain.linearRampToValueAtTime(0, at + CLICK_LEN_S)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(at)
  osc.stop(at + CLICK_LEN_S + 0.01)
}
