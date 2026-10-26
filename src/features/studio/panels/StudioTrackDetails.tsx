// Studio track details — name and musical role stay separate from audio provenance.
import { For } from 'solid-js'
import styles from '@/features/studio/StudioPage.module.css'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioTrack } from '@/lib/studio/model/types'
import { isTrackRole, ROLE_LABELS, TRACK_ROLES, } from '@/lib/studio-fx/role-chains'

interface StudioTrackDetailsProps {
  track: StudioTrack
  assets: readonly StudioAsset[]
  writable: boolean
  onCommand(command: StudioCommand): boolean
  onRemove(): void
}

export function StudioTrackDetails(props: StudioTrackDetailsProps) {
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
