// Studio view controls — ruler, beat reference and timeline zoom.
import { Show } from 'solid-js'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioProject } from '@/lib/studio/model/types'
import styles from './StudioPage.module.css'

interface Props {
  project: StudioProject
  writable: boolean
  zoom: number
  onZoom(value: number): void
  onCommand(command: StudioCommand): boolean
}
export function StudioViewControls(props: Props) {
  return (
    <div class={styles.viewControls} data-tour="studio.view-controls">
      <label>
        Ruler
        <select
          aria-label="Timeline ruler"
          value={props.project.ruler}
          disabled={!props.writable}
          onChange={(event) =>
            props.onCommand({
              type: 'set-project-settings',
              changes: {
                ruler: event.currentTarget.value as 'time' | 'bars',
              },
            })
          }
        >
          <option value="time">Seconds</option>
          <option value="bars">Beats</option>
        </select>
      </label>
      <Show when={props.project.ruler === 'bars'}>
        <label>
          Tempo
          <input
            type="number"
            min="30"
            max="300"
            value={props.project.tempoBpm}
            disabled={!props.writable}
            onChange={(event) =>
              props.onCommand({
                type: 'set-project-settings',
                changes: {
                  tempoBpm: event.currentTarget.valueAsNumber,
                },
              })
            }
          />
          <span>bpm</span>
        </label>
      </Show>
      <label class={styles.zoom}>
        Zoom
        <input
          type="range"
          min="10"
          max="200"
          step="5"
          value={props.zoom}
          aria-label="Timeline zoom"
          onInput={(event) => props.onZoom(event.currentTarget.valueAsNumber)}
        />
      </label>
    </div>
  )
}
