// ============================================================
// RangeView: the range on screen (S7b beat 4)
// ============================================================
//
// Top to bottom: Merc's line in a bubble; the climb, which is Merc riding
// beside a ladder of rungs at the voice's height, the rungs the voice dwelt
// on lit, and the two pins (the lowest note, then the highest) that lock
// when the range is measured; and the foot: the mic, the mic's notice when
// it would not open, or See my voice once the range is measured. The
// controller (useRange.ts) decides; this draws.
//
// Merc's line is read out by the layer's one live region (rangeSays); the
// bubble is hidden from a screen reader so it is not read twice. The ladder
// is a picture of what the line says, so it is hidden too, and Merc is
// decorative (MercView is aria-hidden).

import type { JSX } from 'solid-js'
import { createMemo, For, Match, Show, Switch } from 'solid-js'
import { MicBlocked, MicButton } from '@/components/room-kit/RoomControls'
import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import styles from './NativeOnboarding.module.css'
import { micBlockedLine, ONBOARDING_COPY, rangeLine } from './onboarding-copy'
import type { LadderView } from './range-ladder'
import { heightOf, pinName, rungColour, rungLit, rungsOf } from './range-ladder'
import type { RangeLine } from './range-machine'
import type { RangeController } from './useRange'
import { WithoutMic } from './WithoutMic'

export interface RangeViewProps {
  controller: RangeController
  /** A refused or failed mic's one way on (WithoutMic.tsx): the
   *  onboarding's, and none for the range on its own. */
  onWithoutMic?: () => void
  /** Merc's line in the bubble (rangeSays), or null for none. */
  line: string | null
  /** See my voice: on to the reveal. */
  onSee: () => void
  /**
   * Skip for now, offered while the mic is down. Only in the onboarding:
   * opened from Keep, Not now is the way back to it.
   */
  onSkip?: () => void
  /** The range was skipped: the foot goes still while Merc has his word. */
  skipped: boolean
  /** Merc: the layer's own view of him. */
  merc: JSX.Element
}

/** Merc's line, in words. */
function lineText(
  line: RangeLine | null,
  low: string | null,
  high: string | null,
  block: CaptureFailure | null,
): string | null {
  switch (line) {
    case null:
      return null
    case 'slide-down':
      return ONBOARDING_COPY.slideDown
    case 'slide-up':
      return ONBOARDING_COPY.slideUp
    case 'slide-down-nudge':
      return ONBOARDING_COPY.slideDownNudge
    case 'slide-up-nudge':
      return ONBOARDING_COPY.slideUpNudge
    case 'range':
      return low === null || high === null ? null : rangeLine(low, high)
    case 'unheard':
      return ONBOARDING_COPY.unheard
    case 'narrow':
      return ONBOARDING_COPY.narrow
    case 'blocked':
    case 'still-blocked':
      return micBlockedLine(block, line === 'still-blocked')
  }
}

/** What Merc says on the range, for the bubble and the live region. */
export function rangeSays(controller: RangeController): string | null {
  const { range, block } = controller.state()
  return lineText(
    controller.line(),
    range?.lowNote ?? null,
    range?.highNote ?? null,
    block,
  )
}

/** A height on the ladder, as the CSS the climb positions things with. */
const at = (height: number): JSX.CSSProperties => ({
  '--at': height.toFixed(4),
})

