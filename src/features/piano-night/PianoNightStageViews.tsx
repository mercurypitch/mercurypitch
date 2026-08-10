// ============================================================
// Piano Night stage lenses — truthful projections of one prepared score
// ============================================================
//
// Fall, Score, and Keys share the same notes and sampled playhead. None owns
// transport or audio, and the lightweight score avoids the VexFlow bundle.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { PianoPerformanceNote } from '@/features/piano/runtime/piano-performance-contract'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { PianoNightPhrase } from './piano-night-demo-project'
import styles from './PianoNightApp.module.css'

export type PianoNightPerformanceView = 'fall' | 'score' | 'keys'

interface PianoNightStageViewsProps {
  view: Accessor<PianoNightPerformanceView>
  notes: readonly PianoPerformanceNote[]
  playheadBeat: Accessor<number>
  isPlaying: Accessor<boolean>
  phrase: Accessor<PianoNightPhrase>
  activeMidis: Accessor<ReadonlySet<number>>
  reducedMotion: Accessor<boolean>
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function displayNote(midi: number): string {
  return midiToNoteNameOctave(midi)
    .replace('D#', 'E♭')
    .replace('G#', 'A♭')
    .replace('A#', 'B♭')
}

function noteX(midi: number): number {
  return clamp(((midi - 21) / 87) * 100, 1, 99)
}

function PianoNightFallView(props: PianoNightStageViewsProps): JSX.Element {
  const semanticSummary = createMemo(() => {
    const upcoming = props.notes.filter(
      (note) =>
        note.startBeat + note.duration >= props.playheadBeat() - 1 &&
        note.startBeat <= props.playheadBeat() + 12,
    )
    return `${upcoming.length} project notes around beat ${props
      .playheadBeat()
      .toFixed(
        1,
      )}. Square cyan notes mark the lower register and rounded coral notes mark the upper register.`
  })

  return (
    <section
      class={styles.fallStage}
      aria-label="Falling-note performance"
      data-testid="piano-night-fall-view"
    >
      <div class={styles.laneGuides} aria-hidden="true">
        <For each={Array.from({ length: 12 })}>{() => <i />}</For>
      </div>
      <div class={styles.strikeGuide} aria-hidden="true" />
      <For each={props.notes}>
        {(note) => {
          const relativeBeat = (): number =>
            note.startBeat -
            (props.reducedMotion()
              ? props.phrase().startBeat
              : props.playheadBeat())
          const visible = (): boolean =>
            relativeBeat() >= -Math.max(1, note.duration) &&
            relativeBeat() <= 13
          const striking = (): boolean =>
            note.startBeat <= props.playheadBeat() &&
            note.startBeat + note.duration > props.playheadBeat()
          return (
            <i
              classList={{
                [styles.fallNote]: true,
                [styles.leftNote]: note.midi < 60,
                [styles.rightNote]: note.midi >= 60,
              }}
              data-striking={striking()}
              data-register={note.midi < 60 ? 'lower' : 'upper'}
              style={{
                display: visible() ? 'block' : 'none',
                left: `${noteX(note.midi)}%`,
                top: `${clamp(82 - relativeBeat() * 6.4, -18, 94)}%`,
                height: `${clamp(note.duration * 24, 30, 132)}px`,
              }}
              aria-hidden="true"
            />
          )
        }}
      </For>
      <span class={styles.projectLabel}>Prepared project performance</span>
      <p class={styles.srOnly}>{semanticSummary()}</p>
    </section>
  )
}

function PianoNightScoreView(props: PianoNightStageViewsProps): JSX.Element {
  const phraseNotes = createMemo(() =>
    props.notes.filter(
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
      aria-label="Prepared project score"
      data-testid="piano-night-score-view"
    >
      <div class={styles.scorePaper}>
        <div class={styles.scoreHeading}>
          <span>Afterglow Study</span>
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
          <span>E-flat major</span>
          <span>{phraseNotes().length} notes</span>
          <span>Project score lens</span>
        </div>
      </div>
    </section>
  )
}

function PianoNightKeysView(props: PianoNightStageViewsProps): JSX.Element {
  const projectMidis = createMemo(() =>
    props.isPlaying()
      ? props.notes
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
    for (const midi of props.activeMidis()) combined.add(midi)
    return Array.from(combined).sort((left, right) => left - right)
  })
  const nextMidis = createMemo(() => {
    if (currentMidis().length > 0) return currentMidis()
    const nextStart = props.notes.find(
      (note) => note.startBeat >= props.playheadBeat(),
    )?.startBeat
    if (nextStart === undefined) return []
    return props.notes
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
          Beat {props.playheadBeat().toFixed(1)} of 64 · {props.phrase().range}
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
