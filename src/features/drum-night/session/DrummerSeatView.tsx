// ============================================================
// Drummer Seat View — playable evidence aligned to the photographed kit
// ============================================================
//
// The photograph is owned by the room shell. This view adds only six semantic
// hit surfaces and restrained target/live evidence, so it must remain
// transparent and must never draw a second kit over the authored room image.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, createUniqueId, For, Show } from 'solid-js'
import { barIndexAtBeat } from '@/lib/midi-bars'
import type { EssentialDrumPadId } from '../runtime/drum-pad-layout'
import { essentialDrumPad } from '../runtime/drum-pad-layout'
import type { DrumScoreIndex, DrumSeatAnchor } from './drum-score'
import { createDrumScoreIndex, drumScoreEventsNearBeat, drumScoreNextEvent, drumScoreVoiceForGmKey, } from './drum-score'
import type { DrumSessionImportState } from './drum-session'
import { readyDrumSessionDocument } from './drum-session'
import styles from './DrumNightSessionViews.module.css'

export interface DrumSeatLiveHit {
  readonly id?: string
  readonly gmKey: number
  readonly velocity: number
}

export interface DrummerSeatViewProps {
  session: Accessor<DrumSessionImportState>
  playheadBeat: Accessor<number>
  /** Reuse one whole-song index across score, seat and coaching surfaces. */
  scoreIndex?: Accessor<DrumScoreIndex | null>
  /** Current live attacks, already bounded by the owning runtime. */
  liveHits?: Accessor<readonly DrumSeatLiveHit[]>
  /** Optional strike seam; the route remains the sole owner of audio. */
  onStrike?: (padId: EssentialDrumPadId, velocity: number) => void
}

interface SeatPad {
  readonly id: EssentialDrumPadId
  readonly anchors: readonly DrumSeatAnchor[]
}

const SEAT_PADS: readonly SeatPad[] = [
  { id: 'hi-hat', anchors: ['hi-hat'] },
  { id: 'snare', anchors: ['snare'] },
  { id: 'kick', anchors: ['kick'] },
  { id: 'tom', anchors: ['tom-left', 'tom-centre', 'tom-right'] },
  { id: 'ride', anchors: ['ride'] },
  { id: 'crash', anchors: ['crash'] },
]

function nextTargetCopy(index: DrumScoreIndex, playheadBeat: number): string {
  const next = drumScoreNextEvent(index, playheadBeat)
  return next === null
    ? 'No later authored hit'
    : `Next ${next.voice.label} · bar ${next.barIndex + 1}`
}

function labelsCopy(labels: readonly string[]): string {
  return labels.length === 0 ? 'none' : labels.join(', ')
}

function sessionStateCopy(state: DrumSessionImportState): string {
  switch (state.status) {
    case 'loading':
      return `Reading ${state.fileName} · free play stays available`
    case 'ready':
      return `${state.document.sourceFormat.toUpperCase()} · ${state.document.fileName}`
    case 'empty':
      return `${state.fileName} has no playable events · free play`
    case 'no-drums':
      return `${state.fileName} has no drum track · free play`
    case 'too-large':
      return `${state.fileName} is too large to open · free play`
    case 'unsupported':
      return `${state.fileName} has no safe drum mapping · free play`
    case 'error':
      return `${state.fileName} could not be opened · free play`
    case 'idle':
      return 'No authored part · free play'
  }
}

function pointerVelocity(event: PointerEvent): number {
  const pressure = event.pressure > 0 ? event.pressure : 0.72
  return Math.round(48 + Math.min(1, pressure) * 79)
}

function acceptsPadPointer(event: PointerEvent): boolean {
  return event.button === 0 && event.isPrimary !== false
}

