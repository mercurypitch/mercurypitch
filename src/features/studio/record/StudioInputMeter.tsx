// Studio input meter — the armed microphone's level, -60 to 0 dBFS, moved by one transform so a busy take costs no layout.
import styles from './StudioRecord.module.css'

const FLOOR_DB = -60

/** A peak as the meter's fill: -60 dBFS and below empty, full scale full. */
export function studioInputMeterFill(peak: number): number {
  if (!(peak > 0)) return 0
  const db = 20 * Math.log10(Math.min(1, peak))
  return Math.max(0, Math.min(1, (db - FLOOR_DB) / -FLOOR_DB))
}

export function StudioInputMeter(props: { level: number }) {
  return (
    <span class={styles.meter} role="img" aria-label="Microphone level">
      <span
        class={styles.meterFill}
        style={{ '--level': String(studioInputMeterFill(props.level)) }}
      />
    </span>
  )
}
