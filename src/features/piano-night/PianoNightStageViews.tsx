// ============================================================
// Piano Night stage lenses — truthful projections of one replaceable score
// ============================================================
//
// Fall, Score, and Keys share the same notes and sampled playhead. None owns
// transport or audio, and the lightweight score avoids the VexFlow bundle.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { PianoPerformanceNote } from '@/features/piano/runtime/piano-performance-contract'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PianoKeyWindow } from './piano-key-window'
import { keyCenterPercent } from './piano-key-window'
import type { PianoNightPhrase } from './piano-night-demo-project'
import type { PianoNightStageMotion } from './piano-night-fall-geometry'
import { PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT, pianoNightFallAnchorBeat, pianoNightFallGeometry, pianoNightFallStaticBottomPercent, pianoNightFallTrackTranslationPercent, pianoNightFallVisualBeat, pianoNightFallWindow, } from './piano-night-fall-geometry'
import type { PianoNightPracticeLoopState } from './piano-night-practice-loop'
import { PIANO_NIGHT_MIN_LOOP_BEATS } from './piano-night-practice-loop'
import styles from './PianoNightApp.module.css'

export type PianoNightPerformanceView = 'fall' | 'score' | 'keys'

interface PianoNightStageViewsProps {
  view: Accessor<PianoNightPerformanceView>
  notes: Accessor<readonly PianoPerformanceNote[]>
  title: Accessor<string>
  totalBeats: Accessor<number>
  keyLabel: Accessor<string | null>
  hasAuthoredCoach: Accessor<boolean>
  playheadBeat: Accessor<number>
  isPlaying: Accessor<boolean>
  phrase: Accessor<PianoNightPhrase>
  /** Only what the player is sounding. Project notes arrive separately. */
  inputMidis: Accessor<ReadonlySet<number>>
  /**
   * Whether the score is allowed to light keys by itself. "Hide falling notes
   * on keys" turns it off, and every lens that paints project notes onto keys
   * has to honour it, not just the keybed.
   */
  showProjectKeys: Accessor<boolean>
  /**
   * The keys currently on screen. The fall stage shares its horizontal box
   * with the keybed, so a note's x has to come from the same geometry the
   * keys do — otherwise a phone's two-octave window leaves every note about
   * a key to the left of the one it names, and the octave arrows move the
   * keys while the notes stay put.
   */
  keyWindow: Accessor<PianoKeyWindow>
  /**
   * How the fall track advances. Never a switch between "moves" and
   * "does not move" -- see pianoNightFallVisualBeat.
   */
  stageMotion: Accessor<PianoNightStageMotion>
  practiceLoop?: Accessor<PianoNightPracticeLoopState>
  /** Beats to add to the playhead. Positive drags the score forward. */
  onScrub?: (deltaBeats: number) => void
  setPracticeLoopStart?: (beat: number) => void
  setPracticeLoopEnd?: (beat: number) => void
}

/**
 * How far a pointer travels before a press on the fall stage becomes a scrub.
 * Without it every tap on the stage seeks.
 */
const FALL_SCRUB_DEAD_ZONE_PX = 6

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function displayNote(midi: number): string {
  return midiToNoteNameOctave(midi)
    .replace('D#', 'E♭')
    .replace('G#', 'A♭')
    .replace('A#', 'B♭')
}

/**
 * Where a note belongs, and whether the window can hold it. A note outside
 * the window has no key to sit over: it is pinned to the edge it fell off and
 * marked, so it reads as "there is music that way" rather than as a note
 * pointing at the wrong key.
 */
function notePlacement(
  midi: number,
  window: PianoKeyWindow,
): { x: number; offWindow: boolean } {
  const centre = keyCenterPercent(midi, window)
  if (centre !== null) return { x: clamp(centre, 1, 99), offWindow: false }
  return { x: midi < window.startMidi ? 1 : 99, offWindow: true }
}

