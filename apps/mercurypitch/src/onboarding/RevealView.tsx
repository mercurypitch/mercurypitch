// ============================================================
// RevealView: the voiceprint on screen (S7b beat 5)
// ============================================================
//
// Title "Your voice", then the card: the print (voiceprint-art.ts), "Your
// range" and the range in big type, the voice type the range overlaps most
// (a hint, never a verdict: voiceTypeHint), and "Your voice twin": the
// twin's face and name, there from the start (useReveal.ts says why). Under
// it, Merc in his guide slot with his line, then Continue, full width, and
// Share as a plain button under it (concept 04). No glass game: that is
// V1.1 (S7b E7).
//
// Merc's line is read out by the layer's one live region; the bubble is
// hidden from a screen reader. The print and the twin's face are pictures
// of what the card says in words.

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import type { RangeResult } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import styles from './NativeOnboarding.module.css'
import { ONBOARDING_COPY, rangeSpan } from './onboarding-copy'
import type { RevealController } from './useReveal'
import { PRINT_SIZE, voiceprintArt } from './voiceprint-art'

export interface RevealViewProps {
  controller: RevealController
  /** The range just measured. */
  range: RangeResult
  /** Continue: the reveal is over. */
  onContinue: () => void
  /** Merc: the layer's own view of him. */
  merc: JSX.Element
}

export function RevealView(props: RevealViewProps): JSX.Element {
  const twin = () => singerForRange(props.range)
  const art = createMemo(() =>
    voiceprintArt(props.range.lowMidi, props.range.highMidi),
  )
  const centre = PRINT_SIZE / 2

  return (
    <div class={styles.beat} data-testid="onboarding-reveal">
      <div class={styles.revealBody}>
        <h2 class={styles.revealTitle}>{ONBOARDING_COPY.revealTitle}</h2>

        <div class={styles.card} data-testid="onboarding-card">
          <svg
            class={styles.print}
            viewBox={`0 0 ${PRINT_SIZE} ${PRINT_SIZE}`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="onboarding-print-ink"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1={PRINT_SIZE}
                x2="0"
                y2="0"
              >
                <stop offset="0" stop-color="#2dd4bf" />
                <stop offset="0.5" stop-color="#58a6ff" />
                <stop offset="1" stop-color="#bc8cff" />
              </linearGradient>
            </defs>
            <g transform={`rotate(${art().tilt} ${centre} ${centre})`}>
              <For each={art().ridges}>
                {(ridge, index) => (
                  <path
                    d={ridge.d}
                    class={styles.ridge}
                    stroke="url(#onboarding-print-ink)"
                    stroke-opacity={ridge.opacity}
                    pathLength={1}
                    style={{ '--i': index() }}
                  />
                )}
              </For>
            </g>
          </svg>
          <p class={styles.cardLabel}>{ONBOARDING_COPY.yourRange}</p>
          <p class={styles.cardRange} data-testid="onboarding-card-range">
            {rangeSpan(props.range.lowNote, props.range.highNote)}
          </p>
          <Show when={props.range.voiceHint}>
            {(type) => (
              <p class={styles.cardType} data-testid="onboarding-card-type">
                {type()}
              </p>
            )}
          </Show>
          <Show when={twin()}>
            {(found) => (
              <div class={styles.twinRow}>
                <span class={styles.twinFace} aria-hidden="true">
                  <LegendCaricature
                    legend={found()}
                    tier="thumb"
                    class={styles.twinPortrait}
                  />
                </span>
                <span class={styles.twinText}>
                  <span class={styles.twinLabel}>
                    {ONBOARDING_COPY.twinLabel}
                  </span>
                  <strong class={styles.twinName} data-testid="onboarding-twin">
                    {found()}
                  </strong>
                </span>
              </div>
            )}
          </Show>
        </div>

        <div class={styles.guide}>
          <div class={styles.guideMerc}>{props.merc}</div>
          <p
            class={`${styles.bubble} ${styles.guideLine}`}
            aria-hidden="true"
            data-testid="onboarding-line"
          >
            {ONBOARDING_COPY.voiceprint}
          </p>
        </div>
      </div>

      <div class={styles.revealFoot}>
        <button
          type="button"
          class={styles.primary}
          onClick={() => props.onContinue()}
          data-testid="onboarding-continue"
        >
          {ONBOARDING_COPY.continue}
        </button>
        <button
          type="button"
          class={styles.secondary}
          onClick={() => props.controller.share(props.range)}
          data-testid="onboarding-share"
        >
          {ONBOARDING_COPY.share}
        </button>
        {/* In the tree before there is anything to say, or the line is
            never announced. */}
        <p
          class={styles.shareNote}
          role="status"
          aria-live="polite"
          data-testid="onboarding-share-note"
        >
          {props.controller.shareNote() ?? ''}
        </p>
      </div>
    </div>
  )
}
