// The top-right corner of every 3D stage: the chip, and the dials.
// ============================================================
//
// Top RIGHT, because the Leave pill is fixed to the top left on z-index
// 50 and anything put there is simply not on screen. The two are stacked
// in one column rather than each pinned to its own offset: the chip grows
// a line as each load phase lands, and a button pinned below where the
// chip used to end sits on top of the text that grew under it.

import { For, Show } from 'solid-js'

interface StageCornerProps {
  /** Whether this build shows the chip (runtime/perf.ts). */
  chipOn: boolean
  lines: readonly string[]
  /** Opens the dev dials. Absent in a production build. */
  onDials?: () => void
}

export const StageCorner = (props: StageCornerProps) => (
  <div class="stage3d__corner">
    <Show when={props.chipOn}>
      <span class="stage3d__chip">
        <For each={props.lines}>
          {(line) => <span class="stage3d__chip-line">{line}</span>}
        </For>
      </span>
    </Show>
    <Show when={props.onDials !== undefined}>
      <button
        type="button"
        class="dev-dials__open"
        onClick={() => props.onDials?.()}
      >
        dials
      </button>
    </Show>
  </div>
)
