// Bounded melody corrections edit a score revision while preserving the immutable recording evidence.
import { createMemo, createSignal, For, Show, untrack } from 'solid-js'
import { changeRecordingNote, changeRecordingScoreTempo, quantizeRecordingScore, recordingNoteNeedsFingering, } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import { midiToNote } from '@/lib/scale-data'
import styles from './GuitarRecording.module.css'

export function GuitarRecordingEditor(props: {
  score: GuitarPracticeScore
  disabled?: boolean
  onChange(score: GuitarPracticeScore): void
}) {
  const [selected, setSelected] = createSignal(
    untrack(() =>
      Math.max(
        0,
        props.score.notes.findIndex((note) =>
          recordingNoteNeedsFingering(props.score, note),
        ),
      ),
    ),
  )
  const [history, setHistory] = createSignal<GuitarPracticeScore[]>([])
  const problems = createMemo(() =>
    props.score.notes.filter((note) =>
      recordingNoteNeedsFingering(props.score, note),
    ),
  )
  const note = createMemo(
    () => props.score.notes[Math.min(selected(), props.score.notes.length - 1)],
  )
  const change = (score: GuitarPracticeScore): void => {
    setHistory((rows) => [...rows.slice(-19), structuredClone(props.score)])
    setSelected((index) => Math.max(0, Math.min(index, score.notes.length - 1)))
    props.onChange(score)
  }
  const patch = (
    field: 'midi' | 'startBeat' | 'endBeat' | 'string' | 'fret',
    value: number,
  ): void => {
    const current = note()
    if (current !== undefined)
      change(changeRecordingNote(props.score, current.id, { [field]: value }))
  }
  return (
    <fieldset
      class={styles.editor}
      disabled={props.disabled}
      aria-label="Note corrections"
    >
      <strong>Detected melody · draft</strong>
      <p>
        Correct one note at a time. Fingering is suggested; chords are not yet
        transcribed. Your original recording stays untouched.
      </p>
      <Show when={problems().length > 0}>
        <p>
          {problems().length}{' '}
          {problems().length === 1 ? 'note needs' : 'notes need'} playable
          fingering. Correct the pitch/string below, or exclude these notes from
          this editable melody. The original recording and detection stay
          intact.
        </p>
        <div class={styles.actions}>
          <button
            type="button"
            onClick={() => {
              const next = props.score.notes.findIndex(
                (item, index) =>
                  index > selected() &&
                  recordingNoteNeedsFingering(props.score, item),
              )
              setSelected(
                next >= 0 ? next : props.score.notes.indexOf(problems()[0]),
              )
            }}
          >
            Find problem note
          </button>
          <button
            type="button"
            onClick={() =>
              change({
                ...props.score,
                attachment: null,
                notes: props.score.notes.filter(
                  (item) => !recordingNoteNeedsFingering(props.score, item),
                ),
              })
            }
          >
            Exclude {problems().length} problem{' '}
            {problems().length === 1 ? 'note' : 'notes'}
          </button>
        </div>
      </Show>
      <Show when={note()}>
        {(current) => (
          <>
            <label>
              Note to correct
              <select
                value={Math.min(selected(), props.score.notes.length - 1)}
                onChange={(event) =>
                  setSelected(Number(event.currentTarget.value))
                }
              >
                <For each={props.score.notes}>
                  {(item, index) => (
                    <option value={index()}>
                      {index() + 1}. {midiToNote(item.midi).name}
                      {midiToNote(item.midi).octave} · beat{' '}
                      {item.startBeat.toFixed(2)}
                      {recordingNoteNeedsFingering(props.score, item)
                        ? ' · check fingering'
                        : ''}
                    </option>
                  )}
                </For>
              </select>
            </label>
            <div class={styles.fields}>
              <label>
                Pitch (MIDI)
                <input
                  type="number"
                  min="0"
                  max="127"
                  step="1"
                  value={current().midi}
                  onChange={(event) =>
                    patch('midi', Number(event.currentTarget.value))
                  }
                />
              </label>
              <label>
                String
                <select
                  value={current().string ?? ''}
                  onChange={(event) =>
                    patch('string', Number(event.currentTarget.value))
                  }
                >
                  <option value="" disabled>
                    Outside tuning
                  </option>
                  <For each={props.score.tuning}>
                    {(_, index) => (
                      <option value={index() + 1}>{index() + 1}</option>
                    )}
                  </For>
                </select>
              </label>
              <label>
                Fret
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="1"
                  value={current().fret ?? ''}
                  onChange={(event) =>
                    patch('fret', Number(event.currentTarget.value))
                  }
                />
              </label>
              <label>
                Starts at beat
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number(current().startBeat.toFixed(4))}
                  onChange={(event) =>
                    patch('startBeat', Number(event.currentTarget.value))
                  }
                />
              </label>
              <label>
                Ends at beat
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number(current().endBeat.toFixed(4))}
                  onChange={(event) =>
                    patch('endBeat', Number(event.currentTarget.value))
                  }
                />
              </label>
            </div>
            <div class={styles.actions}>
              <button
                type="button"
                onClick={() => {
                  const item = current()
                  const middle = (item.startBeat + item.endBeat) / 2
                  change({
                    ...props.score,
                    attachment: null,
                    notes: props.score.notes.flatMap((row) =>
                      row.id === item.id
                        ? [
                            { ...row, endBeat: middle },
                            {
                              ...row,
                              id: globalThis.crypto.randomUUID(),
                              startBeat: middle,
                            },
                          ]
                        : [row],
                    ),
                  })
                }}
              >
                Split note
              </button>
              <button
                type="button"
                disabled={selected() >= props.score.notes.length - 1}
                onClick={() => {
                  const rows = [...props.score.notes]
                  const index = selected()
                  const next = rows[index + 1]
                  if (next === undefined) return
                  rows.splice(index, 2, {
                    ...rows[index],
                    endBeat: next.endBeat,
                  })
                  change({ ...props.score, attachment: null, notes: rows })
                }}
              >
                Merge with next
              </button>
              <button
                type="button"
                onClick={() =>
                  change({
                    ...props.score,
                    attachment: null,
                    notes: props.score.notes.filter(
                      (row) => row.id !== current().id,
                    ),
                  })
                }
              >
                Delete note
              </button>
            </div>
          </>
        )}
      </Show>
      <button
        type="button"
        disabled={history().length === 0}
        onClick={() => {
          const previous = history().at(-1)
          if (previous === undefined) return
          props.onChange(previous)
          setHistory((rows) => rows.slice(0, -1))
        }}
      >
        Undo correction
      </button>
      <details class={styles.editorAdvanced}>
        <summary>Tempo and snapping</summary>
        <div class={styles.editorTools}>
          <div class={styles.fields}>
            <label>
              Display tempo (BPM)
              <input
                type="number"
                min="20"
                max="300"
                value={props.score.bpm}
                onChange={(event) =>
                  change(
                    changeRecordingScoreTempo(
                      props.score,
                      Number(event.currentTarget.value),
                    ),
                  )
                }
              />
            </label>
            <label>
              Display metre
              <select
                value={props.score.timeSignature.join('/')}
                onChange={(event) => {
                  const parts = event.currentTarget.value.split('/').map(Number)
                  change({
                    ...props.score,
                    grid: 'chosen',
                    timeSignature: [parts[0], parts[1]],
                  })
                }}
              >
                <For each={['4/4', '3/4', '6/8', '2/4', '5/4', '7/8']}>
                  {(signature) => (
                    <option value={signature}>{signature}</option>
                  )}
                </For>
              </select>
            </label>
          </div>
          <p>
            {props.score.grid === 'display'
              ? 'Free timing: 120 BPM is a display grid, not an estimated song tempo.'
              : 'The chosen grid changes notation. Timing remains as played until you edit a note.'}
          </p>
          <div class={styles.actions}>
            <button
              type="button"
              onClick={() => change(quantizeRecordingScore(props.score, 2))}
            >
              Snap to eighth notes
            </button>
            <button
              type="button"
              onClick={() => change(quantizeRecordingScore(props.score, 4))}
            >
              Snap to sixteenth notes
            </button>
          </div>
          <p>
            Snapping makes notation simpler but changes the practice rhythm.
            Undo returns to the previous timing.
          </p>
        </div>
      </details>
    </fieldset>
  )
}
