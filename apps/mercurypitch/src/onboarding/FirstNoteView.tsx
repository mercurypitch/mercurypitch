// ============================================================
// FirstNoteView: the first note on screen (S7b beats 2 and 3)
// ============================================================
//
// Top to bottom: Merc's line in a bubble, Merc on a lit spot, the lane the
// voice draws on, and the foot: the mic with what a tap does and the house
// promise, the mic's notice when it would not open, or Start singing once
// the note is named. The controller (useFirstNote.ts) decides; this draws.
//
// Merc's line is read out once, from a polite live region; the bubble
// itself is hidden from a screen reader so it is not read twice. Merc is
// decorative (MercView is aria-hidden).

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

export interface FirstNoteViewProps {
  controller: FirstNoteController
  /** Start singing: the beat is over. */
  onFinish: () => void
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

export function FirstNoteView(props: FirstNoteViewProps): JSX.Element {
  const phase = () => props.controller.state().phase
  const note = () => props.controller.state().note?.note ?? null
  const said = () => lineText(props.controller.line(), note())
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
      <span
        class={styles.said}
        aria-live="polite"
        data-testid="onboarding-said"
      >
        {said() ?? ''}
      </span>

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
            <button
              type="button"
              class={styles.primary}
              onClick={() => props.onFinish()}
              data-testid="onboarding-start-singing"
            >
              {ONBOARDING_COPY.startSinging}
            </button>
          </Match>
          <Match when={phase() === 'blocked'}>
            <MicBlocked
              block={props.controller.state().block}
              onRetry={() => props.controller.retry()}
              retryTestId="onboarding-retry"
            />
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
            <p
              class={styles.fine}
              classList={{ [styles.away]: !before() }}
              data-testid="onboarding-priming"
            >
              {ONBOARDING_COPY.listens}
            </p>
          </Match>
        </Switch>
        <p class={styles.promise}>
          <LockIcon size={14} /> {ONBOARDING_COPY.private}
        </p>
      </div>
    </div>
  )
}