export function DrummerSeatView(props: DrummerSeatViewProps): JSX.Element {
  const titleId = `drummer-seat-title-${createUniqueId()}`
  const descriptionId = `drummer-seat-description-${createUniqueId()}`
  const document = createMemo(() => readyDrumSessionDocument(props.session()))
  const index = createMemo(() => {
    const provided = props.scoreIndex?.()
    if (provided !== undefined && provided !== null) return provided
    const current = document()
    return current === null ? null : createDrumScoreIndex(current)
  })
  const score = createMemo(() => index()?.score ?? null)
  const activeTargetQuery = createMemo(() => {
    const current = index()
    return current === null
      ? null
      : drumScoreEventsNearBeat(current, props.playheadBeat())
  })
  const activeTargets = createMemo(() => activeTargetQuery()?.events ?? [])
  const targetAnchors = createMemo(
    () => new Set(activeTargets().map((event) => event.voice.seatAnchor)),
  )
  const targetLabels = createMemo(() => [
    ...new Set(activeTargets().map((event) => event.voice.label)),
  ])
  const liveVoices = createMemo(() =>
    (props.liveHits?.() ?? [])
      .filter(
        (hit) =>
          Number.isInteger(hit.gmKey) && hit.gmKey >= 35 && hit.gmKey <= 81,
      )
      .map((hit) => drumScoreVoiceForGmKey(hit.gmKey)),
  )
  const liveAnchors = createMemo(
    () => new Set(liveVoices().map((voice) => voice.seatAnchor)),
  )
  const liveLabels = createMemo(() => [
    ...new Set(liveVoices().map((voice) => voice.label)),
  ])
  const currentBar = createMemo(() => {
    const current = score()
    return current === null
      ? null
      : barIndexAtBeat(current.bars, props.playheadBeat()) + 1
  })
  const hasAnchor = (
    anchors: ReadonlySet<DrumSeatAnchor>,
    pad: SeatPad,
  ): boolean => pad.anchors.some((anchor) => anchors.has(anchor))

  return (
    <section
      class={styles.seatView}
      aria-labelledby={titleId}
      data-session-state={props.session().status}
    >
      <h2 id={titleId} class={styles.sessionScreenReaderOnly}>
        Playable drummer’s seat
      </h2>
      <p id={descriptionId} class={styles.sessionScreenReaderOnly}>
        Six controls follow the photographed kit. Dashed cyan rings mark the
        authored target and solid amber rings mark recent live input. Target and
        live evidence remain visible together.
      </p>

      <figure class={styles.seatPlayfield}>
        <div
          class={styles.seatHitMap}
          role="group"
          aria-label="Playable photographed drum kit"
          aria-describedby={descriptionId}
        >
          <For each={SEAT_PADS}>
            {(seatPad) => {
              const pad = essentialDrumPad(seatPad.id)
              const targetActive = (): boolean =>
                hasAnchor(targetAnchors(), seatPad)
              const liveActive = (): boolean =>
                hasAnchor(liveAnchors(), seatPad)
              return (
                <button
                  class={styles.seatHit}
                  type="button"
                  data-pad={seatPad.id}
                  data-kit-anchor={seatPad.id}
                  data-target-active={targetActive()}
                  data-live-active={liveActive()}
                  aria-label={`Play ${pad.label}${
                    targetActive() ? ', authored target now' : ''
                  }${liveActive() ? ', live hit now' : ''}`}
                  aria-keyshortcuts={pad.keyboardLabel}
                  onPointerDown={(event) => {
                    if (!acceptsPadPointer(event)) return
                    props.onStrike?.(seatPad.id, pointerVelocity(event))
                  }}
                  onClick={(event) => {
                    if (event.detail === 0) props.onStrike?.(seatPad.id, 100)
                  }}
                >
                  <span
                    class={styles.seatTargetRing}
                    data-visual-layer="authored-target"
                    aria-hidden="true"
                  />
                  <span
                    class={styles.seatLiveRing}
                    data-visual-layer="live-input"
                    aria-hidden="true"
                  />
                  <span class={styles.seatHitLabel} aria-hidden="true">
                    {pad.shortLabel}
                  </span>
                </button>
              )
            }}
          </For>
        </div>
      </figure>

      <div class={styles.seatHud} aria-hidden="true">
        <div class={styles.seatHudLead}>
          <span>{score()?.title ?? 'Free play'}</span>
          <Show when={currentBar() !== null}>
            <small>Bar {currentBar()}</small>
          </Show>
        </div>
        <p>
          {index() === null
            ? sessionStateCopy(props.session())
            : nextTargetCopy(index()!, props.playheadBeat())}
        </p>
        <p class={styles.seatEvidence}>
          Target {labelsCopy(targetLabels())} · Live {labelsCopy(liveLabels())}
        </p>
      </div>

      <Show when={(activeTargetQuery()?.omittedEventCount ?? 0) > 0}>
        <p class={styles.seatMappingNotice}>
          +{activeTargetQuery()?.omittedEventCount} simultaneous authored{' '}
          {(activeTargetQuery()?.omittedEventCount ?? 0) === 1 ? 'hit' : 'hits'}
        </p>
      </Show>
    </section>
  )
}
