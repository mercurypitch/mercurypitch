// ============================================================
// The room slider, with a live view of what it is letting through
// ============================================================
//
// Asked for after testing in a noisy room: the Noisy preset was too
// restrictive ("it needs my mouth close to the mic and very loud"), Home was
// not restrictive enough, and there was nothing in between — nor any way to
// see the effect of a choice without going away and singing.
//
// So: one slider from Quiet to Noisy, the room it currently reads as shown
// above it, and beneath it the input meter plus how much of the last ten
// seconds actually cleared the gate. Moving the slider changes that number
// while you watch, which is the part that makes it tunable instead of a guess.
//
// One component, mounted in both the sidebar mic panel and the Settings page,
// so the two surfaces cannot drift apart.

import type { JSX } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { describeSensitivityPosition, SENSITIVITY_STOPS, sensitivityConfigAt, sensitivityPresetLabel, } from '@/lib/sensitivity-scale'
import { readSignalQuality } from '@/lib/signal-quality'
import { micActive } from '@/stores/mic-store'
import { applySensitivityPosition, sensitivityPosition, } from '@/stores/settings-store'
import { MicLevelMeter } from './MicLevelMeter'
import styles from './MicSensitivitySlider.module.css'

/** How often the pass-rate readout refreshes. Fast enough to feel live. */
const MONITOR_POLL_MS = 500

/**
 * Below this many frames the window has not seen enough to report a share.
 * A "0% getting through" built from two frames is noise presented as fact.
 */
const MIN_FRAMES_FOR_SHARE = 12

export function MicSensitivitySlider(props: {
  /** Bar and ticks only — for the narrow sidebar panel. */
  compact?: boolean
}): JSX.Element {
  const [passShare, setPassShare] = createSignal(0)
  /** False until the window holds enough frames to quote a share honestly. */
  const [measured, setMeasured] = createSignal(false)

  onMount(() => {
    const timer = setInterval(() => {
      const snapshot = readSignalQuality()
      const total = snapshot.acceptedFrames + snapshot.rejectedFrames
      const enough = total >= MIN_FRAMES_FOR_SHARE
      setMeasured(enough)
      if (enough) setPassShare(snapshot.acceptedFrames / total)
    }, MONITOR_POLL_MS)
    onCleanup(() => clearInterval(timer))
  })

  const position = () => sensitivityPosition()
  const gate = () => sensitivityConfigAt(position()).minAmplitude

  return (
    <div class={styles.wrap}>
      <div class={styles.headingRow}>
        <span class={styles.heading}>Room</span>
        <span class={styles.reading} data-testid="sensitivity-reading">
          {describeSensitivityPosition(position())}
        </span>
      </div>

      <input
        type="range"
        class={styles.slider}
        min={0}
        max={100}
        step={5}
        value={position()}
        aria-label="Room noise"
        aria-valuetext={describeSensitivityPosition(position())}
        onInput={(e) => {
          applySensitivityPosition(Number(e.currentTarget.value))
        }}
      />

      <div class={styles.ticks} aria-hidden="true">
        <For each={SENSITIVITY_STOPS}>
          {(stop) => (
            <button
              type="button"
              class={styles.tick}
              classList={{ [styles.tickActive!]: position() === stop.position }}
              onClick={() => {
                applySensitivityPosition(stop.position)
              }}
              tabIndex={-1}
            >
              {sensitivityPresetLabel(stop.preset)}
            </button>
          )}
        </For>
      </div>

      {/* The live half. Armed only while the mic is on: a silence warning
          under a microphone nobody switched on is a false alarm. */}
      <Show when={micActive()}>
        <div class={styles.monitor}>
          <MicLevelMeter
            label="What we're hearing"
            armed
            compact={props.compact}
          />
          <p class={styles.passLine}>
            <Show
              when={measured()}
              fallback={
                <span class={styles.passMuted}>
                  Sing to see how much gets through
                </span>
              }
            >
              <span
                class={styles.passValue}
                classList={{ [styles.passLow!]: passShare() < 0.25 }}
              >
                {Math.round(passShare() * 100)}%
              </span>{' '}
              <span class={styles.passMuted}>
                of the last 10s cleared the gate
              </span>
            </Show>
          </p>
        </div>
      </Show>

      <p class={styles.hint}>
        Further right ignores more of the room, and more of you with it. The
        gate sits at {gate()} of 10.
      </p>
    </div>
  )
}

export default MicSensitivitySlider
