// Guitar Night stage adapts the shared 3D renderer into quiet Flow, Tab, and Neck views.
// ============================================================

import type { Accessor } from 'solid-js'
import { createMemo, createSignal, For, lazy, Show, Suspense } from 'solid-js'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import { VELVET_DISPLAY } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
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
  active: Accessor<boolean>
  listening?: Accessor<boolean>
  heardNote?: Accessor<string | null>
  heardClarity?: Accessor<number>
  initialMode?: GuitarNightStageMode
}

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'] as const
const FRET_LABELS = Array.from({ length: 13 }, (_, index) => index)

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
  const notes = createMemo(() => [...props.source.notes()])
  const activeNote = createMemo(() =>
    noteAtPlayhead(notes(), props.source.timeline.playheadBeat()),
  )
  const hasGuide = createMemo(() => notes().length > 0)
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
      ? `${props.source.title()}. ${notes().length} guided notes approach a six-string fretboard.`
      : `${props.source.title()}. Interactive six-string fretboard; no song tab is attached.`,
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
          <div class={styles.stageTab} role="img" aria-label={canvasSummary()}>
            <For each={STRING_LABELS}>
              {(label, stringIndex) => (
                <div class={styles.stageTabString}>
                  <span>{label}</span>
                  <i aria-hidden="true" />
                  <div aria-hidden="true">
                    <For
                      each={notes().filter(
                        (note) => note.stringIndex === stringIndex(),
                      )}
                    >
                      {(note) => <b>{note.fret}</b>}
                    </For>
                  </div>
                </div>
              )}
            </For>
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
            role="img"
            aria-label={
              activeNote() === null
                ? 'Twelve-fret guitar neck with no target note'
                : `Guitar neck target: string ${activeNote()!.stringIndex + 1}, fret ${activeNote()!.fret}`
            }
          >
            <div class={styles.fretNumbers} aria-hidden="true">
              <For each={FRET_LABELS}>{(fret) => <span>{fret}</span>}</For>
            </div>
            <For each={STRING_LABELS}>
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
              <p>Free play · standard tuning</p>
            </Show>
          </div>
        </Show>
      </div>
    </section>
  )
}