export function RangeView(props: RangeViewProps): JSX.Element {
  const phase = () => props.controller.state().phase
  const said = () => props.line
  const ladder = (): LadderView => props.controller.ladder()
  const rungs = createMemo(() => rungsOf(ladder().span))
  const idle = () => phase() === 'ready' || phase() === 'missed'

  const micLabel = (): string => {
    switch (phase()) {
      case 'starting':
        return ONBOARDING_COPY.opening
      case 'down':
      case 'up':
        return ONBOARDING_COPY.listening
      default:
        return ONBOARDING_COPY.findRange
    }
  }

  /** Merc's height: the voice's, or the foot's while he keeps still. */
  const riding = (): number => {
    const voice = ladder().voice
    if (props.controller.still() || voice === null) return 0
    return heightOf(voice, ladder().span)
  }

  /** The pins: the low one from the first slide, the high one after it. */
  const lowPin = () => ladder().low
  const highPin = () => (phase() === 'down' ? null : ladder().high)

  return (
    <div
      class={styles.beat}
      data-phase={phase()}
      data-testid="onboarding-range"
    >
      <div class={styles.stage}>
        <div class={styles.bubbleRow}>
          <Show when={said()}>
            {(text) => (
              <p
                class={styles.bubble}
                aria-hidden="true"
                data-testid="onboarding-line"
              >
                {text()}
              </p>
            )}
          </Show>
        </div>

        <div
          class={styles.climb}
          classList={{ [styles.still]: props.controller.still() }}
          data-locked={ladder().locked ? 'on' : 'off'}
          data-testid="onboarding-ladder"
        >
          <div class={styles.rider} style={at(riding())}>
            {props.merc}
          </div>
          <ol class={styles.ladder} aria-hidden="true">
            <For each={rungs()}>
              {(rung) => {
                const height = () => heightOf(rung, ladder().span)
                const lit = () => rungLit(rung, ladder())
                return (
                  <li
                    class={styles.rung}
                    classList={{ [styles.rungLit]: lit() }}
                    style={{
                      ...at(height()),
                      '--rung': rungColour(height()),
                    }}
                    data-midi={rung}
                    data-lit={lit() ? 'on' : 'off'}
                  />
                )
              }}
            </For>
          </ol>
          <div class={styles.pins} aria-hidden="true">
            <Show when={lowPin()}>
              {(low) => (
                <span
                  class={`${styles.pin} ${styles.pinLow}`}
                  style={at(heightOf(low(), ladder().span))}
                  data-testid="onboarding-pin-low"
                >
                  {pinName(low())}
                </span>
              )}
            </Show>
            <Show when={highPin()}>
              {(high) => (
                <span
                  class={`${styles.pin} ${styles.pinHigh}`}
                  style={at(heightOf(high(), ladder().span))}
                  data-testid="onboarding-pin-high"
                >
                  {pinName(high())}
                </span>
              )}
            </Show>
          </div>
        </div>
      </div>

      <div class={styles.foot}>
        {/* Kept in the flow once skipped, so nothing moves while Merc has
            his word; out of reach until the layer goes. */}
        <div
          class={styles.footBody}
          classList={{ [styles.away]: props.skipped }}
          inert={props.skipped}
        >
          <Switch>
            <Match when={phase() === 'done'}>
              <button
                type="button"
                class={styles.primary}
                onClick={() => props.onSee()}
                data-testid="onboarding-see-voice"
              >
                {ONBOARDING_COPY.seeVoice}
              </button>
            </Match>
            <Match when={phase() === 'blocked'}>
              <MicBlocked
                block={props.controller.state().block}
                onRetry={() => props.controller.retry()}
                retryTestId="onboarding-retry"
                saidBy="merc"
              />
              <WithoutMic onWithoutMic={props.onWithoutMic} />
            </Match>
            <Match when={true}>
              <div class={styles.micWell}>
                <MicButton
                  state={props.controller.micState()}
                  level={props.controller.level}
                  pulse={false}
                  still={props.controller.still()}
                  disabled={false}
                  label={micLabel()}
                  onClick={() => props.controller.tapMic()}
                  testId="onboarding-mic"
                />
              </div>
              <p class={styles.caption} aria-hidden="true">
                {micLabel()}
              </p>
              {/* One slot under the caption, a button high whatever it
                  holds, so the mic stays put: Skip for now while the mic is
                  down in the onboarding; else, before the first slide, what
                  the mic is for; else nothing. */}
              <div class={styles.slot}>
                <Show
                  when={idle() && props.onSkip !== undefined}
                  fallback={
                    <p
                      class={styles.fine}
                      classList={{ [styles.away]: phase() !== 'ready' }}
                      data-testid="onboarding-priming"
                    >
                      {ONBOARDING_COPY.listens}
                    </p>
                  }
                >
                  <button
                    type="button"
                    class={styles.secondary}
                    onClick={() => props.onSkip?.()}
                    data-testid="onboarding-skip"
                  >
                    {ONBOARDING_COPY.skip}
                  </button>
                </Show>
              </div>
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  )
}
