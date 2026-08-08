// Guitar Night stage adapts the shared 3D renderer into quiet Flow, Tab, and Neck views.
// ============================================================

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, For, lazy, Show, Suspense } from 'solid-js'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { VELVET_DISPLAY } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { DEFAULT_GUITAR_TUNING, MAX_STRING_COUNT, MIN_STRING_COUNT, } from '@/lib/guitar/instrument-tuning'
import styles from './GuitarNightApp.module.css'

const Guitar3DStage = lazy(async () => {
  const module = await import('@/features/guitar/ui/Guitar3DStage')
  return { default: module.Guitar3DStage }
})

export type GuitarNightStageMode = 'flow' | 'tab' | 'neck'

interface GuitarNightStageProps {
  source: GuitarPerformanceStageSource
  /** Names the attached score while one is guiding the stage. */
  guideLabel?: Accessor<string | null>
  /** The instrument the rows describe. Absent means a standard six-string. */
  tuning?: Accessor<InstrumentTuning>
  /** Both handlers together enable the instrument picker over the rows. */
  onInstrument?: (instrument: StringedInstrument) => void
  onStringCount?: (count: number) => void
  active: Accessor<boolean>
  listening?: Accessor<boolean>
  heardNote?: Accessor<string | null>
  heardClarity?: Accessor<number>
  initialMode?: GuitarNightStageMode
}

const FRET_LABELS = Array.from({ length: 13 }, (_, index) => index)

const INSTRUMENT_CHOICES: readonly {
  id: StringedInstrument
  label: string
}[] = [
  { id: 'guitar', label: 'Guitar' },
  { id: 'bass', label: 'Bass' },
]

const STRING_COUNT_CHOICES = Array.from(
  { length: MAX_STRING_COUNT - MIN_STRING_COUNT + 1 },
  (_, index) => MIN_STRING_COUNT + index,
)

/** Tab shows the same span of music as Flow, so switching view keeps context. */
const TAB_WINDOW_BEATS = 8
/** Where the now-line sits, leaving a little played history behind it. */
export const TAB_PLAYHEAD_RATIO = 0.18

export interface TabWindowEntry {
  note: GuitarNote
  offsetPercent: number
  isActive: boolean
  isPast: boolean
}

/**
 * Place the notes that fall inside the moving window, as a percentage across
 * it. Without a playhead the window rests at the top of the score so an
 * attached tab is readable before anything starts.
 */
export function tabWindowEntries(
  notes: readonly GuitarNote[],
  playheadBeat: number | null,
  windowBeats = TAB_WINDOW_BEATS,
): TabWindowEntry[] {
  const head = playheadBeat ?? 0
  const start = head - windowBeats * TAB_PLAYHEAD_RATIO
  const end = start + windowBeats

  const entries: TabWindowEntry[] = []
  for (const note of notes) {
    if (note.startBeat > end || note.startBeat + note.duration < start) continue
    entries.push({
      note,
      offsetPercent: ((note.startBeat - start) / windowBeats) * 100,
      isActive:
        playheadBeat !== null &&
        note.startBeat <= playheadBeat &&
        note.startBeat + note.duration > playheadBeat,
      isPast: playheadBeat !== null && note.startBeat + note.duration <= head,
    })
  }
  return entries
}

/**
 * Naming the instrument sits over the rows it renames, because that is where a
 * wrong answer is visible: bass notes on `e B G D A E` lines read as nonsense.
 */
function InstrumentPicker(props: {
  tuning: InstrumentTuning
  onInstrument(instrument: StringedInstrument): void
  onStringCount(count: number): void
}) {
  return (
    <div class={styles.stageInstrument}>
      <div
        class={styles.stageInstrumentKind}
        role="group"
        aria-label="Instrument shown"
      >
        <For each={INSTRUMENT_CHOICES}>
          {(choice) => (
            <button
              type="button"
              classList={{
                [styles.stageInstrumentActive]:
                  props.tuning.instrument === choice.id,
              }}
              aria-pressed={props.tuning.instrument === choice.id}
              onClick={() => props.onInstrument(choice.id)}
            >
              {choice.label}
            </button>
          )}
        </For>
      </div>
      <label>
        <span class={styles.visuallyHidden}>Strings</span>
        <select
          value={props.tuning.stringCount}
          onChange={(event) =>
            props.onStringCount(Number(event.currentTarget.value))
          }
        >
          <For each={STRING_COUNT_CHOICES}>
            {(count) => <option value={count}>{count} strings</option>}
          </For>
        </select>
      </label>
      <small>{props.tuning.labels.join(' ')}</small>
    </div>
  )
}

function noteAtPlayhead(
  notes: readonly GuitarNote[],
  playheadBeat: number | null,
): GuitarNote | null {
  if (playheadBeat === null) return null
  return (
    notes.find(
      (note) =>
        note.startBeat <= playheadBeat &&
        note.startBeat + note.duration > playheadBeat,
    ) ?? null
  )
}

