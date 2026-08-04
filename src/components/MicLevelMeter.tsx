// ============================================================
// MicLevelMeter — what the microphone is actually hearing
// ============================================================
//
// Every mic surface tells the singer the mic is *on*. None of them told them
// it was *working*. This does: a segmented level bar fed by whichever capture
// loop is running (@/lib/mic-level), plus the silence watchdog
// (@/lib/input-health) for the case the bar makes obvious but nobody watches —
// permission granted, stream live, every frame silent.
//
// Mount it only while the mic is held; the parent owns that decision. Polls on
// an interval rather than requestAnimationFrame: rAF is paused in a
// backgrounded tab and in the headless preview, and a meter that silently
// freezes is worse than no meter.

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { armInputHealth, disarmInputHealth, initialInputHealth, observeInputLevel, } from '@/lib/input-health'
import { micLevelFraction, readMicLevel } from '@/lib/mic-level'
import { AlertTriangle } from './icons'
import styles from './MicLevelMeter.module.css'

/** ~15 Hz. Smooth enough to read as live, cheap enough for a phone. */
const POLL_MS = 66

/** Segments in the bar. Enough to read a level at a glance, few enough to
 *  stay legible at toolbar size. */
const SEGMENTS = 14

/** Peak-hold decay, in bar fractions per second. A real meter's peak marker
 *  falls back slowly so a transient stays visible long enough to see. */
const PEAK_DECAY_PER_S = 0.5

export interface MicLevelMeterProps {
  /**
   * The singer has been asked for input, so silence now is a fault rather
   * than a pause. Leave false during briefs, counts-in and reference tones.
   */
  armed?: boolean
  /** Bar only — no caption, no hint. For toolbars and headers. */
  compact?: boolean
  /** Caption above the bar. */
  label?: string
}

export const MicLevelMeter: Component<MicLevelMeterProps> = (props) => {
  const [level, setLevel] = createSignal(0)
  const [peak, setPeak] = createSignal(0)
  const [silent, setSilent] = createSignal(false)

  onMount(() => {
    let health = initialInputHealth()
    let armed = false
    let peakFraction = 0
    let lastAt = performance.now()

    const tick = (): void => {
      const now = performance.now()
      const elapsed = (now - lastAt) / 1000
      lastAt = now

      const rms = readMicLevel(now)
      const fraction = micLevelFraction(rms)
      setLevel(fraction)

      peakFraction = Math.max(
        fraction,
        peakFraction - PEAK_DECAY_PER_S * elapsed,
      )
      setPeak(peakFraction)

      // Arm and disarm from inside the tick so the machine's clock and the
      // level it judges come from the same instant.
      if (props.armed === true && !armed) {
        health = armInputHealth(now)
        armed = true
      } else if (props.armed !== true && armed) {
        health = disarmInputHealth()
        armed = false
      }
      health = observeInputLevel(health, rms, now)
      setSilent(health.status === 'silent')
    }

    const timer = setInterval(tick, POLL_MS)
    tick()
    onCleanup(() => clearInterval(timer))
  })

  /** Fill state of one segment: how much of this segment the level covers. */
  const segmentOn = (index: number): boolean => level() * SEGMENTS > index + 0.5

  const segmentTone = (index: number): string => {
    const at = (index + 1) / SEGMENTS
    if (at > 0.93) return styles.hot
    if (at > 0.82) return styles.warm
    return styles.cool
  }

  const peakIndex = (): number =>
    Math.min(SEGMENTS - 1, Math.floor(peak() * SEGMENTS))

  return (
    <div
      class={`${styles.meter} ${props.compact === true ? styles.compact : ''}`}
      classList={{ [styles.alarm]: silent() }}
    >
      <Show when={props.compact !== true && props.label !== undefined}>
        <span class={styles.label}>{props.label}</span>
      </Show>
      <div
        class={styles.bar}
        role="meter"
        aria-label="Microphone input level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level() * 100)}
      >
        <For each={Array.from({ length: SEGMENTS })}>
          {(_, index) => (
            <span
              class={`${styles.segment} ${segmentTone(index())}`}
              classList={{
                [styles.on]: segmentOn(index()),
                [styles.peak]: peak() > 0.02 && index() === peakIndex(),
              }}
            />
          )}
        </For>
      </div>
      <Show when={props.compact !== true && silent()}>
        <p class={styles.hint}>
          <span class={styles.hintIcon}>
            <AlertTriangle />
          </span>
          No sound is reaching us. Check that the right input is selected and
          that it isn't muted at the system level.
        </p>
      </Show>
    </div>
  )
}

export default MicLevelMeter
