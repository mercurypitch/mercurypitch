// ============================================================
// FirstNoteView: the first note on screen (S7b beats 2 and 3)
// ============================================================
//
// Top to bottom: Merc's line in a bubble, Merc on a lit spot, the lane the
// voice draws on, and the foot: the mic with what a tap does and the house
// promise, the mic's notice when it would not open, or, once the note is
// named, its two ways on: Find my range and Skip for now (S7b §6.1). On a
// phone that already keeps a range (saved-range.ts), they are See my voice,
// which reveals it, and Find my range again. The controller
// (useFirstNote.ts) decides; this draws.
//
// Merc's line is read out by the layer's one live region (noteSays); the
// bubble itself is hidden from a screen reader so it is not read twice.
// Merc is decorative (MercView is aria-hidden).

import type { JSX } from 'solid-js'
import { createSignal, Match, onCleanup, onMount, Show, Switch } from 'solid-js'
import { GlideRibbon } from '@/components/room-kit/GlideRibbon'
import { MicBlocked, MicButton } from '@/components/room-kit/RoomControls'
import { LockIcon } from '../shell/icons'
import type { NoteLine } from './first-note-machine'
import styles from './NativeOnboarding.module.css'
import type { LaneBox } from './note-lane'
import { laneFor } from './note-lane'
import { heardLine, ONBOARDING_COPY } from './onboarding-copy'
import type { FirstNoteController } from './useFirstNote'
import { WithoutMic } from './WithoutMic'

export interface FirstNoteViewProps {
  controller: FirstNoteController
  /** A refused or failed mic's one way on (WithoutMic.tsx): the
   *  onboarding's, and none for the range on its own. */
  onWithoutMic?: () => void
  /** Merc's line in the bubble (noteSays), or null for none. */
  line: string | null
  /** Find my range: on to the range, the mic opened inside this tap. */
  onRange: () => void
  /** Skip for now: the range is left for later. */
  onSkip: () => void
  /**
   * See my voice, on a phone that already keeps a range: its reveal. While
   * it is given, the second way on is Find my range again (`onRange`), and
   * there is no Skip for now.
   */
  onSeeSaved?: () => void
  /** The range was skipped: its two buttons go while Merc has his word. */
  skipped: boolean
  /** Merc: the layer's own view of him. */
  merc: JSX.Element
}

/** Merc's line, in words. */
function lineText(line: NoteLine | null, note: string | null): string | null {
  switch (line) {
    case null:
      return null
    case 'hello':
      return ONBOARDING_COPY.hello
    case 'ask':
      return ONBOARDING_COPY.ask
    case 'hold':
      return ONBOARDING_COPY.hold
    case 'nudge':
      return ONBOARDING_COPY.nudge
    case 'wandered':
      return ONBOARDING_COPY.wandered
    case 'missed':
      return ONBOARDING_COPY.missed
    case 'heard':
      return note === null ? null : heardLine(note)
  }
}

/** What Merc says on the first note, for the bubble and the live region. */
export function noteSays(controller: FirstNoteController): string | null {
  return lineText(controller.line(), controller.state().note?.note ?? null)
}

