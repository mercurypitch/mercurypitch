// ============================================================
// DrumPlayLoadMeter — the play button as a progress meter while a song loads
// ============================================================
//
// A play-along song from a UVR session can take a while to decode, or to open
// its stream windows, and a play button that simply waits looks broken. Both
// transports — the console button and the phone bar's — swap their icon for
// this while the load runs: a conic ring that fills with the fraction the
// stem engine reports, or a turning arc while it has no size to report yet.
//
// Tests: DrumPlayLoadMeter.test.tsx

import styles from '../DrumNightApp.module.css'

export interface DrumPlayLoadMeterProps {
  /** 0..1 from the stem engine; null while it has nothing to report. */
  fraction: number | null
}

/** Whole percent for the label, capped so it never reads done before `ready`. */
export function drumPlayLoadPercent(fraction: number | null): number | null {
  if (fraction === null || fraction <= 0) return null
  return Math.min(99, Math.round(fraction * 100))
}

export function DrumPlayLoadMeter(props: DrumPlayLoadMeterProps) {
  const percent = () => drumPlayLoadPercent(props.fraction)
  return (
    <>
      <span
        aria-hidden="true"
        class={styles.playLoadRing}
        classList={{ [styles.playLoadRingSpinning]: percent() === null }}
        style={{ '--load-fraction': String(props.fraction ?? 0) }}
        data-testid="drum-play-load-ring"
      />
      <span
        aria-hidden="true"
        class={styles.playLoadPercent}
        data-testid="drum-play-load-percent"
      >
        {percent() === null ? '' : `${percent()}%`}
      </span>
    </>
  )
}
