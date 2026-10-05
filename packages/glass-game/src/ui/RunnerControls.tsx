// ============================================================
// Song runner controls — three native buttons preserve independent contacts.
// ============================================================

import { For, Show } from 'solid-js'
import type { RunnerContinuousInput } from './runner-continuous-input'
import type { RunnerControlAction, RunnerInputEdges } from './runner-input'
import { RunnerSteeringControls } from './RunnerSteeringControls'
import styles from './SongRunnerView.module.css'

interface RunnerControlsProps {
  input: RunnerInputEdges
  disabled: boolean
  steering?: RunnerContinuousInput
}

const CONTROLS: readonly {
  action: RunnerControlAction
  label: string
  keyshortcuts: string
}[] = [
  { action: 'lane-left', label: 'Left lane', keyshortcuts: 'ArrowLeft A' },
  { action: 'jump', label: 'Jump', keyshortcuts: 'Space ArrowUp W' },
  { action: 'lane-right', label: 'Right lane', keyshortcuts: 'ArrowRight D' },
]

function releasePointer(
  props: RunnerControlsProps,
  action: RunnerControlAction,
  event: PointerEvent & { currentTarget: HTMLButtonElement },
): void {
  props.input.pointerEnd(action, event.pointerId)
}

export function RunnerControls(props: RunnerControlsProps) {
  return (
    <Show
      when={props.steering}
      fallback={
        <nav class={styles.controls} aria-label="Course controls">
          <For each={CONTROLS}>
            {(control) => (
              <button
                type="button"
                class={styles.controlButton}
                classList={{ [styles.jumpControl]: control.action === 'jump' }}
                disabled={props.disabled}
                aria-label={control.label}
                aria-keyshortcuts={control.keyshortcuts}
                data-action={control.action}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={(event) => {
                  if (!props.input.pointerDown(control.action, event.pointerId))
                    return
                  if (event.pointerType !== 'mouse') event.preventDefault()
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerUp={(event) =>
                  releasePointer(props, control.action, event)
                }
                onPointerCancel={(event) =>
                  releasePointer(props, control.action, event)
                }
                onLostPointerCapture={(event) =>
                  releasePointer(props, control.action, event)
                }
                onClick={(event) => {
                  if (event.detail === 0) props.input.activate(control.action)
                }}
              >
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  {control.action === 'lane-left' ? (
                    <path d="M25 16H7m8-8-8 8 8 8" />
                  ) : control.action === 'lane-right' ? (
                    <path d="M7 16h18m-8-8 8 8-8 8" />
                  ) : (
                    <path d="M16 25V7m-7 8 7-8 7 8M7 27h18" />
                  )}
                </svg>
                <span>
                  {control.action === 'jump' ? 'Jump' : control.label}
                </span>
              </button>
            )}
          </For>
        </nav>
      }
    >
      {(steering) => (
        <RunnerSteeringControls input={steering()} disabled={props.disabled} />
      )}
    </Show>
  )
}
