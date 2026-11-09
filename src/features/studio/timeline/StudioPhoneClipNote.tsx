// Studio phone clip note — on a phone a clip is edited elsewhere, but its toolbar's Range lives here: Repeat and Punch work from a phone too. A MIDI clip's notes open here as well.
import { Show } from 'solid-js'
import type { StudioClip } from '@/lib/studio/model/types'
import type { StudioFrameRange } from '@/lib/studio/playback/loop-range'
import { studioTakeRunning } from '../record/take-running'
import { InfoCircle, NoteBars, RangeBrackets } from '../studio-icons'
import styles from './StudioTimeline.module.css'
import { clipEndFrame } from './timeline-geometry'

export function StudioPhoneClipNote(props: {
  name: string
  clip: StudioClip | null
  onRange?(range: StudioFrameRange): void
  /** Open a MIDI clip's notes: the editor fills a phone's screen. */
  onEditNotes?(clipId: string): void
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
