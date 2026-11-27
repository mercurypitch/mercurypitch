// Studio track details — the lane's own sheet: its lines (and on a phone its arm), name, instrument, mix role and the input it records from, apart from where its audio came from; on a phone its loop takes are comped here too.
import { createMemo, For, Show } from 'solid-js'
import styles from '@/features/studio/StudioPage.module.css'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioProject, StudioTrack, } from '@/lib/studio/model/types'
import { isTrackRole, ROLE_LABELS, TRACK_ROLES, } from '@/lib/studio-fx/role-chains'
import { StudioInstrumentPicker } from '../instruments/StudioInstrumentPicker'
import type { StudioLaneInputRecorder } from '../record/StudioLaneInputField'
import { StudioLaneInputField } from '../record/StudioLaneInputField'
import { studioTakeRunning } from '../record/take-running'
import { requestStudioLaneLines } from '../timeline/lane-lines-request'
import { STUDIO_HEAR_YOURSELF_LABEL, studioHearYourself, } from '../timeline/lane-menu-items'
import { LaneLine } from '../timeline/line-icons'
import { StudioArmButton } from '../timeline/StudioLaneHeader'
import type { StudioLaneArming, StudioRecordSettingsSource, } from '../timeline/types'
import { StudioCompSheet } from './StudioCompSheet'

interface StudioTrackDetailsProps {
  track: StudioTrack
  project: StudioProject
  /** The song's audio: the lane lists what its clips play. */
  assets: readonly StudioAsset[]
  writable: boolean
  /**
   * A phone has no room for comp rows under its lanes: its details comp the
   * lane's loop takes bar by bar instead (StudioCompSheet). A computer or a
   * tablet comps under the lane (StudioCompLanes), so its details do not.
   */
  phone?: boolean
  /** A phone's lane headers have no arm: its details have, as its Mix sheet does. */
  arming?: StudioLaneArming
  /** The lane's own input and channel, on this device; absent where nothing records. */
  input?: StudioLaneInputRecorder
  /** Where Hear yourself, the Studio's one monitoring switch, is kept, as Sound has it; absent where nothing records. */
  recordSettings?: StudioRecordSettingsSource
  /** The lane header's input chip opened the details: the input takes the focus. */
  focusInput?: boolean
  onInputFocused?(): void
  /** Open the Inputs view, where every input shows with its channels and levels. */
  onInputs?(): void
  onCommand(command: StudioCommand): boolean
  /** After the lane's lines open in the arrangement: an overlaid panel steps out of their way. */
  afterLines?(): void
  onRemove(): void
}

export function StudioTrackDetails(props: StudioTrackDetailsProps) {
  const laneAssets = createMemo(() => {
    const ids = new Set(
      props.project.clips
        .filter((clip) => clip.trackId === props.track.id)
        .map((clip) => clip.assetId),
    )
    return props.assets.filter((asset) => ids.has(asset.id))
  })
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
            onAllInputs={props.onInputs}
            instrument={studioLaneInstrument(props.track)}
          />
        )}
      </Show>
      <Show
        when={props.recordSettings && studioHearYourself(props.recordSettings)}
      >
        {(hear) => (
          <>
            <label class={styles.toggleField}>
              <input
                type="checkbox"
                checked={hear().on()}
                data-studio-hear-yourself=""
                onChange={(event) => hear().set(event.currentTarget.checked)}
              />
              <span>{STUDIO_HEAR_YOURSELF_LABEL}</span>
            </label>
            <p class={styles.help}>
              One switch for the Studio, the same as Monitor through headphones
              in Sound. Wear headphones, or the mic hears the speakers.
            </p>
          </>
        )}
      </Show>
      <div class={styles.fieldDivider} />
      <h3>Audio in this track</h3>
      <ul class={styles.assetList}>
        <For each={laneAssets()}>
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
      <Show when={props.phone}>
        <StudioCompSheet
          trackId={props.track.id}
          clips={props.project.clips}
          assets={laneAssets()}
          tempoBpm={props.project.tempoBpm}
          ruler={props.project.ruler}
          writable={props.writable}
          onCommand={props.onCommand}
        />
      </Show>
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
