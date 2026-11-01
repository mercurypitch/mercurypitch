// Studio sound panel — saved flavours, centre-zero controls and measured track balance.
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import type { StudioProject } from '@/lib/studio/model/types'
import { LOUDNESS_PRESETS } from '@/lib/studio-fx/master'
import { MACRO_KEYS } from '@/lib/studio-fx/mix-macros'
import { runStudioPanelAction } from '../export/action-focus'
import common from '../StudioPage.module.css'
import { StudioComparisonControls } from './StudioComparisonControls'
import { StudioFlavourChoices, studioSoundAdjusted, } from './StudioFlavourChoices'
import { StudioMacroControl } from './StudioMacroControl'
import { StudioPlaybackQuality } from './StudioPlaybackQuality'
import styles from './StudioSound.module.css'
import type { StudioComparisonController } from './useStudioComparison'
import type { StudioSoundController } from './useStudioSound'

export interface StudioSoundPanelProps {
  /** The recording settings, kept on this device like the playback tier. */
  recording?: JSX.Element
  project: StudioProject
  writable: boolean
  balance: StudioSoundController
  onCommand(command: StudioSoundEdit): boolean
  meter?: JSX.Element
  comparison?: StudioComparisonController
}

export function StudioSoundPanel(props: StudioSoundPanelProps) {
  const enabled = () => props.writable && !props.balance.busy()
  return (
    <div class={styles.panel}>
      <Show when={props.meter}>
        {(meter) => (
          <section class={styles.section} aria-label="Output">
            <h3>Output</h3>
            {meter()}
          </section>
        )}
      </Show>
      <section class={styles.section} aria-label="Flavour">
        <div class={styles.heading}>
          <h3>Flavour</h3>
          <Show when={studioSoundAdjusted(props.project)}>
            <span class={styles.subtle}>Adjusted</span>
          </Show>
        </div>
        <div class={styles.flavours}>
          <StudioFlavourChoices
            project={props.project}
            enabled={enabled()}
            onCommand={props.onCommand}
          />
        </div>
      </section>
      <section class={styles.section} aria-label="Adjust sound">
        <div class={styles.heading}>
          <h3>Adjust</h3>
          <button
            class={common.textButton}
            type="button"
            disabled={!enabled()}
            onClick={() =>
              props.onCommand({
                type: 'set-sound-flavour',
                flavourId: 'natural',
              })
            }
          >
            Reset sound
          </button>
        </div>
        <For each={MACRO_KEYS}>
          {(name) => (
            <StudioMacroControl
              name={name}
              project={props.project}
              writable={enabled()}
              onCommand={props.onCommand}
            />
          )}
        </For>
      </section>
      <fieldset class={styles.section} disabled={!enabled()}>
        <legend>Master</legend>
        <div class={styles.presets}>
          <For each={LOUDNESS_PRESETS}>
            {(preset) => (
              <label class={styles.preset}>
                <input
                  type="radio"
                  name="studio-master-preset"
                  value={preset.id}
                  checked={props.project.master.presetId === preset.id}
                  onChange={() =>
                    props.onCommand({
                      type: 'set-master-preset',
                      presetId: preset.id,
                    })
                  }
                />
                <span>{preset.id === 'gentle' ? 'Quiet' : preset.label}</span>
                <span class={styles.subtle}>
                  {preset.targetLufs} LUFS target
                </span>
              </label>
            )}
          </For>
        </div>
        <p class={common.help}>
          The exported WAV is measured. Its final loudness may differ from the
          target.
        </p>
      </fieldset>
      <Show when={props.comparison}>
        {(comparison) => (
          <StudioComparisonControls
            comparison={comparison()}
            enabled={enabled() && props.project.clips.length > 0}
          />
        )}
      </Show>
      <section
        class={styles.section}
        aria-label="Track balance"
        data-studio-finishing-actions
      >
        <h3>Track balance</h3>
        <p class={common.help}>
          Balance the audible tracks. Your volume and pan settings stay as they
          are.
        </p>
        <Show
          when={props.balance.busy()}
          fallback={
            <button
              type="button"
              data-studio-finishing-action
              class={common.button}
              disabled={!enabled() || props.project.clips.length === 0}
              onClick={(event) => {
                const action = props.balance.autoBalance
                void runStudioPanelAction(event.currentTarget, action)
              }}
            >
              Auto-balance
            </button>
          }
        >
          <p role="status">
            {props.balance.cancelling()
              ? 'Stopping after the current pass…'
              : props.balance.progress()
                ? `Balancing tracks: ${props.balance.progress()?.completed} of ${props.balance.progress()?.total}`
                : 'Preparing tracks…'}
          </p>
          <button
            type="button"
            data-studio-finishing-action
            class={common.button}
            disabled={props.balance.cancelling()}
            onClick={() => props.balance.cancel()}
          >
            Cancel Auto-balance
          </button>
        </Show>
        <Show when={props.balance.error()}>
          {(error) => (
            <p role="alert" class={styles.error}>
              {error()}
            </p>
          )}
        </Show>
        <Show when={props.balance.notice()}>
          {(notice) => (
            <p role="status" class={common.help}>
              {notice()}
            </p>
          )}
        </Show>
      </section>
      {props.recording}
      <StudioPlaybackQuality song={props.project} />
    </div>
  )
}
