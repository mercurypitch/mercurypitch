// Studio lane header pieces — the role plate (the lane's instrument as a picture or a line icon) and the lane's arm button.
import { createSignal, Show } from 'solid-js'
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import { ROLE_LABELS } from '@/lib/studio-fx/role-chains'
import { RecordDot } from '../studio-icons'
import { StudioRoleIcon } from './role-icons'
import { studioRolePicture, studioRolePictures } from './role-pictures'
import styles from './StudioLaneHeader.module.css'
import type { StudioLaneArming } from './types'

/**
 * The lane's role on its hue: the picture while role pictures are on and
 * it loads, else the line icon. Named for a screen reader, which hears the
 * role here and the lane's name on the button beside it.
 */
export function StudioRolePlate(props: {
  role: TrackRole
  /** The phone Mix sheet's rounded tile, not the header's edge. */
  list?: boolean
}) {
  // A picture that would not load shows the icon until the role changes.
  const [failed, setFailed] = createSignal<TrackRole | null>(null)
  const picture = () =>
    studioRolePictures() && failed() !== props.role
      ? studioRolePicture(props.role)
      : null
  return (
    <span
      class={props.list === true ? styles.listPlate : styles.plate}
      role="img"
      aria-label={ROLE_LABELS[props.role]}
      title={ROLE_LABELS[props.role]}
      data-studio-role-plate={props.role}
      data-tour={props.list === true ? undefined : 'studio.role'}
      data-picture={picture() === null ? undefined : ''}
    >
      <Show when={picture()} fallback={<StudioRoleIcon role={props.role} />}>
        {(source) => (
          <img
            src={source()}
            alt=""
            width="128"
            height="128"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(props.role)}
          />
        )}
      </Show>
    </span>
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
      classList={{ [styles.touchArm]: props.touch === true }}
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
    </button>
  )
}
