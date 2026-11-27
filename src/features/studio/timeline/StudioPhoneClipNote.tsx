// Studio phone clip note — on a phone a clip is edited elsewhere, but its toolbar's Range lives here: Repeat and Punch work from a phone too. A MIDI clip's notes open here as well, and save as a MIDI file: a phone has no Clip details.
import { Show } from 'solid-js'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import type { StudioFrameRange } from '@/lib/studio/playback/loop-range'
import { studioTakeRunning } from '../record/take-running'
import { FileDown, InfoCircle, NoteBars, RangeBrackets } from '../studio-icons'
import { StudioTakesButton } from './StudioTakesButton'
import styles from './StudioTimeline.module.css'
import { clipEndFrame } from './timeline-geometry'

export function StudioPhoneClipNote(props: {
  name: string
  clip: StudioClip | null
  onRange?(range: StudioFrameRange): void
  /** Open a MIDI clip's notes: the editor fills a phone's screen. */
  onEditNotes?(clipId: string): void
  /** Save a MIDI clip's notes alone as a MIDI file. */
  onExportMidi?(clipId: string): void
  /** The song's audio by id, and the song's commands: a clip of several takes lists them here. */
  assets?: ReadonlyMap<string, StudioAsset>
  writable?: boolean
  onCommand?(command: StudioCommand): boolean
}) {
  const midi = () =>
    props.clip?.midi !== undefined && props.onEditNotes !== undefined
  return (
    <p class={styles.phoneNote}>
      <InfoCircle size={16} />
      <strong>{props.name}</strong>
      <Show
        when={midi() && props.clip}
        fallback={<span>Edit clips on a tablet or computer.</span>}
      >
        {(clip) => (
          <button
            type="button"
            class={styles.phoneNoteRange}
            aria-label="Edit notes"
            title="Edit this clip's notes. Tapping the clip twice opens them too."
            data-studio-phone-notes=""
            onClick={() => props.onEditNotes?.(clip().id)}
          >
            <NoteBars size={15} />
            <span>Notes</span>
          </button>
        )}
      </Show>
      <Show
        when={
          props.clip?.midi !== undefined && props.onExportMidi && props.clip
        }
      >
        {(clip) => (
          <button
            type="button"
            class={styles.phoneNoteRange}
            aria-label="Export MIDI"
            title="Save this clip's notes as a MIDI file"
            data-studio-phone-export-midi=""
            onClick={() => props.onExportMidi?.(clip().id)}
          >
            <FileDown size={15} />
            <span>MIDI</span>
          </button>
        )}
      </Show>
      <Show
        when={props.clip?.takes !== undefined && props.onCommand && props.clip}
      >
        {(clip) => (
          <StudioTakesButton
            clip={clip()}
            assets={props.assets ?? new Map()}
            writable={props.writable === true}
            class={styles.phoneNoteRange}
            onCommand={(command) => props.onCommand?.(command) === true}
          />
        )}
      </Show>
      <Show when={props.onRange && props.clip}>
        {(clip) => (
          <button
            type="button"
            class={styles.phoneNoteRange}
            title="Set the range to this clip, for Repeat and Punch"
            disabled={studioTakeRunning()}
            onClick={() =>
              props.onRange?.({
                startFrame: clip().startFrame,
                endFrame: clipEndFrame(clip()),
              })
            }
          >
            <RangeBrackets size={15} />
            <span>Range</span>
          </button>
        )}
      </Show>
    </p>
  )
}
