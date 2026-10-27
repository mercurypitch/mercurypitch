// ============================================================
// Studio key burst — a run of arrow-key presses on one control saves once
// ============================================================
//
// Six presses of the Up arrow on a fader are one change to the person making
// them, so they are one undo step. A burst starts with a range key, and saves
// half a second after the last one, when focus leaves the control, or as soon
// as another key goes down, so Ctrl+Z right after a burst undoes all of it.
// Escape drops it without saving.
import { onCleanup } from 'solid-js'

/** The keys a native range input moves its value with. */
export const STUDIO_RANGE_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

/** Quiet time after the last key before a burst saves. */
export const STUDIO_KEY_BURST_IDLE_MS = 500

export interface StudioKeyBurst {
  /** True from the first range key until the burst saves or is dropped. */
  active(): boolean
  /** A key went down on the control: a range key starts or extends the burst, any other key saves it first. */
  keyDown(event: KeyboardEvent): void
  /** The value moved: wait for the keys to go quiet again. */
  moved(): void
  /** Save now, if a burst is running. */
  flush(): void
  /** Drop the burst without saving. */
  cancel(): void
}

export function createStudioKeyBurst(save: () => void): StudioKeyBurst {
  let active = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    clearTimeout(timer)
    timer = undefined
  }
  const flush = () => {
    stop()
    if (!active) return
    active = false
    save()
  }
  const arm = () => {
    stop()
    timer = setTimeout(flush, STUDIO_KEY_BURST_IDLE_MS)
  }
  // A control that goes away mid-burst keeps what was heard.
  onCleanup(flush)
  return {
    active: () => active,
    keyDown(event) {
      if (event.key === 'Escape') return
      if (!STUDIO_RANGE_KEYS.has(event.key)) {
        flush()
        return
      }
      active = true
      arm()
    },
    moved() {
      if (active) arm()
    },
    flush,
    cancel() {
      stop()
      active = false
    },
  }
}
