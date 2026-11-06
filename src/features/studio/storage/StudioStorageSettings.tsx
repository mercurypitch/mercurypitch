// Studio audio storage — Full quality or Save space for new audio on this device, how full this song is, and whether the browser keeps the songs; in Song options.
import { Show } from 'solid-js'
import { studioProjectStorageShare } from '@/lib/studio/model/storage-limits'
import type { StudioAsset } from '@/lib/studio/model/types'
import common from '../StudioPage.module.css'
import { STUDIO_STORAGE_EXPORTS, studioProtectionText } from './storage-copy'
import type { StudioProtection } from './studio-persistence'
import styles from './StudioStorage.module.css'
import { StudioStorageChoices } from './StudioStorageChoices'
import { useStudioStorageQuality } from './useStudioStorageQuality'

/** The song's audio as a share of its room: none, or a whole percent up to 100. */
function roomText(assets: readonly StudioAsset[]): string {
  if (assets.length === 0) return 'This song has no audio yet.'
  const used = Math.min(
    100,
    Math.max(1, Math.round(studioProjectStorageShare(assets) * 100)),
  )
  return `This song’s audio fills ${used}% of its room.`
}

/** A device setting, not the song's: it stays usable on a song this tab cannot edit. */
export function StudioStorageSettings(props: {
  assets: readonly StudioAsset[]
  protection: StudioProtection | null
}) {
  const storage = useStudioStorageQuality()
  return (
    <div class={styles.settings} data-studio-storage-settings="">
      <StudioStorageChoices
        legend="Audio storage"
        quality={storage.quality()}
        onChoose={storage.choose}
      />
      <p class={common.help}>
        New audio on this device is kept this way; audio already in a song stays
        as it is. {STUDIO_STORAGE_EXPORTS}
      </p>
      <p class={styles.readout}>{roomText(props.assets)}</p>
      <Show when={studioProtectionText(props.protection)}>
        {(text) => (
          <p
            class={styles.readout}
            data-studio-protection={props.protection ?? undefined}
          >
            {text()}
          </p>
        )}
      </Show>
    </div>
  )
}
