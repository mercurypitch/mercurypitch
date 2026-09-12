// ============================================================
// The room sheet — which photograph, and how much of it shows
// ============================================================
//
// Device round 2, R5: "add a room background selector under the room name
// with our examples and the transparency slider the other rooms have." It is
// the OTHER ROOMS' picker, embedded — `PremiumBackgroundPicker` with the same
// controller, the same cards and the same per-surface persistence — plus the
// one-number clarity slider Guitar Night and the Ear Lab already carry.
//
// It opens from the room name chip in the shell's header, which is the place
// the owner asked for it and the only piece of chrome on this surface that
// names the room at all.

import type { Component } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import type { BackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { formatSingGlassValue, SING_GLASS, singGlassLabel, } from './sing-glass'
import styles from './sing-room.module.css'

interface SingRoomPickerProps {
  isOpen: boolean
  close: () => void
  background: BackgroundSurfaceController
  glass: () => number
  onGlassChange: (value: number) => void
}

export const SingRoomPicker: Component<SingRoomPickerProps> = (props) => (
  <Sheet
    isOpen={props.isOpen}
    close={() => props.close()}
    ariaLabel="Choose your Sing room"
    snap="tall"
  >
    <div class={styles.takeSheet} data-testid="sing-room-picker">
      <h2 class={styles.head}>Your room</h2>
      <p class={styles.caption}>
        The room is the photograph behind your line. Your choice stays on this
        device.
      </p>

      <PremiumBackgroundPicker
        controller={props.background}
        embedded
        onSelect={(option) => props.background.select(option.id)}
      />

      <label class={styles.glass}>
        <span class={styles.glassLabel}>Room visibility</span>
        <input
          type="range"
          class={styles.glassSlider}
          min={SING_GLASS.min}
          max={SING_GLASS.max}
          step={SING_GLASS.step}
          value={props.glass()}
          aria-label="Room visibility"
          aria-valuetext={formatSingGlassValue(props.glass())}
          data-testid="sing-room-glass"
          onInput={(event) =>
            props.onGlassChange(Number(event.currentTarget.value))
          }
        />
        <output class={styles.glassValue} aria-hidden="true">
          {singGlassLabel(props.glass())}
        </output>
      </label>
    </div>
  </Sheet>
)