function PianoNightFallView(props: PianoNightStageViewsProps): JSX.Element {
  const visualBeat = createMemo(() =>
    pianoNightFallVisualBeat(props.playheadBeat(), props.stageMotion()),
  )
  const anchorBeat = createMemo(() => pianoNightFallAnchorBeat(visualBeat()))
  const trackNotes = createMemo(() =>
    pianoNightFallWindow(props.notes(), anchorBeat()),
  )
  const trackTranslation = createMemo(() =>
    pianoNightFallTrackTranslationPercent(visualBeat(), anchorBeat()),
  )
  const semanticBeat = createMemo(() => Math.floor(props.playheadBeat()))
  const semanticSummary = createMemo(() => {
    const upcoming = props
      .notes()
      .filter(
        (note) =>
          note.startBeat + note.duration >= semanticBeat() - 1 &&
          note.startBeat <= semanticBeat() + 12,
      )
    return `${upcoming.length} project notes around beat ${semanticBeat()}. Square cyan notes mark the lower register and rounded coral notes mark the upper register.`
  })

  let scrubRef!: HTMLDivElement
  let scrubPointerId: number | null = null
  let scrubOriginY = 0
  let scrubLastY = 0
  let scrubbing = false

  const pixelsPerBeat = (): number => {
    const height = scrubRef?.clientHeight
    return (
      ((height !== undefined && height > 0 ? height : 1) / 100) *
      PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT
    )
  }

  const onScrubPointerDown = (event: PointerEvent): void => {
    // Left button, primary contact. A right-click or a second finger has no
    // business moving the playhead.
    if (event.button !== 0 || !event.isPrimary) return
    scrubPointerId = event.pointerId
    scrubOriginY = event.clientY
    scrubLastY = event.clientY
    scrubbing = false
    scrubRef.setPointerCapture(event.pointerId)
  }

  const onScrubPointerMove = (event: PointerEvent): void => {
    if (scrubPointerId !== event.pointerId) return
    if (!scrubbing) {
      if (Math.abs(event.clientY - scrubOriginY) < FALL_SCRUB_DEAD_ZONE_PX) {
        return
      }
      // Past the dead zone the stage follows the pointer one to one from where
      // it was pressed, so the score does not lag the finger by the threshold.
      scrubbing = true
      scrubLastY = scrubOriginY
    }
    const deltaY = event.clientY - scrubLastY
    if (deltaY === 0) return
    scrubLastY = event.clientY
    props.onScrub?.(deltaY / pixelsPerBeat())
  }

  const onScrubPointerUp = (event: PointerEvent): void => {
    if (scrubPointerId !== event.pointerId) return
    scrubPointerId = null
    scrubbing = false
    if (scrubRef.hasPointerCapture(event.pointerId)) {
      scrubRef.releasePointerCapture(event.pointerId)
    }
  }

  const loopRange = createMemo(() => {
    const loop = props.practiceLoop?.()
    if (loop === undefined || !loop.enabled) return null
    return loop.range
  })

  return (
    <section
      class={styles.fallStage}
      aria-label="Falling-note performance"
      data-testid="piano-night-fall-view"
    >
      <div
        class={styles.fallScrubSurface}
        aria-hidden="true"
        data-testid="piano-night-fall-scrub"
        ref={scrubRef}
        onPointerDown={onScrubPointerDown}
        onPointerMove={onScrubPointerMove}
        onPointerUp={onScrubPointerUp}
        onPointerCancel={onScrubPointerUp}
        onLostPointerCapture={onScrubPointerUp}
      />
      <div class={styles.laneGuides} aria-hidden="true">
        <For each={Array.from({ length: 12 })}>{() => <i />}</For>
      </div>
      <div
        class={styles.strikeGuide}
        aria-hidden="true"
        data-testid="piano-night-strike-guide"
      />
      <div
        class={styles.fallTrack}
        style={{
          transform: `translate3d(0, ${trackTranslation()}%, 0)`,
        }}
        data-anchor-beat={anchorBeat()}
        data-stage-motion={props.stageMotion()}
        data-testid="piano-night-fall-track"
        aria-hidden="true"
      >
        <For each={trackNotes()}>
          {(note) => {
            const striking = createMemo(
              () =>
                props.isPlaying() &&
                pianoNightFallGeometry(
                  note.startBeat,
                  note.duration,
                  props.playheadBeat(),
                ).striking,
            )
            const placement = createMemo(() =>
              notePlacement(note.midi, props.keyWindow()),
            )
            return (
              <i
                classList={{
                  [styles.fallNote]: true,
                  [styles.leftNote]: note.midi < 60,
                  [styles.rightNote]: note.midi >= 60,
                  [styles.fallNoteOffWindow]: placement().offWindow,
                }}
                data-note-id={note.id}
                data-note-midi={note.midi}
                data-striking={striking()}
                data-off-window={placement().offWindow}
                data-register={note.midi < 60 ? 'lower' : 'upper'}
                data-start-beat={note.startBeat}
                data-duration-beats={note.duration}
                style={{
                  left: `${placement().x}%`,
                  bottom: `${pianoNightFallStaticBottomPercent(
                    note.startBeat,
                    anchorBeat(),
                  )}%`,
                  height: `${
                    note.duration * PIANO_NIGHT_FALL_TRAVEL_PERCENT_PER_BEAT
                  }%`,
                }}
              />
            )
          }}
        </For>
        <Show when={loopRange()}>
          {(range) => (
            <>
              <PracticeMarker
                type="A"
                beat={range().startBeat}
                anchor={anchorBeat()}
                minBeat={0}
                maxBeat={range().endBeat - PIANO_NIGHT_MIN_LOOP_BEATS}
                pixelsPerBeat={pixelsPerBeat}
                onCommit={props.setPracticeLoopStart}
              />
              <PracticeMarker
                type="B"
                beat={range().endBeat}
                anchor={anchorBeat()}
                minBeat={range().startBeat + PIANO_NIGHT_MIN_LOOP_BEATS}
                maxBeat={props.totalBeats()}
                pixelsPerBeat={pixelsPerBeat}
                onCommit={props.setPracticeLoopEnd}
              />
            </>
          )}
        </Show>
      </div>
      <span class={styles.projectLabel}>
        {props.hasAuthoredCoach()
          ? 'Prepared project performance'
          : 'Loaded project performance'}
      </span>
      <p class={styles.srOnly}>{semanticSummary()}</p>
    </section>
  )
}

