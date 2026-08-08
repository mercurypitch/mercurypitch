// Finding the moment a string was struck, one audio block at a time.
// ============================================================
//
// This is deliberately separate from pitch detection, because the two answer
// different questions and want different windows. *What* note is sounding is a
// question about a sustained tone, and a good answer needs tens of milliseconds
// of signal — a little lag there costs nothing, because a sustained note is by
// definition still there. *When* it was struck is a question about a single
// transient, and every millisecond of lag is an error in the answer.
//
// So this runs on the raw sample stream at the audio render quantum, where the
// timestamp is exact, and pitch stays on its own slower path.
//
// What it finds is a *picked* attack: the signal rising sharply above where it
// was a moment ago. Hammer-ons, pull-offs and slides do not do that — they are
// pitch changes inside a note that is already ringing, and the pitch path is
// what notices them. Saying that plainly here so nobody later reads a missing
// attack on a legato run as a bug.
//
// The comparison is against a *delayed* copy of the signal's own peak envelope,
// which is what makes the rest of it hold together:
//
//   - A note decaying, however fast or slow, is always at or below where it was
//     twelve milliseconds ago, so a decay can never look like a strike. No
//     level threshold is involved, so there is nothing for a wobbling envelope
//     to cross twice.
//   - The reference is a peak-hold, not an average. Rectified |sample| of a low
//     B swings to zero and back thirty times a second, and an averaging
//     reference would ride that ripple down into the gaps and read the next
//     upswing as a new note.
//   - A held chord reads as exactly 1.0 against itself, so it fires once and
//     then stays quiet for as long as it rings.
//
// The honest limit is repeated picking of the same string, at the same
// strength, faster than the string decays — around thirty notes a second the
// rise stops clearing `riseRatio` and attacks start being missed rather than
// invented. Missing is the right direction to fail in for evidence.

export interface AttackDetectorOptions {
  sampleRate: number
  /** Below this level a rise is room noise or handling, not a note. */
  floorLevel?: number
  /** How far above where it just was the signal must jump to count as a strike. */
  riseRatio?: number
  /** After an attack, ignore further ones for this long. */
  refractoryMs?: number
  /** Peak-hold decay on the current level — just enough to ignore a single spike. */
  holdMs?: number
  /** Peak-hold decay on the reference. Must outlast one cycle of the lowest string. */
  referenceHoldMs?: number
  /** How far back the reference looks. Shorter is more sensitive and more jumpy. */
  referenceDelayMs?: number
}

export interface DetectedAttack {
  /** Samples from the start of the block this attack was found in. */
  offsetSamples: number
  /** Signal level at the crossing. */
  level: number
  /** What it was measured against — the level twelve or so milliseconds earlier. */
  reference: number
}

export interface AttackDetector {
  /** Scan one block. Returns every attack inside it, in order. */
  process(block: Float32Array): readonly DetectedAttack[]
  /** The reference level — what the detector currently hears as background. */
  floor(): number
  /** Loudest sample of the last block, for a level meter and clip warning. */
  peak(): number
  reset(): void
}

/** Per-sample decay factor for a peak-hold with the given half-life-ish constant. */
export function holdDecayFactor(timeMs: number, sampleRate: number): number {
  if (!(timeMs > 0) || !(sampleRate > 0)) return 0
  return Math.exp(-1000 / (timeMs * sampleRate))
}

export function createAttackDetector(
  options: AttackDetectorOptions,
): AttackDetector {
  const sampleRate = options.sampleRate > 0 ? options.sampleRate : 48000
  const floorLevel = options.floorLevel ?? 0.02
  const riseRatio = options.riseRatio ?? 1.35
  const refractorySamples = Math.max(
    1,
    Math.round(((options.refractoryMs ?? 45) / 1000) * sampleRate),
  )
  const currentDecay = holdDecayFactor(options.holdMs ?? 6, sampleRate)
  const referenceDecay = holdDecayFactor(
    options.referenceHoldMs ?? 140,
    sampleRate,
  )
  const delaySamples = Math.max(
    1,
    Math.round(((options.referenceDelayMs ?? 12) / 1000) * sampleRate),
  )

  // Allocated once. This runs inside an audio render quantum, where allocating
  // is how you get a dropout.
  const delayLine = new Float32Array(delaySamples)
  let delayCursor = 0
  let current = 0
  let envelope = 0
  let peakLevel = 0
  let refractoryLeft = 0

  return {
    process(block) {
      const attacks: DetectedAttack[] = []
      let blockPeak = 0

      for (let index = 0; index < block.length; index += 1) {
        const magnitude = Math.abs(block[index] ?? 0)
        if (magnitude > blockPeak) blockPeak = magnitude

        current = Math.max(magnitude, current * currentDecay)
        envelope = Math.max(magnitude, envelope * referenceDecay)

        const reference = delayLine[delayCursor] ?? 0
        delayLine[delayCursor] = envelope
        delayCursor = delayCursor + 1 === delaySamples ? 0 : delayCursor + 1

        if (refractoryLeft > 0) {
          refractoryLeft -= 1
          continue
        }
        if (current >= floorLevel && current >= reference * riseRatio) {
          attacks.push({ offsetSamples: index, level: current, reference })
          refractoryLeft = refractorySamples
        }
      }

      peakLevel = blockPeak
      return attacks
    },
    floor: () => envelope,
    peak: () => peakLevel,
    reset() {
      delayLine.fill(0)
      delayCursor = 0
      current = 0
      envelope = 0
      peakLevel = 0
      refractoryLeft = 0
    },
  }
}
