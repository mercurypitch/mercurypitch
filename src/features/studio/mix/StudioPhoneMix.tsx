// Studio phone mix — the Mix sheet's lane list: each lane's name, then its compact mix controls.
import { createMemo, For } from 'solid-js'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioProject } from '@/lib/studio/model/types'
import styles from '../StudioPage.module.css'
import { StudioTrackControls } from '../timeline/StudioTrackControls'
import { studioTrackColor, studioTrackHue } from '../timeline/track-hues'

interface StudioPhoneMixProps {
  project: StudioProject
  writable: boolean
  onCommand(command: StudioCommand): boolean
  onTrackDetails(id: string): void
}

export function StudioPhoneMix(props: StudioPhoneMixProps) {
  const trackIds = createMemo(() =>
    [...props.project.tracks]
      .sort((a, b) => a.order - b.order)
      .map((track) => track.id),
  )
  return (
    <div class={styles.phoneMix}>
      <For each={trackIds()}>
        {(id, index) => {
          const track = () =>
            props.project.tracks.find((item) => item.id === id)!
          return (
            <div
              class={styles.phoneTrack}
              style={{
                '--studio-track': studioTrackColor(
                  studioTrackHue(track(), index()),
                ),
              }}
            >
              <button
                type="button"
                class={styles.textButton}
                onClick={() => props.onTrackDetails(id)}
              >
                {track().name}
              </button>
              <StudioTrackControls
                track={track()}
                writable={props.writable}
                compact={true}
                onCommand={props.onCommand}
              />
            </div>
          )
        }}
      </For>
    </div>
  )
}
