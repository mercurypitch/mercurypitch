// Studio phone mix — the Mix sheet's lane list: each lane's instrument chip, name and arm button, then its compact mix controls.
import { createMemo, For, Show } from 'solid-js'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioProject } from '@/lib/studio/model/types'
import styles from '../StudioPage.module.css'
import { StudioArmButton, StudioLaneInstrument, } from '../timeline/StudioLaneHeader'
import { StudioTrackControls } from '../timeline/StudioTrackControls'
import { studioTrackColor, studioTrackHue } from '../timeline/track-hues'
import type { StudioLaneArming } from '../timeline/types'

interface StudioPhoneMixProps {
  project: StudioProject
  writable: boolean
  /** The lanes' arm buttons: a phone's lane headers have room for them only when few. */
  arming?: StudioLaneArming
  onCommand(command: StudioCommand): boolean
  onTrackDetails(id: string): void
}

export function StudioPhoneMix(props: StudioPhoneMixProps) {
  const trackIds = createMemo(() =>
    [...props.project.tracks]
      .sort((a, b) => a.order - b.order)
      .map((track) => track.id),
  )
  const anySolo = createMemo(() =>
    props.project.tracks.some((track) => track.solo),
  )
  return (
    <div class={styles.phoneMix}>
      <For each={trackIds()}>
        {(id, index) => {
          const track = () =>
            props.project.tracks.find((item) => item.id === id)!
          // Silent as its timeline header says: muted, or another lane soloed.
          const silent = () => track().mute || (anySolo() && !track().solo)
          return (
            <div
              class={styles.phoneTrack}
              data-studio-phone-track={id}
              data-armed={
                (props.arming?.laneState(id) ?? 'idle') === 'idle'
                  ? undefined
                  : ''
              }
              style={{
                '--studio-track': studioTrackColor(
                  studioTrackHue(track(), index()),
                ),
              }}
            >
              <div class={styles.phoneTrackHead}>
                <StudioLaneInstrument
                  track={track()}
                  size={32}
                  silent={silent()}
                />
                <button
                  type="button"
                  class={styles.textButton}
                  onClick={() => props.onTrackDetails(id)}
                >
                  <span class={styles.phoneTrackName}>{track().name}</span>
                </button>
                <Show when={props.arming}>
                  {(arming) => (
                    <StudioArmButton
                      trackId={id}
                      name={track().name}
                      arming={arming()}
                      touch
                    />
                  )}
                </Show>
              </div>
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
