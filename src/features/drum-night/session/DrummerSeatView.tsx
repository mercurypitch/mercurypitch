// ============================================================
// Drummer Seat View — top-down kit reading from one indexed session
// ============================================================
//
// The authored part and optional live hits illuminate stable physical kit
// anchors. Target and live states remain separate dashed/solid layers even
// when they land together; this view owns no clock, transport, or classifier.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, createUniqueId, For, Match, Show, Switch } from 'solid-js'
import { barIndexAtBeat } from '@/lib/midi-bars'
import type { DrumScoreIndex, DrumSeatAnchor } from './drum-score'
import { createDrumScoreIndex, drumScoreEventsNearBeat, drumScoreNextEvent, drumScoreVoiceForGmKey, } from './drum-score'
import type { DrumSessionImportState } from './drum-session'
import { readyDrumSessionDocument } from './drum-session'
import styles from './DrumNightSessionViews.module.css'
import { DrumSessionStateView } from './DrumSessionStateView'

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
}

type KitShape = 'cymbal' | 'drum' | 'kick' | 'auxiliary'

interface KitZone {
  readonly anchor: DrumSeatAnchor
  readonly label: string
  readonly shape: KitShape
  readonly cx: number
  readonly cy: number
  readonly rx: number
  readonly ry: number
  readonly rotate?: number
}

const KIT_ZONES: readonly KitZone[] = [
  {
    anchor: 'crash',
    label: 'Crash',
    shape: 'cymbal',
    cx: 142,
    cy: 132,
    rx: 112,
    ry: 31,
    rotate: -15,
  },
  {
    anchor: 'ride',
    label: 'Ride',
    shape: 'cymbal',
    cx: 846,
    cy: 146,
    rx: 118,
    ry: 34,
    rotate: 14,
  },
  {
    anchor: 'hi-hat',
    label: 'Hi-hat',
    shape: 'cymbal',
    cx: 188,
    cy: 326,
    rx: 86,
    ry: 27,
    rotate: -8,
  },
  {
    anchor: 'tom-left',
    label: 'High tom',
    shape: 'drum',
    cx: 405,
    cy: 238,
    rx: 76,
    ry: 58,
  },
  {
    anchor: 'tom-centre',
    label: 'Mid tom',
    shape: 'drum',
    cx: 558,
    cy: 228,
    rx: 81,
    ry: 61,
  },
  {
    anchor: 'tom-right',
    label: 'Floor tom',
    shape: 'drum',
    cx: 720,
    cy: 360,
    rx: 103,
    ry: 79,
  },
  {
    anchor: 'snare',
    label: 'Snare',
    shape: 'drum',
    cx: 332,
    cy: 407,
    rx: 104,
    ry: 76,
  },
  {
    anchor: 'kick',
    label: 'Kick',
    shape: 'kick',
    cx: 525,
    cy: 486,
    rx: 132,
    ry: 105,
  },
  {
    anchor: 'auxiliary',
    label: 'Auxiliary percussion',
    shape: 'auxiliary',
    cx: 823,
    cy: 456,
    rx: 48,
    ry: 40,
  },
]

function nextTargetCopy(index: DrumScoreIndex, playheadBeat: number): string {
  const next = drumScoreNextEvent(index, playheadBeat)
  return next === null
    ? 'No later mapped hit within the score range'
    : `Next: ${next.voice.label}, bar ${next.barIndex + 1}`
}

function labelsCopy(labels: readonly string[]): string {
  return labels.length === 0 ? 'none' : labels.join(', ')
}

