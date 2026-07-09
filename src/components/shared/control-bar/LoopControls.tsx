// ============================================================
// LoopControls — the Set-A / Set-B / toggle / clear button cluster, shared by
// the Singing, Piano and Compose control bars (which each carried an identical
// copy). Renders into the surrounding control bar; styling comes from the
// shared control-bar.module.css.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import styles from './control-bar.module.css'
import { IconClear, IconLoopPoint, IconRepeat } from './icons'

interface LoopControlsProps {
  loopEnabled: () => boolean
  loopA: () => number
  loopB: () => number
  onSetLoopA: () => void
  onSetLoopB: () => void
  onToggleLoop: () => void
  onClearLoop: () => void
  /** Singing emphasises the B button with an extra accent class. */
  emphasizeB?: boolean
}

export const LoopControls: Component<LoopControlsProps> = (props) => {
  return (
    <>
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.active]: props.loopA() > 0 }}
        data-testid="loop-a-btn"
        title="Set loop start (A)"
        aria-label="Set loop start (A)"
        onClick={() => props.onSetLoopA()}
      >
        <IconLoopPoint label="A" set={props.loopA() > 0} />
      </button>
      <button
        type="button"
        class={styles.btn}
        classList={{
          [styles.active]: props.loopB() > 0,
          [styles.loopBtnB]: (props.emphasizeB ?? false) && props.loopB() > 0,
        }}
        data-testid="loop-b-btn"
        title="Set loop end (B)"
        aria-label="Set loop end (B)"
        onClick={() => props.onSetLoopB()}
      >
        <IconLoopPoint label="B" set={props.loopB() > 0} />
      </button>
      <Show when={props.loopA() > 0 && props.loopB() > 0}>
        <button
          type="button"
          class={styles.btn}
          classList={{ [styles.active]: props.loopEnabled() }}
          data-testid="loop-toggle-btn"
          title={props.loopEnabled() ? 'Disable loop' : 'Enable loop'}
          aria-label={props.loopEnabled() ? 'Disable loop' : 'Enable loop'}
          onClick={() => props.onToggleLoop()}
        >
          <IconRepeat />
        </button>
        <button
          type="button"
          class={styles.btn}
          data-testid="loop-clear-btn"
          title="Clear loop points"
          aria-label="Clear loop points"
          onClick={() => props.onClearLoop()}
        >
          <IconClear />
        </button>
      </Show>
    </>
  )
}
