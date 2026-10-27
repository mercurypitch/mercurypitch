// ============================================================
// Studio panels — one at a time, each top-bar button closing its own
// ============================================================
//
// A top-bar button opens its panel, and a second press closes it. Closing
// returns focus to the control that opened the panel. Add takes opened from
// Mix goes back to Mix once the take is in, so mixing is not interrupted by
// each new take; added with Mix open, the take lands and Mix stays.
import { createSignal } from 'solid-js'

export type StudioPanelName =
  | 'sources'
  | 'song'
  | 'clip'
  | 'track'
  | 'mix'
  | 'sound'
  | 'export'

export interface StudioPanelsOptions {
  /** Before every change, with the panel about to open, or null when closing. */
  beforeChange?(next: StudioPanelName | null): void
  /** After a panel opens. */
  onOpen?(panel: StudioPanelName): void
}

export function createStudioPanels(options: StudioPanelsOptions = {}) {
  const [panel, setPanel] = createSignal<StudioPanelName | null>(null)
  let opener: HTMLElement | null = null
  let backToMix = false

  function open(next: StudioPanelName): void {
    options.beforeChange?.(next)
    if (next !== panel()) backToMix = next === 'sources' && panel() === 'mix'
    const active = document.activeElement
    if (active instanceof HTMLElement && !active.closest('[data-studio-panel]'))
      opener = active
    setPanel(next)
    options.onOpen?.(next)
  }

  function close(): void {
    options.beforeChange?.(null)
    backToMix = false
    setPanel(null)
    queueMicrotask(() => {
      if (opener?.isConnected === true) opener.focus()
    })
  }

  /** A top-bar button: open its panel, or close it when it is the one open. */
  function toggle(next: StudioPanelName): void {
    if (panel() === next) close()
    else open(next)
  }

  /** Audio was added: back to Mix if Add takes came from there; Mix itself stays. */
  function afterAdd(): void {
    if (panel() === 'mix') return
    if (panel() === 'sources' && backToMix) open('mix')
    else close()
  }

  return { panel, open, close, toggle, afterAdd }
}