export function FirstNoteView(props: FirstNoteViewProps): JSX.Element {
  const phase = () => props.controller.state().phase
  const note = () => props.controller.state().note?.note ?? null
  const said = () => props.line
  const before = () => phase() === 'hello' || phase() === 'missed'

  const micLabel = (): string => {
    switch (phase()) {
      case 'starting':
        return ONBOARDING_COPY.opening
      case 'listen':
        return ONBOARDING_COPY.listening
      default:
        return ONBOARDING_COPY.sing
    }
  }

  // The lane's box, measured: the ribbon's canvases are sized to it.
  let laneEl: HTMLDivElement | undefined
  const [box, setBox] = createSignal<LaneBox | null>(null)
  const measure = (): void => {
    if (laneEl === undefined) return
    const rect = laneEl.getBoundingClientRect()
    const width = Math.round(rect.width)
    const height = Math.round(rect.height)
    const now = box()
    if (now !== null && now.width === width && now.height === height) return
    setBox(width > 0 && height > 0 ? laneFor(width, height) : null)
    props.controller.redraw()
  }
  onMount(() => {
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      onCleanup(() => window.removeEventListener('resize', measure))
      return
    }
    const observer = new ResizeObserver(measure)
    if (laneEl !== undefined) observer.observe(laneEl)
    onCleanup(() => observer.disconnect())
  })

  return (
    <div class={styles.beat} data-phase={phase()}>
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

        <div class={styles.merc}>{props.merc}</div>

        <div
          ref={laneEl}
          class={styles.lane}
          classList={{ [styles.laneAway]: phase() === 'heard' }}
          data-testid="onboarding-lane"
        >
          <GlideRibbon
            width={box()?.width ?? 1}
            height={box()?.height ?? 1}
            scale={(box()?.width ?? 390) / 390}
            class={styles.ribbon}
            testId="onboarding-ribbon"
            glowTestId="onboarding-ribbon-glow"
            onReady={(api) => {
              props.controller.attachLane({ box, draw: api.draw })
            }}
          />
          <Show when={box()}>
            {(lane) => (
              <span
                class={styles.head}
                style={{ left: `${lane().headX}px` }}
                aria-hidden="true"
              />
            )}
          </Show>
          <Show when={props.controller.demo()}>
            <span class={styles.example} data-testid="onboarding-example">
              {ONBOARDING_COPY.example}
            </span>
          </Show>
          <Show when={phase() === 'heard' ? note() : null}>
            {(name) => (
              <p class={styles.note} data-testid="onboarding-note">
                {name()}
              </p>
            )}
          </Show>
        </div>
      </div>

      <div class={styles.foot}>
        <Switch>
          <Match when={phase() === 'heard'}>
            {/* Kept in the flow once skipped, so the stage stays put while
                Merc says it is there for later. */}
            <div
              class={styles.ways}
              classList={{ [styles.away]: props.skipped }}
              inert={props.skipped}
            >
              <Show
                when={props.onSeeSaved}
                fallback={
                  <>
                    <button
                      type="button"
                      class={styles.primary}
                      onClick={() => props.onRange()}
                      data-testid="onboarding-find-range"
                    >
                      {ONBOARDING_COPY.findRange}
                    </button>
                    <button
                      type="button"
                      class={styles.secondary}
                      onClick={() => props.onSkip()}
                      data-testid="onboarding-skip"
                    >
                      {ONBOARDING_COPY.skip}
                    </button>
                  </>
                }
              >
                {(see) => (
                  <>
                    <button
                      type="button"
                      class={styles.primary}
                      onClick={() => see()()}
                      data-testid="onboarding-see-saved"
                    >
                      {ONBOARDING_COPY.seeVoice}
                    </button>
                    <button
                      type="button"
                      class={styles.secondary}
                      onClick={() => props.onRange()}
                      data-testid="onboarding-find-range"
                    >
                      {ONBOARDING_COPY.findRangeAgain}
                    </button>
                  </>
                )}
              </Show>
            </div>
          </Match>
          <Match when={phase() === 'blocked'}>
            <MicBlocked
              block={props.controller.state().block}
              onRetry={() => props.controller.retry()}
              retryTestId="onboarding-retry"
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
            {/* One slot under the caption, a button high whatever it holds,
                so the mic stays put: what the mic is for before the first
                take; once two takes have missed, Continue without the mic,
                as a refused mic has, so a mic that opens and cannot hear
                the singer is never a dead end. Shown only while the mic is
                down: a tap on the mic takes it away. */}
            <div class={styles.slot}>
              <Show
                when={phase() === 'missed' && props.onWithoutMic !== undefined}
                fallback={
                  <p
                    class={styles.fine}
                    classList={{ [styles.away]: !before() }}
                    data-testid="onboarding-priming"
                  >
                    {ONBOARDING_COPY.listens}
                  </p>
                }
              >
                <WithoutMic onWithoutMic={props.onWithoutMic} />
              </Show>
            </div>
          </Match>
        </Switch>
        <p class={styles.promise}>
          <LockIcon size={14} /> {ONBOARDING_COPY.private}
        </p>
      </div>
    </div>
  )
}