function ZoneOutline(props: {
  zone: KitZone
  /** Keeps coincident target/live evidence visibly concentric. */
  expansion: number
}): JSX.Element {
  const rx = (): number => Math.max(1, props.zone.rx + props.expansion)
  const ry = (): number => Math.max(1, props.zone.ry + props.expansion)
  return (
    <Switch>
      <Match when={props.zone.shape === 'auxiliary'}>
        <rect
          x={props.zone.cx - rx()}
          y={props.zone.cy - ry()}
          width={rx() * 2}
          height={ry() * 2}
          rx="15"
        />
      </Match>
      <Match when={props.zone.shape !== 'auxiliary'}>
        <ellipse cx={props.zone.cx} cy={props.zone.cy} rx={rx()} ry={ry()} />
      </Match>
    </Switch>
  )
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

  return (
    <Show
      when={score()}
      keyed
      fallback={<DrumSessionStateView state={props.session} context="kit" />}
    >
      {(currentScore) => {
        const currentIndex = index()!
        return (
          <section class={styles.seatView} aria-labelledby={titleId}>
            <header class={styles.viewHeader}>
              <div>
                <span class={styles.viewKicker}>Drummer’s seat</span>
                <h2 id={titleId}>{currentScore.title}</h2>
              </div>
              <p>{currentScore.voices.length} drawable mapped kit voices</p>
            </header>

            <figure
              class={styles.seatFigure}
              tabindex="0"
              aria-label="Scrollable drummer-seat kit"
            >
              <svg
                class={styles.seatSvg}
                viewBox="0 0 1000 620"
                role="img"
                aria-labelledby={`${titleId} ${descriptionId}`}
                preserveAspectRatio="xMidYMid meet"
              >
                <desc id={descriptionId}>
                  Top-down drum kit. Dashed cyan rings mark authored attacks at
                  the shared playhead. Solid amber rings mark current mapped
                  live input. Both rings remain visible when target and live
                  attacks share a kit zone.
                </desc>
                <g class={styles.seatRoom} aria-hidden="true">
                  <path d="M84 92Q500 8 916 92" />
                  <path d="M80 526Q500 608 920 526" />
                  <path d="M500 64V572" />
                </g>
                <g class={styles.kitHardware} aria-hidden="true">
                  <path d="M142 160V476M846 176V500M188 348V515" />
                  <path d="M110 476h64M814 500h64M156 515h64" />
                  <path d="M468 568l-42 34M582 568l42 34" />
                </g>
                <For each={KIT_ZONES}>
                  {(zone) => (
                    <g
                      class={styles.kitZone}
                      data-kit-anchor={zone.anchor}
                      data-target-active={targetAnchors().has(zone.anchor)}
                      data-live-active={liveAnchors().has(zone.anchor)}
                      transform={`rotate(${zone.rotate ?? 0} ${zone.cx} ${zone.cy})`}
                      aria-hidden="true"
                    >
                      <Switch>
                        <Match when={zone.shape === 'cymbal'}>
                          <ellipse
                            cx={zone.cx}
                            cy={zone.cy}
                            rx={zone.rx}
                            ry={zone.ry}
                          />
                          <ellipse
                            class={styles.kitInner}
                            cx={zone.cx}
                            cy={zone.cy}
                            rx={zone.rx * 0.38}
                            ry={zone.ry * 0.34}
                          />
                        </Match>
                        <Match when={zone.shape === 'kick'}>
                          <ellipse
                            cx={zone.cx}
                            cy={zone.cy}
                            rx={zone.rx}
                            ry={zone.ry}
                          />
                          <ellipse
                            class={styles.kitInner}
                            cx={zone.cx}
                            cy={zone.cy + 2}
                            rx={zone.rx * 0.74}
                            ry={zone.ry * 0.74}
                          />
                          <circle
                            class={styles.kickPort}
                            cx={zone.cx + 62}
                            cy={zone.cy + 31}
                            r="18"
                          />
                        </Match>
                        <Match when={zone.shape === 'auxiliary'}>
                          <rect
                            x={zone.cx - zone.rx}
                            y={zone.cy - zone.ry}
                            width={zone.rx * 2}
                            height={zone.ry * 2}
                            rx="15"
                          />
                        </Match>
                        <Match when={zone.shape === 'drum'}>
                          <ellipse
                            cx={zone.cx}
                            cy={zone.cy}
                            rx={zone.rx}
                            ry={zone.ry}
                          />
                          <ellipse
                            class={styles.kitInner}
                            cx={zone.cx}
                            cy={zone.cy}
                            rx={zone.rx - 10}
                            ry={zone.ry - 9}
                          />
                        </Match>
                      </Switch>
                      <Show when={targetAnchors().has(zone.anchor)}>
                        <g
                          class={styles.kitTargetLayer}
                          data-visual-layer="authored-target"
                        >
                          <ZoneOutline zone={zone} expansion={-7} />
                        </g>
                      </Show>
                      <Show when={liveAnchors().has(zone.anchor)}>
                        <g
                          class={styles.kitLiveLayer}
                          data-visual-layer="live-input"
                        >
                          <ZoneOutline zone={zone} expansion={8} />
                        </g>
                      </Show>
                      <text x={zone.cx} y={zone.cy + zone.ry + 25}>
                        {zone.label}
                      </text>
                    </g>
                  )}
                </For>
                <g class={styles.seatSticks} aria-hidden="true">
                  <path d="M452 610L392 456M548 610l46-162" />
                </g>
              </svg>

              <p class={styles.seatActivitySummary}>
                Authored now: {labelsCopy(targetLabels())}. Live now:{' '}
                {labelsCopy(liveLabels())}.
              </p>
              <figcaption>
                <span>
                  {nextTargetCopy(currentIndex, props.playheadBeat())}
                </span>
                <span aria-live="polite">Bar {currentBar() ?? '—'}</span>
              </figcaption>
            </figure>

            <Show when={(activeTargetQuery()?.omittedEventCount ?? 0) > 0}>
              <p class={styles.mappingNotice} role="status">
                {activeTargetQuery()?.omittedEventCount} simultaneous mapped{' '}
                {(activeTargetQuery()?.omittedEventCount ?? 0) === 1
                  ? 'hit exceeds'
                  : 'hits exceed'}{' '}
                this kit-highlight limit. The canonical session is unchanged.
              </p>
            </Show>

            <details class={styles.semanticEvents}>
              <summary>Read the kit map</summary>
              <ul>
                <For each={KIT_ZONES}>
                  {(zone) => {
                    const voices = currentScore.voices.filter(
                      (voice) => voice.seatAnchor === zone.anchor,
                    )
                    return (
                      <li>
                        {zone.label}:{' '}
                        {voices.length === 0
                          ? 'no drawable mapped events'
                          : voices.map((voice) => voice.label).join(', ')}
                      </li>
                    )
                  }}
                </For>
              </ul>
            </details>
          </section>
        )
      }}
    </Show>
  )
}
