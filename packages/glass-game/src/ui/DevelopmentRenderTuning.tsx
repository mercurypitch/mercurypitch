// Development rendering controls — one accessible graphics and fracture-speed fieldset in both games.
import { For } from 'solid-js'
import { SHATTER_PLAYBACK_SPEED } from '../core/shatter-presentation'
import type { GlassRenderQualityPreference, GlassRenderQualityProfile, } from '../render/render-quality'
import styles from './DevelopmentRenderTuning.module.css'

export interface DevelopmentRenderControls {
  readonly renderQualityPreference: GlassRenderQualityPreference
  readonly renderQualityProfile: GlassRenderQualityProfile
  readonly shatterPlaybackSpeed: number
  onRenderQualityChange(preference: GlassRenderQualityPreference): void
  onShatterPlaybackSpeedChange(speed: number): void
}

export function DevelopmentRenderTuning(props: DevelopmentRenderControls) {
  return (
    <fieldset class={styles.group}>
      <legend>Graphics and glass</legend>
      <div class={styles.caption}>
        Current output: {props.renderQualityProfile}
      </div>
      <div class={styles.choices} role="group" aria-label="Graphics quality">
        <For
          each={
            [
              { id: 'auto', label: 'Auto' },
              { id: 'high', label: 'High' },
              { id: 'balanced', label: 'Balanced' },
            ] as const
          }
        >
          {(quality) => (
            <button
              type="button"
              aria-pressed={props.renderQualityPreference === quality.id}
              onClick={() => props.onRenderQualityChange(quality.id)}
            >
              {quality.label}
            </button>
          )}
        </For>
      </div>
      <p class={styles.caption}>
        Balanced reduces detail. High keeps it sharp. Auto chooses for this
        device.
      </p>
      <label class={styles.speed}>
        <span>
          Shatter speed{' '}
          <output>{props.shatterPlaybackSpeed.toFixed(2)}×</output>
        </span>
        <input
          type="range"
          aria-label="Shatter speed"
          aria-valuetext={`${props.shatterPlaybackSpeed.toFixed(2)} times normal speed`}
          min={SHATTER_PLAYBACK_SPEED.minimum}
          max={SHATTER_PLAYBACK_SPEED.maximum}
          step="0.05"
          value={props.shatterPlaybackSpeed}
          onInput={(event) =>
            props.onShatterPlaybackSpeedChange(
              event.currentTarget.valueAsNumber,
            )
          }
        />
      </label>
      <p class={styles.caption}>
        Lower is slower. Applies to the next break. Singing, movement and sound
        keep their timing.
      </p>
      <button
        class={styles.reset}
        type="button"
        onClick={() => {
          props.onRenderQualityChange('auto')
          props.onShatterPlaybackSpeedChange(SHATTER_PLAYBACK_SPEED.default)
        }}
      >
        Reset graphics and glass
      </button>
    </fieldset>
  )
}
