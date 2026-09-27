// ============================================================
// RoomNoiseScreen — Quiet, Home or Noisy
// ============================================================
//
// S6 7a moves the room-noise preset onto the Microphone screen, as a row
// that pushes this list. The three rooms are the named stops of one scale
// (sensitivity-scale.ts): choosing one sets exactly that stop. A position
// set by hand between two stops, with the web's slider, shows as the one in
// force, so the list never reads as if nothing were chosen.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { describeSensitivityPosition, SENSITIVITY_STOPS, sensitivityPresetLabel, } from '@/lib/sensitivity-scale'
import type { SensitivityPreset } from '@/stores/settings-store'
import { applySensitivityPosition, sensitivityPosition, } from '@/stores/settings-store'
import { SettingsChoice } from './SettingsList'

/** What each room is for, under its name. */
const ROOMS: Record<SensitivityPreset, string> = {
  quiet: 'A quiet room: the softest notes get through',
  home: 'Most rooms',
  noisy: 'A loud room: ignores more of it, and more of you with it',
}

export function RoomNoiseScreen(): JSX.Element {
  const between = (): boolean =>
    SENSITIVITY_STOPS.every((stop) => stop.position !== sensitivityPosition())

  return (
    <div class="mp-set" data-testid="room-noise-screen">
      <p class="mp-set__caption">How much of the room to ignore.</p>
      <div class="mp-set-list" role="radiogroup" aria-label="Room noise">
        <For each={SENSITIVITY_STOPS}>
          {(stop) => (
            <SettingsChoice
              id={stop.preset}
              label={sensitivityPresetLabel(stop.preset)}
              sub={ROOMS[stop.preset]}
              checked={sensitivityPosition() === stop.position}
              onChoose={() => {
                applySensitivityPosition(stop.position)
              }}
            />
          )}
        </For>
        <Show when={between()}>
          <SettingsChoice
            id="between"
            label={describeSensitivityPosition(sensitivityPosition())}
            sub="Set by hand"
            checked={true}
            onChoose={() => undefined}
          />
        </Show>
      </div>
    </div>
  )
}