function PianoNightScoreView(props: PianoNightStageViewsProps): JSX.Element {
  const phraseNotes = createMemo(() =>
    props
      .notes()
      .filter(
        (note) =>
          note.startBeat < props.phrase().endBeat &&
          note.startBeat + note.duration > props.phrase().startBeat,
      ),
  )
  const scoreX = (note: PianoPerformanceNote): number =>
    112 +
    ((note.startBeat - props.phrase().startBeat) /
      (props.phrase().endBeat - props.phrase().startBeat)) *
      588
  const scoreY = (note: PianoPerformanceNote): number =>
    note.midi >= 60
      ? clamp(126 - (note.midi - 60) * 4.2, 54, 142)
      : clamp(232 - (note.midi - 36) * 3.8, 174, 270)

  return (
    <section
      class={styles.scoreStage}
      aria-label={`Project score for ${props.title()}`}
      data-testid="piano-night-score-view"
    >
      <div class={styles.scorePaper}>
        <div class={styles.scoreHeading}>
          <span>{props.title()}</span>
          <small>{props.phrase().range}</small>
        </div>
        <svg
          viewBox="0 0 760 320"
          role="img"
          aria-label={`${phraseNotes().length} project notes in ${props.phrase().range}. Rectangular notes mark the lower register and oval notes mark the upper register.`}
        >
          <g class={styles.scoreLines}>
            <path d="M52 82h656M52 95h656M52 108h656M52 121h656M52 134h656M52 206h656M52 219h656M52 232h656M52 245h656M52 258h656" />
            <path d="M224 76v188M390 76v188M556 76v188M708 76v188" />
          </g>
          <g class={styles.scoreClefs}>
            <text x="64" y="132">
              𝄞
            </text>
            <text x="64" y="256">
              𝄢
            </text>
          </g>
          <g class={styles.scoreNotes}>
            <For each={phraseNotes()}>
              {(note) => (
                <g
                  classList={{
                    [styles.scoreLeftNote]: note.midi < 60,
                    [styles.scoreRightNote]: note.midi >= 60,
                  }}
                >
                  <Show
                    when={note.midi < 60}
                    fallback={
                      <ellipse
                        cx={scoreX(note)}
                        cy={scoreY(note)}
                        rx="7.5"
                        ry="5.5"
                      />
                    }
                  >
                    <rect
                      x={scoreX(note) - 7.5}
                      y={scoreY(note) - 5.5}
                      width="15"
                      height="11"
                      rx="2"
                    />
                  </Show>
                  <path d={`M${scoreX(note) + 6.5} ${scoreY(note)}v-28`} />
                </g>
              )}
            </For>
          </g>
          <path
            class={styles.scorePlayhead}
            d={`M${clamp(
              112 +
                ((props.playheadBeat() - props.phrase().startBeat) /
                  (props.phrase().endBeat - props.phrase().startBeat)) *
                  588,
              112,
              700,
            )} 66v204`}
          />
        </svg>
        <div class={styles.scoreLegend}>
          <Show when={props.keyLabel()}>
            {(label) => <span>{label()}</span>}
          </Show>
          <span>{phraseNotes().length} notes</span>
          <span>
            {props.hasAuthoredCoach()
              ? 'Prepared score lens'
              : 'Project score lens'}
          </span>
        </div>
      </div>
    </section>
  )
}

