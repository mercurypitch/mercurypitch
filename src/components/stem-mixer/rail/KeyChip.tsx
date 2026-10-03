// KeyChip shows the singer's key ("Key", "Key +2") and opens its stepper.
// ============================================================
//
// Modelled on the Jam room key (JamRoomKey): one chip in the row, because
// the row belongs to the timeline, and the full stepper took 110 px of it.
// The chip opens a panel with the key's name on its own line (flats where
// the key is written with flats, see key-shift.ts), minus, the value, plus,
// Back to original key, and Find my key.
//
// The panel stays open while the singer steps, so they can hear each key
// and keep going. Past ±4 it says so in words under the stepper, and while
// the key cannot change (Pitch Studio, or no engine on this device) it says
// why in the same place. Neither is a tooltip: a tooltip never appears on a
// touch screen, and a disabled button never shows one at all.
//
// It closes by the app's one rule for floating panels (use-popover-layer),
// and Escape hands focus back to the chip. Tab past either end of the panel
// does the same, since the panel is portalled away from the chip.

import type { Component } from 'solid-js'
import { createEffect, createSignal, createUniqueId, onCleanup, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { AlertTriangle, ChevronDown, Crosshair, Minus, Plus, } from '@/components/icons'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import { KEY_SHIFT_STRETCH_NOTE } from '@/components/key-shift/KeyShiftControl'
import { clampKeyShift, formatKeyShift, isCleanKeyShift, KEY_SHIFT_MAX, KEY_SHIFT_MIN, } from '@/lib/key-shift/key-shift'
import { placePopover, usePopoverLayer } from '@/lib/use-popover-layer'
import styles from './KeyChip.module.css'

/** Under the stepper while the key is within the range that stays clean. */
export const KEY_CLEAN_NOTE = 'Within ±4 semitones the backing stays clean'

export interface KeyChipProps {
  binding: KeyShiftBinding
}

type Tone = 'clean' | 'stretch' | 'unavailable'

export const KeyChip: Component<KeyChipProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const [pos, setPos] = createSignal({ x: 0, y: 0 })
  const panelId = createUniqueId()
  let chip: HTMLButtonElement | undefined
  let panel: HTMLDivElement | undefined

  const value = (): number => props.binding.value()
  const reason = (): string | undefined => props.binding.disabledReason()
  const unavailable = (): boolean => reason() !== undefined
  const face = (): string =>
    value() === 0 ? 'Key' : `Key ${formatKeyShift(value())}`
  // Only worth offering while the song is somewhere else.
  const offer = (): number | null => {
    const suggestion = props.binding.suggestion()
    return suggestion != null && suggestion.keyShift !== value()
      ? suggestion.keyShift
      : null
  }
  const tone = (): Tone => {
    if (unavailable()) return 'unavailable'
    return isCleanKeyShift(value()) ? 'clean' : 'stretch'
  }
  const note = (): string => {
    const why = reason()
    if (why !== undefined) return why
    return tone() === 'stretch' ? KEY_SHIFT_STRETCH_NOTE : KEY_CLEAN_NOTE
  }

  const change = (next: number): void => {
    if (!unavailable() && next !== value()) props.binding.onChange(next)
  }

  const close = (restoreFocus: boolean): void => {
    setOpen(false)
    if (restoreFocus) chip?.focus()
  }

  usePopoverLayer({
    open,
    onClose: (why) => close(why === 'escape'),
    inside: () => [chip, panel],
    anchor: () => chip,
  })

  const place = (): void => {
    if (chip === undefined || panel === undefined) return
    const { x, y } = placePopover(
      chip.getBoundingClientRect(),
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
      { align: 'center' },
    )
    setPos({ x, y })
  }

  const buttons = (): HTMLButtonElement[] =>
    Array.from(
      panel?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ??
        [],
    )

  createEffect(() => {
    if (!open()) return
    place()
    buttons()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return
      if (panel?.contains(document.activeElement) !== true) return
      const list = buttons()
      const edge = event.shiftKey ? list[0] : list[list.length - 1]
      if (document.activeElement !== edge) return
      event.preventDefault()
      close(true)
    }
    document.addEventListener('keydown', onKeyDown)

    // The key's name arrives once the song is analysed, and can arrive
    // while the panel is open; keep it hung from the chip when it grows.
    const observer =
      typeof ResizeObserver === 'undefined' || panel === undefined
        ? undefined
        : new ResizeObserver(place)
    if (panel !== undefined) observer?.observe(panel)

    onCleanup(() => {
      document.removeEventListener('keydown', onKeyDown)
      observer?.disconnect()
    })
  })

  // The rail can unmount with the panel open (leaving the mixer).
  onCleanup(() => setOpen(false))

  return (
    <>
      <button
        ref={chip}
        type="button"
        class={styles.chip}
        classList={{ [styles.chipMoved!]: props.binding.heard() !== 0 }}
        data-testid="key-chip"
        aria-haspopup="dialog"
        aria-expanded={open()}
        aria-controls={open() ? panelId : undefined}
        onClick={() => (open() ? close(false) : setOpen(true))}
      >
        <span class={styles.face}>{face()}</span>
        <ChevronDown size={14} />
      </button>

      <Show when={open()}>
        <Portal>
          <div
            ref={panel}
            id={panelId}
            class={`${styles.panel} mp-dark-stage`}
            role="dialog"
            aria-label="Key"
            data-testid="key-chip-popover"
            data-tone={tone()}
            style={{ left: `${pos().x}px`, top: `${pos().y}px` }}
          >
            <div class={styles.head}>
              <span class={styles.caption}>Key</span>
              <Show when={props.binding.keyLabel()}>
                {(name) => (
                  <span class={styles.keyName} data-testid="key-chip-name">
                    {name()}
                  </span>
                )}
              </Show>
            </div>

            <div class={styles.stepper}>
              <button
                type="button"
                class={styles.step}
                aria-label="Lower the key"
                disabled={unavailable() || value() <= KEY_SHIFT_MIN}
                onClick={() => change(clampKeyShift(value() - 1))}
              >
                <Minus size={16} />
              </button>
              <output
                class={styles.value}
                aria-live="polite"
                data-testid="key-chip-value"
              >
                {formatKeyShift(value())}
              </output>
              <button
                type="button"
                class={styles.step}
                aria-label="Raise the key"
                disabled={unavailable() || value() >= KEY_SHIFT_MAX}
                onClick={() => change(clampKeyShift(value() + 1))}
              >
                <Plus size={16} />
              </button>
            </div>

            <button
              type="button"
              class={styles.action}
              disabled={unavailable() || value() === 0}
              onClick={() => change(0)}
            >
              Back to original key
            </button>
            <button
              type="button"
              class={styles.action}
              aria-label={
                offer() === null
                  ? 'Find my key'
                  : `Find my key: try ${formatKeyShift(offer() ?? 0)}`
              }
              disabled={unavailable()}
              onClick={() => {
                if (!unavailable()) props.binding.onFindKey()
              }}
            >
              <Crosshair />
              <span>
                {offer() === null
                  ? 'Find my key'
                  : `Try ${formatKeyShift(offer() ?? 0)}`}
              </span>
            </button>

            <p
              class={styles.note}
              aria-live="polite"
              data-testid="key-chip-note"
            >
              <Show when={tone() !== 'clean'}>
                <AlertTriangle />
              </Show>
              <span>{note()}</span>
            </p>
          </div>
        </Portal>
      </Show>
    </>
  )
}
