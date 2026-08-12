// Guitar Night Shape Walk maps one chosen major chord across truthful CAGED geometry.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { createShapeWalk } from '@/features/guitar/activities/learn-activities'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { CagedShapeName } from '@/lib/guitar/caged-shapes'
import { CAGED_ORDER } from '@/lib/guitar/caged-shapes'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { midiToNoteName, midiToNoteNameOctave } from '@/lib/note-utils'
import { playGuitarNightLearnGuide } from './guitar-night-learn-audio'
import styles from './GuitarNightApp.module.css'
import { GuitarNightLearnActivityShell, guitarNightLearnTuningLabel, } from './GuitarNightLearnActivity'
import { GuitarNightStage } from './GuitarNightStage'

interface GuitarNightShapeWalkProps {
  tuning: Accessor<InstrumentTuning>
  active: Accessor<boolean>
  onBack(): void
}

const SHAPE_STAGE: GuitarPerformanceStageSource = {
  title: () => 'Shape Walk',
  notes: () => [],
  timeline: {
    positionSeconds: () => 0,
    durationSeconds: () => 0,
    playheadBeat: () => null,
    tempoBpm: () => null,
  },
}

const ROOTS = Array.from({ length: 12 }, (_, pitchClass) => ({
  pitchClass,
  label: midiToNoteName(pitchClass),
}))

export function GuitarNightShapeWalk(props: GuitarNightShapeWalkProps) {
  const band = createGuitarRoomBand()
  const [rootPitchClass, setRootPitchClass] = createSignal(0)
  const [shapeName, setShapeName] = createSignal<CagedShapeName>('C')
  const [playingGuide, setPlayingGuide] = createSignal(false)
  const [audioError, setAudioError] = createSignal<string | null>(null)
  const walk = createMemo(() =>
    createShapeWalk(props.tuning(), rootPitchClass(), shapeName()),
  )

  const stopGuide = (): void => {
    band.stop()
    setPlayingGuide(false)
    setAudioError(null)
  }

  const playNotes = async (midi: readonly number[]): Promise<void> => {
    setAudioError(null)
    setPlayingGuide(true)
    const started = await playGuitarNightLearnGuide(band, midi, {
      tempoBpm: 92,
      noteBeats: midi.length === 1 ? 1 : 0.48,
      gapBeats: midi.length === 1 ? 0 : 0.06,
      onComplete: () => setPlayingGuide(false),
    })
    if (!started) {
      setPlayingGuide(false)
      setAudioError(
        'The chord could not play. Allow audio for this site, then try again.',
      )
    }
  }

  const playChord = (): void => {
    if (!walk().compatible) return
    const midi = [...walk().notes]
      .sort((left, right) => left.midi - right.midi)
      .map((note) => note.midi)
    void playNotes(midi)
  }

  createEffect(() => {
    if (props.active()) return
    stopGuide()
  })

  onCleanup(() => void band.dispose())

  return (
    <GuitarNightLearnActivityShell
      testId="guitar-night-shape-walk"
      name="Shape Walk"
      title={`${walk().rootName} major · ${walk().shapeName} shape.`}
      progress={guitarNightLearnTuningLabel(props.tuning())}
      onBack={props.onBack}
    >
      <GuitarNightStage
        source={SHAPE_STAGE}
        active={props.active}
        tuning={props.tuning}
        initialMode="neck"
        availableViews={() => ['neck']}
        showHeader={() => false}
        neckLabel={() =>
          walk().compatible
            ? `${walk().rootName} major in the ${walk().shapeName} CAGED shape. Root, major third, and perfect fifth are marked.`
            : 'Shape Walk is unavailable for this tuning.'
        }
        idleStatus={() => ({
          label: 'Shape Walk',
          detail: walk().compatible
            ? 'Tap any fret to hear it. Markers name the chord tones.'
            : 'Choose a six-string guitar with standard string intervals.',
        })}
        neckInteraction={
          walk().compatible
            ? {
                frets: () => {
                  const range = walk().range
                  return Array.from(
                    { length: range.lastFret - range.firstFret + 1 },
                    (_, index) => range.firstFret + index,
                  )
                },
                cellState: (position) => {
                  const note = walk().notes.find(
                    (candidate) =>
                      candidate.stringIndex === position.stringIndex &&
                      candidate.fret === position.fret,
                  )
                  if (note?.role === 'root') return 'root'
                  if (note?.role === '3rd') return 'third'
                  if (note?.role === '5th') return 'fifth'
                  return 'idle'
                },
                cellLabel: (position, state) => {
                  const note = midiToNoteNameOctave(position.midi)
                  if (state === 'root') return `${note}, chord root`
                  if (state === 'third') return `${note}, major third`
                  if (state === 'fifth') return `${note}, perfect fifth`
                  return `${note}, outside the current chord shape`
                },
                onSelect: (position) => void playNotes([position.midi]),
              }
            : undefined
        }
      />

      <div class={styles.noteHuntDeck}>
        <div class={styles.noteHuntProgress}>
          <div class={styles.shapeWalkSettings}>
            <label>
              <span>Major chord</span>
              <select
                value={rootPitchClass()}
                onChange={(event) => {
                  stopGuide()
                  setRootPitchClass(Number(event.currentTarget.value))
                }}
              >
                <For each={ROOTS}>
                  {(root) => (
                    <option value={root.pitchClass}>{root.label} major</option>
                  )}
                </For>
              </select>
            </label>
            <div
              class={styles.shapeWalkPicker}
              role="group"
              aria-label="CAGED shape"
            >
              <For each={CAGED_ORDER}>
                {(shape) => (
                  <button
                    type="button"
                    aria-pressed={shapeName() === shape}
                    onClick={() => {
                      stopGuide()
                      setShapeName(shape)
                    }}
                  >
                    {shape}
                  </button>
                )}
              </For>
            </div>
          </div>
          <Show
            when={walk().compatible}
            fallback={
              <p role="status">
                Shape Walk needs a six-string guitar with standard string
                intervals. Capos and equal detunes are supported; bass and
                alternate interval tunings stay unaltered.
              </p>
            }
          >
            <div class={styles.shapeWalkLegend} aria-label="Chord tone legend">
              <span data-role="root">R · Root</span>
              <span data-role="third">3 · Major third</span>
              <span data-role="fifth">5 · Perfect fifth</span>
            </div>
          </Show>
          <Show when={audioError()}>
            {(message) => <p role="alert">{message()}</p>}
          </Show>
        </div>

        <div class={styles.noteHuntControls}>
          <Show when={walk().compatible}>
            <button
              type="button"
              class={styles.noteHuntNext}
              disabled={playingGuide()}
              onClick={playChord}
            >
              <strong>{playingGuide() ? 'Playing…' : 'Hear this shape'}</strong>
              <small>Low to high through the room guide</small>
            </button>
          </Show>
        </div>
      </div>
    </GuitarNightLearnActivityShell>
  )
}
