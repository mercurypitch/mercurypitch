// ============================================================
// Why there is no percent here — the rulers, in two paragraphs.
// The rack's panel says it on the web; the native room's "?" says
// it too, in the same words.
// ============================================================

import type { JSX } from 'solid-js'

export function RulersNote(): JSX.Element {
  return (
    <>
      <p>
        Adaptive drills hold everyone near 75% correct forever, so a score can
        never show growth. The Ear Lab reports thresholds in real units (cents,
        milliseconds, notes) that keep falling, and ratings against items of
        frozen difficulty that keep rising.
      </p>
      <p>
        Calibration re-measures you on a sealed protocol. The marks on the glass
        are earned, not estimated; practice only ever draws the fainter line
        above them.
      </p>
    </>
  )
}
