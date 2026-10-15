// StagePanel is the mixer header's Stage popover: the backdrop and, in the
// studio, how much of it shows through the panels.
// ============================================================
//
// Both are set-once looks, so they share one popover off the header instead
// of a slider in the row (the transparency slider had a place of its own,
// 120 px wide, used about once). The gallery is the backdrop picker's own,
// embedded: the same cards, locks and supporter editions as everywhere else.
//
// The header opens it from its Stage button, or from the View menu when the
// header is folded and there is no Stage button: `anchor` is whichever the
// panel should hang from. It closes by the app's one rule for floating
// panels (use-popover-layer), Escape handing focus back to the anchor.

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import type { BackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { placePopover, usePopoverLayer } from '@/lib/use-popover-layer'
import styles from './StagePanel.module.css'

export interface StageTransparency {
  value: number
  min: number
  max: number
  step: number
  /** Where the thumb sits along its travel, 0 to 100, for the track's fill. */
  fillPercent: number
  onInput: (value: number) => void
}

export interface StagePanelProps {
  open: boolean
  /** What the panel hangs from: the Stage button, or the View menu. */
  anchor: () => HTMLElement | undefined
  /** Escape asks for focus back on the anchor; a press outside does not. */
  onClose: (restoreFocus: boolean) => void
  background: BackgroundSurfaceController
  /** The panels' transparency; the performance stage has none. */
  transparency?: StageTransparency
}

export const StagePanel: Component<StagePanelProps> = (props) => {
  const [pos, setPos] = createSignal({ x: 0, y: 0 })
  let panel: HTMLDivElement | undefined

  usePopoverLayer({
    open: () => props.open,
    onClose: (why) => props.onClose(why === 'escape'),
    inside: () => [props.anchor(), panel],
    anchor: () => props.anchor(),
  })

  const place = (): void => {
    const anchor = props.anchor()
    if (anchor === undefined || panel === undefined) return
    setPos(
      placePopover(
        anchor.getBoundingClientRect(),
        { width: panel.offsetWidth, height: panel.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        { align: 'start' },
      ),
    )
  }

  createEffect(() => {
    if (!props.open) return
    place()
    // The gallery's artwork arrives after the panel opens; keep it hung
    // from its anchor as it grows.
    const observer =
      typeof ResizeObserver === 'undefined' || panel === undefined
        ? undefined
        : new ResizeObserver(place)
    if (panel !== undefined) observer?.observe(panel)
    onCleanup(() => observer?.disconnect())
  })

  return (
    <Show when={props.open}>
      <Portal>
        <div
          ref={panel}
          class={`${styles.panel} mp-dark-stage`}
          role="dialog"
          aria-label="Stage"
          data-testid="stage-panel"
          style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
        >
          <p class={styles.caption}>Backdrop</p>
          <PremiumBackgroundPicker controller={props.background} embedded />
          <Show when={props.transparency}>
            {(glass) => (
              <label class={styles.glass}>
                <span>Transparency</span>
                <input
                  type="range"
                  class={styles.slider}
                  min={glass().min}
                  max={glass().max}
                  step={glass().step}
                  value={glass().value}
                  // A custom track cannot read the input's own value, so the
                  // filled share travels as a percentage, as on the faders.
                  style={{ '--stage-glass-fill': `${glass().fillPercent}%` }}
                  aria-label="Stage transparency"
                  onInput={(event) =>
                    glass().onInput(Number(event.currentTarget.value))
                  }
                />
              </label>
            )}
          </Show>
        </div>
      </Portal>
    </Show>
  )
}
