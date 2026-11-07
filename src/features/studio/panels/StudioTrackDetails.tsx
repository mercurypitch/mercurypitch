// Studio track details — the lane's own sheet: its lines (and on a phone its arm), name, instrument, mix role and the input it records from, apart from where its audio came from.
import { For, Show } from 'solid-js'
import styles from '@/features/studio/StudioPage.module.css'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioTrack } from '@/lib/studio/model/types'
import { isTrackRole, ROLE_LABELS, TRACK_ROLES, } from '@/lib/studio-fx/role-chains'
import { StudioInstrumentPicker } from '../instruments/StudioInstrumentPicker'
import type { StudioLaneInputRecorder } from '../record/StudioLaneInputField'
import { StudioLaneInputField } from '../record/StudioLaneInputField'
import { studioTakeRunning } from '../record/take-running'
import { requestStudioLaneLines } from '../timeline/lane-lines-request'
import { LaneLine } from '../timeline/line-icons'
import { StudioArmButton } from '../timeline/StudioLaneHeader'
import type { StudioLaneArming } from '../timeline/types'

interface StudioTrackDetailsProps {
  track: StudioTrack
  assets: readonly StudioAsset[]
  writable: boolean
  /** A phone's lane headers have no arm: its details have, as its Mix sheet does. */
  arming?: StudioLaneArming
  /** The lane's own input and channel, on this device; absent where nothing records. */
  input?: StudioLaneInputRecorder
  /** The lane header's input chip opened the details: the input takes the focus. */
  focusInput?: boolean
  onInputFocused?(): void
  onCommand(command: StudioCommand): boolean
  /** After the lane's lines open in the arrangement: an overlaid panel steps out of their way. */
  afterLines?(): void
  onRemove(): void
}

export function StudioTrackDetails(props: StudioTrackDetailsProps) {
  return (
    <div class={styles.detailsFields}>
      <div class={styles.laneActions}>
        <Show when={props.arming}>
          {(arming) => (
            <StudioArmButton
              trackId={props.track.id}
              name={props.track.name}
              arming={arming()}
              caption="Arm"
              touch
            />
          )}
        </Show>
        <button
          type="button"
          class={styles.laneAction}
          disabled={studioTakeRunning()}
          title={
            studioTakeRunning()
              ? 'Stop the take to draw lines'
              : 'Draw this track’s volume and pan lines'
          }
          onClick={() => {
            requestStudioLaneLines(props.track.id)
            props.afterLines?.()
          }}
        >
          <LaneLine size={18} />
          Volume and pan lines
        </button>
      </div>
      <label class={styles.stackedField}>
        <span>Track name</span>
        <input
          value={props.track.name}
          maxLength={160}
          disabled={!props.writable}
          onChange={(event) => {
            if (
              !props.onCommand({
                type: 'update-track',
                trackId: props.track.id,
                changes: { name: event.currentTarget.value.trim() },
              })
            )
              event.currentTarget.value = props.track.name
          }}
        />
      </label>
      <StudioInstrumentPicker
        track={props.track}
        writable={props.writable}
        onCommand={props.onCommand}
      />
      <label class={styles.stackedField}>
        <span>Sound role</span>
        <select
          value={props.track.role}
          disabled={!props.writable}
          onChange={(event) => {
            const role = event.currentTarget.value
            if (isTrackRole(role))
              props.onCommand({
                type: 'set-track-role',
                trackId: props.track.id,
                role,
              })
          }}
        >
          <For each={TRACK_ROLES}>
            {(role) => <option value={role}>{ROLE_LABELS[role]}</option>}
          </For>
        </select>
      </label>
      <p class={styles.help}>
        The part this track plays sets its sound. The instrument is only its
        picture.
      </p>
      <Show when={props.input}>
        {(input) => (
          <StudioLaneInputField
            trackId={props.track.id}
            trackName={props.track.name}
            recorder={input()}
            focus={props.focusInput}
            onFocused={props.onInputFocused}
          />
        )}
      </Show>
      <div class={styles.fieldDivider} />
      <h3>Audio in this track</h3>
      <ul class={styles.assetList}>
        <For each={props.assets}>
          {(asset) => (
            <li>
              {asset.originalName ?? 'Kept take'}
              <span>
                {asset.channels === 1 ? 'Mono' : 'Stereo'} ·{' '}
                {Math.round(asset.normalizedFrameCount / 4800) / 10} s
              </span>
            </li>
          )}
        </For>
      </ul>
      <button
        type="button"
        class={styles.dangerButton}
        disabled={!props.writable}
        onClick={() => props.onRemove()}
      >
        Remove track
      </button>
      <p class={styles.help}>
        You can undo this. The original takes stay in your library.
      </p>
    </div>
  )
}
