// Studio view controls — snapping, the ruler's time or beat reference and its tempo, in the ruler's corner cell.
import { For, Show } from 'solid-js'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioProject } from '@/lib/studio/model/types'
import { Magnet } from './studio-icons'
import styles from './timeline/StudioTimeline.module.css'

interface Props {
  project: StudioProject
  writable: boolean
  snap: boolean
  onSnap(value: boolean): void
  onCommand(command: StudioCommand): boolean
}

const RULERS = [
  { id: 'time', label: 'Time' },
  { id: 'bars', label: 'Beats' },
] as const

export function StudioViewControls(props: Props) {
  function setRuler(ruler: 'time' | 'bars'): void {
    if (ruler !== props.project.ruler)
      props.onCommand({ type: 'set-project-settings', changes: { ruler } })
  }

  return (
    <div class={styles.viewControls} data-tour="studio.view-controls">
      <button
        type="button"
        class={styles.snapToggle}
        aria-label="Snap clips"
        aria-pressed={props.snap}
        data-tour="studio.snap"
        title={
          props.snap
            ? 'Snap is on. Hold Alt while dragging to place a clip freely.'
            : 'Snap is off. Clips move freely.'
        }
        onClick={() => props.onSnap(!props.snap)}
      >
        <Magnet size={15} />
        <span class={styles.snapLabel}>Snap</span>
      </button>
      <div
        class={styles.segmented}
        role="radiogroup"
        aria-label="Timeline ruler"
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const group = event.currentTarget
          setRuler(props.project.ruler === 'time' ? 'bars' : 'time')
          queueMicrotask(() =>
            group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus(),
          )
        }}
      >
        <For each={RULERS}>
          {(ruler) => (
            <button
              type="button"
              role="radio"
              aria-checked={props.project.ruler === ruler.id}
              tabIndex={props.project.ruler === ruler.id ? 0 : -1}
              disabled={!props.writable}
              onClick={() => setRuler(ruler.id)}
            >
              {ruler.label}
            </button>
          )}
        </For>
      </div>
      <Show when={props.project.ruler === 'bars'}>
        <label class={styles.tempo} title="Tempo sets the beat grid only">
          <input
            type="number"
            min="30"
            max="300"
            aria-label="Tempo in beats per minute"
            value={props.project.tempoBpm}
            disabled={!props.writable}
            onChange={(event) => {
              const tempo = event.currentTarget.valueAsNumber
              if (
                !Number.isFinite(tempo) ||
                !props.onCommand({
                  type: 'set-project-settings',
                  changes: { tempoBpm: tempo },
                })
              )
                event.currentTarget.value = String(props.project.tempoBpm)
            }}
          />
          <span aria-hidden="true">bpm</span>
        </label>
      </Show>
    </div>
  )
}
