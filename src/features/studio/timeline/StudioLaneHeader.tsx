// Studio lane header pieces — the lane's instrument as a glyph on its family's hue, and the lane's arm button.
import { createMemo, Show } from 'solid-js'
import { instrumentGlyph } from '@/lib/studio/instruments/glyph-catalog'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import type { StudioTrack } from '@/lib/studio/model/types'
import type { InstrumentChipSize } from '../instruments/InstrumentGlyph'
import { InstrumentChip, InstrumentGlyph } from '../instruments/InstrumentGlyph'
import { RecordDot } from '../studio-icons'
import styles from './StudioLaneHeader.module.css'
import type { StudioLaneArming } from './types'

/**
 * The lane's instrument: the one the singer picked, else what its name and
 * role say (lib/studio/instruments/resolve.ts), in a chip of its family's
 * hue, or bare in the hue's ink where a phone has no room for a chip. Named
 * for a screen reader, which hears the instrument here and the lane's name
 * on the button beside it. A press on it goes to the header.
 */
export function StudioLaneInstrument(props: {
  track: Pick<StudioTrack, 'instrument' | 'name' | 'role'>
  /** A chip's size, or bare: the glyph alone at 16 px. */
  size: InstrumentChipSize | 'bare'
  silent?: boolean
  tour?: string
}) {
  // Read for the glyph, its family, its label and the chip's hook: resolved once.
  const lane = createMemo(() => studioLaneInstrument(props.track))
  const label = () => instrumentGlyph(lane().glyph).label
  return (
    <Show
      when={props.size !== 'bare' && props.size}
      fallback={
        <span
          class={styles.bareGlyph}
          role="img"
          aria-label={label()}
          title={label()}
          data-instrument-chip={lane().glyph}
          data-silent={props.silent === true ? '' : undefined}
          data-tour={props.tour}
        >
          <InstrumentGlyph glyph={lane().glyph} size={16} />
        </span>
      }
    >
      {(size) => (
        <InstrumentChip
          glyph={lane().glyph}
          family={lane().family}
          size={size()}
          label={label()}
          silent={props.silent}
          tour={props.tour}
        />
      )}
    </Show>
  )
}

const RUNNING_TAKE = new Set(['counting', 'recording', 'finishing'])

/**
 * The lane's record arm. Pressed, the lane is armed: the microphone opens
 * and the next Record records here. Pressing another lane's moves the arm;
 * pressing the armed lane's disarms it. A running take holds every button.
 */
export function StudioArmButton(props: {
  trackId: string
  name: string
  arming: StudioLaneArming
  touch?: boolean
  /** A word beside the dot, where the button stands among worded ones. */
  caption?: string
}) {
  const armed = () => props.arming.armedTrackId() === props.trackId
  const taking = () => RUNNING_TAKE.has(props.arming.phase())
  const title = () => {
    if (!armed())
      return taking()
        ? 'Stop the take to arm another lane'
        : `Arm ${props.name} for recording`
    if (props.arming.phase() === 'arming') return 'Opening the microphone'
    if (taking()) return `Recording on ${props.name}`
    return `${props.name} is armed. Record (R) starts a take here. Press to disarm.`
  }
  return (
    <button
      type="button"
      class={styles.arm}
      classList={{
        [styles.touchArm]: props.touch === true,
        [styles.captioned]: props.caption !== undefined,
      }}
      data-studio-arm={props.trackId}
      data-tour="studio.arm"
      data-phase={armed() ? props.arming.phase() : 'idle'}
      aria-label={`Arm ${props.name} for recording`}
      aria-pressed={armed()}
      title={title()}
      disabled={taking() || (!armed() && !props.arming.canArm())}
      onClick={() => props.arming.toggle(props.trackId)}
    >
      <RecordDot />
      {props.caption}
    </button>
  )
}
