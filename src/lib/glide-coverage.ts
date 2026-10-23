// ============================================================
// glide-coverage — how much of the way between two notes a line glides
// ============================================================
//
// The Siren scores its glide part with this (use-siren-controller.ts).
// vocal-analyzer's detectSlides scores the jumps between a line's steady
// stretches, and a smooth glide has none.

/**
 * The longest time, in seconds, that one step of a glide may span. The
 * frames either side of an unvoiced gap are not a glide, and silence then the
 * far note would otherwise pass as one slow step; a frame or two dropped at
 * 30 frames a second still counts.
 */
const GLIDE_MAX_GAP_S = 0.12

/**
 * How much of the way from one note toward another a line glides, 0 to 1:
 * the share of the span between `fromMidi` and `toMidi` that the frames cross
 * moving toward `toMidi` no faster than `maxRate` semitones a second, each
 * step spanning at most GLIDE_MAX_GAP_S.
 *
 * vocal-analyzer's computeDirectness cannot score a glide window on its
 * own. It draws one straight line across every sample, so a held note with
 * a jump halfway scores 0.75, while a glide that reaches the note early and
 * holds it, or follows the Siren's guide dot there and back, scores about
 * two thirds. Here a jump or a flip crosses ground without gliding it,
 * frames sung an octave away lie outside the span, a held note crosses
 * nothing, and going back over ground already glided neither adds nor
 * takes away.
 *
 * The limit is a rate, read from each frame's `time`, because the frames come
 * at the display's refresh rate: a limit per frame would pass a 3-semitone
 * jump taking 100 ms at 120 Hz and refuse a smooth octave glide at twice the
 * dot's pace at 30 frames a second. The Siren sets the rate from its guide's
 * pace, so it grows with the span, not one rate for every round: a 3-semitone
 * jump moves about as fast as an octave glide at twice the dot's pace. The
 * cost is wide vibrato on the smaller spans, measured on synthetic frames at
 * 30, 60 and 120 a second: on a 3-semitone round ±1 semitone scores about 0.3
 * to 0.4 and ±0.5 about 0.5 to 0.75, and ±1 still scores only about 0.5 to
 * 0.75 on the 5- and 7-semitone rounds.
 */
export function computeGlideCoverage(
  samples: Array<{ midi: number; time: number }>,
  fromMidi: number,
  toMidi: number,
  maxRate: number,
): number {
  const lo = Math.min(fromMidi, toMidi)
  const hi = Math.max(fromMidi, toMidi)
  if (hi - lo < 0.1 || samples.length < 2) return 0
  const toward = Math.sign(toMidi - fromMidi)

  const crossed: Array<[number, number]> = []
  for (let i = 1; i < samples.length; i++) {
    const step = samples[i].midi - samples[i - 1].midi
    const dt = samples[i].time - samples[i - 1].time
    // Written so that a NaN pitch or time glides nothing.
    const glides =
      dt > 0 && dt <= GLIDE_MAX_GAP_S && Math.abs(step) <= maxRate * dt
    if (!glides || step * toward <= 0) continue
    const a = Math.max(lo, Math.min(samples[i - 1].midi, samples[i].midi))
    const b = Math.min(hi, Math.max(samples[i - 1].midi, samples[i].midi))
    if (b > a) crossed.push([a, b])
  }

  // The union of the crossed stretches, so ground glided twice counts once.
  crossed.sort((x, y) => x[0] - y[0])
  let covered = 0
  let runStart = 0
  let runEnd = -Infinity
  for (const [a, b] of crossed) {
    if (a > runEnd) {
      if (runEnd > runStart) covered += runEnd - runStart
      runStart = a
      runEnd = b
    } else {
      runEnd = Math.max(runEnd, b)
    }
  }
  if (runEnd > runStart) covered += runEnd - runStart
  return Math.min(1, covered / (hi - lo))
}
