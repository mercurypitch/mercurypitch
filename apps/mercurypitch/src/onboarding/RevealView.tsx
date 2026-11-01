// ============================================================
// RevealView: the voiceprint on screen (S7b beat 5)
// ============================================================
//
// Two cards, one after the other. The voice's own first: the print
// (voiceprint-art.ts) drawing in as the card rises, the voice type as the
// headline ("You're a baritone", the type the range overlaps most), and
// the range in words under it ("F2 to G♯4 · about two octaves"): note
// names mean little to most people, so the type leads and the span says
// how wide in plain words. A range no type overlaps is "Your voice".
// Then, as the print finishes (useReveal.ts TWIN_MS), the twin enters as
// a card of its own: the legend's portrait, "Your voice twin", the name,
// and "You share a range with David Bowie.", with Merc's cheer and a light
// haptic on that beat. Its place is kept from the start, so nothing moves
// when it enters. Under it, Merc in his guide slot with his line, then
// Continue, full width, and Share as a plain button under it (concept 04).
// No glass game: that is V1.1 (S7b E7).
//
// The body scrolls on a phone too short for it, and its edges fade where
// there is more to see (scroll-edge.ts); Continue and Share stay put.
//
// Merc's line is read out by the layer's one live region; the bubble is
// hidden from a screen reader. The print and the twin's face are pictures
// of what the cards say in words, and the twin's name is text.

import type { JSX } from 'solid-js'
import { createMemo, For, onCleanup, onMount, Show } from 'solid-js'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import type { RangeResult } from '@/lib/mirror/metrics'
import { singerForRange } from '@/lib/mirror/singer-match'
import { watchScrollEdges } from '../shell/scroll-edge'
import styles from './NativeOnboarding.module.css'
import { ONBOARDING_COPY, rangeSubline, twinLine, voiceHeadline, } from './onboarding-copy'
import type { RevealController } from './useReveal'
import { TWIN_TIER } from './useReveal'
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

  let body: HTMLDivElement | undefined
  onMount(() => {
    if (body !== undefined) onCleanup(watchScrollEdges(body))
  })

  return (
    <div class={styles.beat} data-testid="onboarding-reveal">
      <div
        ref={body}
        class={`${styles.revealBody} ${styles.edgeFade}`}
        data-testid="onboarding-reveal-body"
      >
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
          <h2 class={styles.cardTitle} data-testid="onboarding-card-type">
            {voiceHeadline(props.range.voiceHint)}
          </h2>
          <p class={styles.cardRange} data-testid="onboarding-card-range">
            {rangeSubline(props.range)}
          </p>
        </div>

        <Show when={twin()}>
          {(found) => (
            <div
              class={styles.twinCard}
              data-shown={props.controller.twinShown() ? 'on' : 'off'}
              data-testid="onboarding-twin-card"
            >
              <span class={styles.twinFace} aria-hidden="true">
                <LegendCaricature
                  legend={found()}
                  tier={TWIN_TIER}
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
                <span class={styles.twinLine}>{twinLine(found())}</span>
              </span>
            </div>
          )}
        </Show>

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