export function GuitarNightStage(props: GuitarNightStageProps) {
  const [mode, setMode] = createSignal<GuitarNightStageMode>(
    props.initialMode ?? 'flow',
  )
  const tuning = createMemo(() => props.tuning?.() ?? DEFAULT_GUITAR_TUNING)
  const instrumentLabel = createMemo(
    () => `${tuning().stringCount}-string ${tuning().instrument}`,
  )
  const notes = createMemo(() => [...props.source.notes()])
  const activeNote = createMemo(() =>
    noteAtPlayhead(notes(), props.source.timeline.playheadBeat()),
  )
  const hasGuide = createMemo(() => notes().length > 0)
  const visibleTabNotes = createMemo(() =>
    tabWindowEntries(notes(), props.source.timeline.playheadBeat()),
  )
  const canRetune = createMemo(
    () => props.onInstrument !== undefined && props.onStringCount !== undefined,
  )
  const isListening = createMemo(() => props.listening?.() ?? false)
  const heardNote = createMemo(() => props.heardNote?.() ?? null)
  const heardCopy = createMemo(() => {
    const note = heardNote()
    if (!isListening()) return null
    if (note === null) return 'Play a clean note'
    const confidence = Math.round((props.heardClarity?.() ?? 0) * 100)
    return `${note} · ${confidence}% clear`
  })
  const canvasSummary = createMemo(() =>
    hasGuide()
      ? `${props.source.title()}. ${notes().length} guided notes approach a ${instrumentLabel()} fretboard.`
      : `${props.source.title()}. Interactive ${instrumentLabel()} fretboard; no song tab is attached.`,
  )

  return (
    <section
      class={styles.performanceStage}
      aria-label="Guitar stage"
      data-testid="guitar-night-stage"
    >
      <header class={styles.stageHeader}>
        <div>
          <span>
            {isListening()
              ? heardNote() === null
                ? 'Listening'
                : 'Heard now'
              : hasGuide()
                ? 'Guide ready'
                : 'Free play'}
          </span>
          <strong>
            {heardCopy() ??
              (hasGuide()
                ? (props.guideLabel?.() ?? 'Follow the next note into the neck')
                : 'Your fretboard is ready')}
          </strong>
        </div>
        <div class={styles.stageHeaderTools}>
          {/* The instrument names the rows in every view, so it belongs beside
              the view switch rather than inside one of them. */}
          <Show when={canRetune()}>
            <InstrumentPicker
              tuning={tuning()}
              onInstrument={(next) => props.onInstrument?.(next)}
              onStringCount={(count) => props.onStringCount?.(count)}
            />
          </Show>
          <div class={styles.stageModes} aria-label="Stage view">
            <For each={['flow', 'tab', 'neck'] as GuitarNightStageMode[]}>
              {(candidate) => (
                <button
                  type="button"
                  classList={{ [styles.stageModeActive]: mode() === candidate }}
                  aria-pressed={mode() === candidate}
                  onClick={() => setMode(candidate)}
                >
                  {candidate === 'flow'
                    ? 'Flow'
                    : candidate === 'tab'
                      ? 'Tab'
                      : 'Neck'}
                </button>
              )}
            </For>
          </div>
        </div>
      </header>

      <div class={styles.stageViewport} data-stage-mode={mode()}>
        <Show when={mode() === 'flow'}>
          <Suspense
            fallback={
              <div class={styles.stageLoading} role="status">
                <span aria-hidden="true" />
                Setting the fretboard…
              </div>
            }
          >
            <Guitar3DStage
              source={props.source}
              tuning={tuning}
              visibleBeatWindow={() => 8}
              showNoteLabels={() => true}
              showFretboard={() => true}
              isActive={() => props.active() && mode() === 'flow'}
              display={() => VELVET_DISPLAY}
              showGizmo={() => false}
              ariaLabel={() =>
                `${props.source.title()} flowing guitar fretboard`
              }
              fallbackText={canvasSummary}
              borderRadius={() => '0'}
            />
          </Suspense>
          <p class={styles.stageGestureHint} aria-hidden="true">
            Drag to change the view · scroll to move closer
          </p>
        </Show>

        <Show when={mode() === 'tab'}>
          <div class={styles.stageTab}>
            <div
              class={styles.stageTabLanes}
              role="img"
              aria-label={canvasSummary()}
            >
              <div
                class={styles.stageTabPlayhead}
                aria-hidden="true"
                style={{ left: `${TAB_PLAYHEAD_RATIO * 100}%` }}
              />
              <For each={tuning().labels}>
                {(label, stringIndex) => (
                  <div class={styles.stageTabString}>
                    <span>{label}</span>
                    <i aria-hidden="true" />
                    <div aria-hidden="true">
                      <For
                        each={visibleTabNotes().filter(
                          (entry) => entry.note.stringIndex === stringIndex(),
                        )}
                      >
                        {(entry) => (
                          <b
                            classList={{
                              [styles.stageTabNoteActive]: entry.isActive,
                              [styles.stageTabNotePast]: entry.isPast,
                            }}
                            style={{ left: `${entry.offsetPercent}%` }}
                          >
                            {entry.note.fret}
                          </b>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <Show when={!hasGuide()}>
              <p>
                No tab attached to this song. Load a tab later, or stay in free
                play.
              </p>
            </Show>
          </div>
        </Show>

        <Show when={mode() === 'neck'}>
          <div
            class={styles.stageNeck}
            aria-label={
              activeNote() === null
                ? `Twelve-fret ${instrumentLabel()} neck with no target note`
                : `${instrumentLabel()} neck target: ${tuning().labels[activeNote()!.stringIndex] ?? `string ${activeNote()!.stringIndex + 1}`} string, fret ${activeNote()!.fret}`
            }
            role="img"
          >
            <div class={styles.fretNumbers} aria-hidden="true">
              <For each={FRET_LABELS}>{(fret) => <span>{fret}</span>}</For>
            </div>
            <For each={tuning().labels}>
              {(_label, stringIndex) => (
                <div class={styles.neckString} aria-hidden="true">
                  <For each={FRET_LABELS}>
                    {(fret) => (
                      <span
                        classList={{
                          [styles.neckTarget]:
                            activeNote()?.stringIndex === stringIndex() &&
                            activeNote()?.fret === fret,
                        }}
                      />
                    )}
                  </For>
                </div>
              )}
            </For>
            <Show when={!hasGuide()}>
              <p>Free play · standard {tuning().instrument} tuning</p>
            </Show>
          </div>
        </Show>
      </div>
    </section>
  )
}
