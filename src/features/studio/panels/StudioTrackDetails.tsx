// Studio track details — name and musical role stay separate from audio provenance; role pictures are this device's choice for every lane, and a loop take's passes are comped here on a phone.
import { createMemo, For } from 'solid-js'
import styles from '@/features/studio/StudioPage.module.css'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioProject, StudioTrack, } from '@/lib/studio/model/types'
import { isTrackRole, ROLE_LABELS, TRACK_ROLES, } from '@/lib/studio-fx/role-chains'
import { setStudioRolePictures, studioRolePictures, } from '../timeline/role-pictures'
import { StudioCompSheet } from './StudioCompSheet'

interface StudioTrackDetailsProps {
  track: StudioTrack
  project: StudioProject
  /** The song's audio: the lane lists what its clips play. */
  assets: readonly StudioAsset[]
  writable: boolean
  onCommand(command: StudioCommand): boolean
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
      <p class={styles.help}>Choose the part this track plays in your song.</p>
      <label class={styles.checkField}>
        <input
          type="checkbox"
          checked={studioRolePictures()}
          onChange={(event) =>
            setStudioRolePictures(event.currentTarget.checked)
          }
        />
        <span>Role pictures</span>
      </label>
      <p class={styles.help}>
        Each lane header shows its instrument as a picture, or as a line icon
        when this is off. Saved on this device.
      </p>
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
      <StudioCompSheet
        trackId={props.track.id}
        clips={props.project.clips}
        assets={laneAssets()}
        tempoBpm={props.project.tempoBpm}
        writable={props.writable}
        onCommand={props.onCommand}
      />
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
