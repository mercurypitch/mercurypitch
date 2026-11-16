// Studio MIDI export — the Export panel's MIDI file beside its WAV: the song's notes, a track for each MIDI lane, saved at once; off, and saying why, while the song has no MIDI clip.
import { createSignal, createUniqueId, Show } from 'solid-js'
import { studioMidiLanes } from '@/lib/studio/midi/song-midi-file'
import type { StudioProject } from '@/lib/studio/model/types'
import common from '../StudioPage.module.css'
import { downloadStudioSongMidi } from './midi-download'
import styles from './StudioExport.module.css'

/** Why the MIDI file is off. */
export const STUDIO_NO_MIDI = 'This song has no MIDI clips yet.'

/** The lanes a file's tracks are named after, the first three by name. */
function laneList(names: readonly string[]): string {
  if (names.length <= 3) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

/** A tempo as the song's settings show it, to a hundredth at most. */
function tempoWords(tempoBpm: number): string {
  return `${Math.round(tempoBpm * 100) / 100} bpm · 4/4`
}

export function StudioMidiExport(props: { project: StudioProject }) {
  const reason = createUniqueId()
  const [notice, setNotice] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const lanes = () => studioMidiLanes(props.project).map((track) => track.name)
  const off = () => lanes().length === 0

  function download(): void {
    setNotice(null)
    setError(null)
    try {
      downloadStudioSongMidi(props.project)
      setNotice('Download requested. Your browser handles the file.')
    } catch {
      setError('The MIDI file could not be made. Try Export MIDI again.')
    }
  }

  return (
    <div class={styles.section} data-studio-midi-export="">
      <div class={styles.format}>
        <strong>MIDI</strong>
        <span>MIDI file (.mid)</span>
        <small>Notes only, a track per lane. Opens in other music apps.</small>
      </div>
      <Show
        when={!off()}
        fallback={
          <p id={reason} class={common.help}>
            {STUDIO_NO_MIDI}
          </p>
        }
      >
        <dl class={styles.details}>
          <div>
            <dt>Tracks</dt>
            <dd>{laneList(lanes())}</dd>
          </div>
          <div>
            <dt>Tempo</dt>
            <dd>{tempoWords(props.project.tempoBpm)}</dd>
          </div>
        </dl>
      </Show>
      <button
        type="button"
        class={common.button}
        disabled={off()}
        aria-describedby={off() ? reason : undefined}
        onClick={download}
      >
        Export MIDI
      </button>
      <Show when={error()}>
        {(message) => (
          <p role="alert" class={styles.error}>
            {message()}
          </p>
        )}
      </Show>
      <Show when={notice()}>
        {(message) => (
          <p role="status" class={common.help}>
            {message()}
          </p>
        )}
      </Show>
    </div>
  )
}
