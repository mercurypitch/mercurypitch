// ============================================================
// Save a transcribed line as MIDI or Guitar Pro
// ============================================================
//
// "Transcribe the bass line" puts the line on the stage; these two buttons
// write those same notes to a file, through the recorder's own writers
// (measured-reference-export.ts). Each format's rules decide whether it can
// be written: a button that cannot says why in its tooltip, as the
// recorder's review does, and a writer that refuses at the last step says
// why under the buttons, leaving the other format available.

import { createMemo, createSignal, createUniqueId, Show } from 'solid-js'
import { GuitarTab, Midi } from '@/components/icons'
import { recordingMidiProblem, recordingScoreProblem, } from '@/lib/guitar/recording-score'
import { practiceScoreFromMeasuredReference } from './measured-reference-export'
import styles from './MeasuredLineExport.module.css'
import type { GuitarNightReference } from './reference-port'

/** An uploaded song is listed under its file name; the score is not. */
const AUDIO_EXTENSION =
  /\.(?:aac|aiff?|flac|m4a|mp3|mp4|oga|ogg|opus|wav|webm)$/i

export interface MeasuredLineExportProps {
  /** The line on the stage; only a measured line with notes is offered. */
  reference: GuitarNightReference
  /** The song the line was read from, as the library lists it. */
  songTitle: string
}

export function MeasuredLineExport(props: MeasuredLineExportProps) {
  const score = createMemo(() =>
    practiceScoreFromMeasuredReference(
      props.reference,
      props.songTitle.trim().replace(AUDIO_EXTENSION, ''),
    ),
  )
  const lineName = () => props.reference.trackName.toLowerCase()
  const labelId = createUniqueId()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  let host: HTMLDivElement | undefined

  const save = async (format: 'mid' | 'gp'): Promise<void> => {
    const current = score()
    if (current === null || busy()) return
    setBusy(true)
    setError(null)
    try {
      const { downloadRecordingScore } =
        await import('@/lib/guitar/recording-export')
      await downloadRecordingScore(current, format, host)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The line could not be saved. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Show when={score()}>
      {(current) => {
        const midiProblem = createMemo(() => recordingMidiProblem(current()))
        const problem = createMemo(() => recordingScoreProblem(current()))
        return (
          <div
            ref={host}
            class={styles.lineExport}
            role="group"
            aria-labelledby={labelId}
            aria-busy={busy()}
            data-note-count={current().notes.length}
          >
            <span id={labelId} class={styles.label}>
              Save the {lineName()} line as
            </span>
            <button
              type="button"
              class={styles.action}
              aria-label={`Save the ${lineName()} line as MIDI`}
              disabled={busy() || midiProblem() !== null}
              title={midiProblem() ?? 'Export MIDI'}
              onClick={() => void save('mid')}
            >
              <span aria-hidden="true">
                <Midi />
              </span>
              <span>MIDI</span>
            </button>
            <button
              type="button"
              class={styles.action}
              aria-label={`Save the ${lineName()} line as Guitar Pro`}
              disabled={busy() || problem() !== null}
              title={problem() ?? 'Export Guitar Pro 7'}
              onClick={() => void save('gp')}
            >
              <span aria-hidden="true">
                <GuitarTab />
              </span>
              <span>Guitar Pro</span>
            </button>
            <Show when={error()}>
              {(message) => (
                <p class={styles.error} role="alert">
                  {message()}
                </p>
              )}
            </Show>
          </div>
        )
      }}
    </Show>
  )
}