function PianoNightKeysView(props: PianoNightStageViewsProps): JSX.Element {
  // "Sounding now" is a key readout, so it obeys the same setting the keybed
  // does: with falling notes hidden only the player's own notes light it up.
  // The entrance preview below stays, because it reads the score ahead rather
  // than playing it back on the keys.
  const projectMidis = createMemo(() =>
    props.isPlaying() && props.showProjectKeys()
      ? props
          .notes()
          .filter(
            (note) =>
              note.startBeat <= props.playheadBeat() &&
              note.startBeat + note.duration > props.playheadBeat(),
          )
          .map((note) => note.midi)
      : [],
  )
  const currentMidis = createMemo(() => {
    const combined = new Set(projectMidis())
    for (const midi of props.inputMidis()) combined.add(midi)
    return Array.from(combined).sort((left, right) => left - right)
  })
  const nextMidis = createMemo(() => {
    if (currentMidis().length > 0) return currentMidis()
    const nextStart = props
      .notes()
      .find((note) => note.startBeat >= props.playheadBeat())?.startBeat
    if (nextStart === undefined) return []
    return props
      .notes()
      .filter((note) => Math.abs(note.startBeat - nextStart) < 0.001)
      .map((note) => note.midi)
      .sort((left, right) => left - right)
  })

  return (
    <section
      class={styles.keysStage}
      aria-label="Current project keys"
      data-testid="piano-night-keys-view"
    >
      <div class={styles.voicingCard}>
        <span>
          {currentMidis().length > 0 ? 'Sounding now' : 'Next project entrance'}
        </span>
        <h2>
          <Show when={nextMidis().length > 0} fallback="Score complete">
            {nextMidis().map(displayNote).join(' · ')}
          </Show>
        </h2>
        <p>
          Beat {props.playheadBeat().toFixed(1)} of {props.totalBeats()} ·{' '}
          {props.phrase().range}
        </p>
        <div>
          <For each={nextMidis()}>{(midi) => <i>{displayNote(midi)}</i>}</For>
        </div>
      </div>
    </section>
  )
}

export function PianoNightStageViews(
  props: PianoNightStageViewsProps,
): JSX.Element {
  return (
    <>
      <Show when={props.view() === 'fall'}>
        <PianoNightFallView {...props} />
      </Show>
      <Show when={props.view() === 'score'}>
        <PianoNightScoreView {...props} />
      </Show>
      <Show when={props.view() === 'keys'}>
        <PianoNightKeysView {...props} />
      </Show>
    </>
  )
}

/**
 * One draggable A/B boundary. The drag is buffered locally and committed once
 * on release: `configurePracticeLoop` stops the scheduler, releases live
 * voices, invalidates the take and writes a status line, and doing that on
 * every pointer frame turns one gesture into dozens of teardowns.
 */
function PracticeMarker(props: {
  type: 'A' | 'B'
  beat: number
  anchor: number
  minBeat: number
  maxBeat: number
  pixelsPerBeat: () => number
  onCommit?: (beat: number) => void
}): JSX.Element {
  const [draftBeat, setDraftBeat] = createSignal<number | null>(null)
  let markerRef!: HTMLDivElement
  let pointerId: number | null = null
  let originY = 0
  let originBeat = 0

  const displayBeat = createMemo(() => draftBeat() ?? props.beat)

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary) return
    event.stopPropagation()
    pointerId = event.pointerId
    originY = event.clientY
    originBeat = props.beat
    markerRef.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return
    event.stopPropagation()
    const travelled = originY - event.clientY
    if (draftBeat() === null && Math.abs(travelled) < FALL_SCRUB_DEAD_ZONE_PX) {
      return
    }
    // Clamped against the opposite boundary, so A can never be dragged past B
    // into a range the loop would reject.
    setDraftBeat(
      clamp(
        originBeat + travelled / props.pixelsPerBeat(),
        props.minBeat,
        props.maxBeat,
      ),
    )
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return
    event.stopPropagation()
    pointerId = null
    const committed = draftBeat()
    setDraftBeat(null)
    if (markerRef.hasPointerCapture(event.pointerId)) {
      markerRef.releasePointerCapture(event.pointerId)
    }
    if (committed === null) return
    props.onCommit?.(committed)
  }

  return (
    <div
      ref={markerRef}
      class={styles.practiceMarker}
      data-type={props.type}
      data-testid="piano-night-loop-marker"
      data-beat={displayBeat().toFixed(3)}
      data-dragging={draftBeat() !== null}
      style={{
        bottom: `${pianoNightFallStaticBottomPercent(displayBeat(), props.anchor)}%`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
    >
      <span>{props.type}</span>
    </div>
  )
}
