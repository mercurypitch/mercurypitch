// ============================================================
// KaraokeSoundStopped — why the song stopped by itself, over the room
// ============================================================
//
// Shown while the mixer says its song stopped because its clock did
// (HostedMixerControls.stalled), and gone the moment the singer plays,
// pauses or stops, or the next song comes on. The words follow the route as
// it is now (sound-stopped.ts), so a singer who chooses this phone in
// Control Center sees the notice turn into Play again without leaving the
// room. The AirPlay notice offers nothing to press, so it can be closed
// (44 px, as every control here); it stays closed until the route moves or
// the song stops again.
//
// Like the premium rooms' volume hint (RoomVolumeHint.tsx), the status
// region is always there, empty while the song is fine, so a screen reader
// hears the notice the moment it appears; only the card takes taps. It sits
// over the middle of the stage, above the stage's pills and bar, where the
// stopped lyrics are.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, Show } from 'solid-js'
import { VolumeX, X } from '@/components/icons'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { audioRoute, audioRoutePort } from '@/stores/audio-route-store'
import type { NativeAudioRoute } from '@/stores/native-shell-store'
import styles from './KaraokeSoundStopped.module.css'
import { CLOSE_NOTICE, PLAY_AGAIN, soundStoppedNotice } from './sound-stopped'

export interface KaraokeSoundStoppedProps {
  /** The mixer on the stage, or null between songs. */
  mixer: Accessor<HostedMixerControls | null>
}

export function KaraokeSoundStopped(props: KaraokeSoundStoppedProps) {
  const stalled = (): boolean => props.mixer()?.stalled() === true
  // The route a notice was closed on: a new route, or a new stop, shows one.
  const [closedOn, setClosedOn] = createSignal<{
    readonly route: NativeAudioRoute | null
  } | null>(null)
  createEffect(
    on(stalled, (now) => {
      if (!now) setClosedOn(null)
    }),
  )
  const notice = createMemo(() => {
    if (!stalled()) return null
    const route = audioRoute()
    if (closedOn()?.route === route) return null
    return soundStoppedNotice(route, audioRoutePort())
  })
  return (
    <div class={styles.slot} role="status" data-testid="karaoke-sound-slot">
      <Show when={notice()}>
        {(shown) => (
          <div class={styles.notice} data-testid="karaoke-sound-stopped">
            <span class={styles.icon} aria-hidden="true">
              <VolumeX />
            </span>
            <div class={styles.words}>
              <For each={shown().lines}>{(line) => <p>{line}</p>}</For>
              <Show when={shown().playAgain}>
                <button
                  type="button"
                  class={styles.play}
                  onClick={() => props.mixer()?.play()}
                >
                  {PLAY_AGAIN}
                </button>
              </Show>
            </div>
            <Show when={shown().closable}>
              <button
                type="button"
                class={styles.close}
                aria-label={CLOSE_NOTICE}
                onClick={() => setClosedOn({ route: audioRoute() })}
              >
                <X />
              </button>
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
