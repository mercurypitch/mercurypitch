// Studio take hold — the line under a control that waits for the take: what to do to use it.
import { Show } from 'solid-js'
import common from '../StudioPage.module.css'
import { studioTakeRunning } from './take-running'

/** "A take is recording. Stop it to …", while one is. */
export function StudioTakeHold(props: { to: string }) {
  return (
    <Show when={studioTakeRunning()}>
      <p role="status" class={common.help} data-studio-take-hold="">
        A take is recording. Stop it to {props.to}.
      </p>
    </Show>
  )
}
