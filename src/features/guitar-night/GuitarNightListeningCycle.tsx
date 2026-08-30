// Guitar Night Listening cycle keeps coarse input switching close to playback.
// ============================================================
//
// It deliberately owns no device picker: Session remains the one place for
// choosing a particular microphone, interface, or MIDI port. This button only
// advances through the four room-level states.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, createSignal, For, Match, onCleanup, Show, Switch, untrack, } from 'solid-js'
import { AudioWave, Loader2, Mic, MidiDin, PowerSymbol, } from '@/components/icons'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import { guitarInputProfileLabel } from '@/lib/guitar/guitar-input-profile'
import styles from './GuitarNightListeningCycle.module.css'
import type { GuitarListeningStatus } from './useGuitarListeningController'

export type GuitarNightListeningSelection = GuitarInputProfileKind | null

export interface GuitarNightListeningCycleProps {
  status: Accessor<GuitarListeningStatus>
  profile: Accessor<GuitarInputProfileKind>
  disabled?: Accessor<boolean>
  onSelect(next: GuitarNightListeningSelection): Promise<void> | void
}

const PROFILE_ORDER: readonly GuitarInputProfileKind[] = [
  'microphone',
  'interface',
  'midi',
]

/** How long a touch must be held before it means "let me choose". */
const LONG_PRESS_MS = 450
/** Finger travel that makes a press a scroll instead. */
const LONG_PRESS_SLOP_PX = 10

/** The route that is genuinely open, or null while Listening is off. */
export function guitarNightListeningSelection(
  status: GuitarListeningStatus,
  profile: GuitarInputProfileKind,
): GuitarNightListeningSelection {
  return status === 'listening' ||
    status === 'requesting' ||
    status === 'calibrating'
    ? profile
    : null
}

/** The next stop in Off -> Room mic -> Direct input -> MIDI -> Off. */
export function nextGuitarNightListeningSelection(
  current: GuitarNightListeningSelection,
): GuitarNightListeningSelection {
  if (current === null) return PROFILE_ORDER[0]
  const index = PROFILE_ORDER.indexOf(current)
  return index < PROFILE_ORDER.length - 1 ? PROFILE_ORDER[index + 1] : null
}

function selectionLabel(selection: GuitarNightListeningSelection): string {
  return selection === null ? 'Off' : guitarInputProfileLabel(selection)
}

function nextActionLabel(selection: GuitarNightListeningSelection): string {
  const next = nextGuitarNightListeningSelection(selection)
  return next === null
    ? 'Turn Listening off'
    : `Switch to ${guitarInputProfileLabel(next)}`
}

function routeIcon(
  selection: GuitarNightListeningSelection,
  pending: boolean,
): JSX.Element {
  if (pending) return <Loader2 />

  return (
    <Switch fallback={<PowerSymbol size={16} />}>
      <Match when={selection === 'microphone'}>
        <Mic />
      </Match>
      <Match when={selection === 'interface'}>
        <AudioWave />
      </Match>
      <Match when={selection === 'midi'}>
        <MidiDin />
      </Match>
    </Switch>
  )
}

function profileIcon(profile: GuitarInputProfileKind): JSX.Element {
  return (
    <Switch fallback={<AudioWave />}>
      <Match when={profile === 'microphone'}>
        <Mic />
      </Match>
      <Match when={profile === 'midi'}>
        <MidiDin />
      </Match>
    </Switch>
  )
}

export function GuitarNightListeningCycle(
  props: GuitarNightListeningCycleProps,
) {
  // `undefined` means no local request. `null` is a real pending destination:
  // the final click in the cycle is actively turning Listening off.
  const [pendingSelection, setPendingSelection] = createSignal<
    GuitarNightListeningSelection | undefined
  >(undefined)

  const controlledSelection = createMemo(() =>
    guitarNightListeningSelection(props.status(), props.profile()),
  )
  const externallyPending = createMemo(
    () => props.status() === 'requesting' || props.status() === 'calibrating',
  )
  const pending = createMemo(
    () => pendingSelection() !== undefined || externallyPending(),
  )
  const selection = createMemo(() => {
    const localTarget = pendingSelection()
    return localTarget !== undefined ? localTarget : controlledSelection()
  })
  const active = createMemo(
    () => props.status() === 'listening' && pendingSelection() === undefined,
  )
  const blocked = createMemo(() => pending() || (props.disabled?.() ?? false))

  const accessibleLabel = createMemo(() => {
    const localTarget = pendingSelection()
    if (localTarget !== undefined) {
      return localTarget === null
        ? 'Turning Listening off'
        : `Switching Listening to ${guitarInputProfileLabel(localTarget)}`
    }

    if (props.status() === 'requesting') {
      return `Opening ${guitarInputProfileLabel(props.profile())} for Listening`
    }
    if (props.status() === 'calibrating') {
      return `Calibrating ${guitarInputProfileLabel(props.profile())}; Listening controls are unavailable`
    }

    const state =
      controlledSelection() === null
        ? 'Listening is off'
        : `Listening with ${selectionLabel(controlledSelection())}`
    if (props.disabled?.() === true) {
      return `${state}. Input changes are unavailable`
    }
    if (props.status() === 'error') {
      return `${state} after an input error. Switch to Room mic`
    }
    return `${state}. ${nextActionLabel(controlledSelection())}`
  })
  // Cycling is the fast path for "start listening", but it can only reach
  // Direct input by passing through Room mic -- which asks the browser for
  // microphone consent a player plugged into an interface never wanted to
  // give. The picker is the way past that, on the secondary gesture so the
  // one-tap toggle keeps its meaning.
  const [pickerOpen, setPickerOpen] = createSignal(false)
  // How far the fan has to slide to stay on screen. The control sits at the
  // left end of the bottom rail, so a menu centred on it hangs its first chip
  // off the edge of a narrow window.
  const [pickerShift, setPickerShift] = createSignal(0)
  let button: HTMLButtonElement | undefined
  let pickerRoot: HTMLDivElement | undefined
  let longPressTimer = 0
  let longPressOrigin: { x: number; y: number } | null = null
  // A long press must not also fire the click that ends it.
  let suppressNextClick = false

  const cancelLongPress = (): void => {
    if (longPressTimer !== 0) clearTimeout(longPressTimer)
    longPressTimer = 0
    longPressOrigin = null
  }
  onCleanup(cancelLongPress)

  /** Slide the fan back inside the window, measured after it has laid out. */
  const keepPickerOnScreen = (element: HTMLDivElement): void => {
    setPickerShift(0)
    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0) return
      const margin = 8
      const overflowLeft = margin - rect.left
      const overflowRight = rect.right - (window.innerWidth - margin)
      if (overflowLeft > 0) setPickerShift(overflowLeft)
      else if (overflowRight > 0) setPickerShift(-overflowRight)
    })
  }

  const openPicker = (): void => {
    // Read once, deliberately untracked: a long press resolves inside a timer,
    // where a tracked read would belong to no owner anyway.
    if (untrack(blocked)) return
    setPickerOpen(true)
  }
  const closePicker = (focusButton: boolean): void => {
    if (!pickerOpen()) return
    setPickerOpen(false)
    if (focusButton) button?.focus()
  }

  const handlePointerDown = (
    event: PointerEvent & { currentTarget: HTMLButtonElement },
  ): void => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    longPressOrigin = { x: event.clientX, y: event.clientY }
    longPressTimer = window.setTimeout(() => {
      longPressTimer = 0
      suppressNextClick = true
      openPicker()
    }, LONG_PRESS_MS)
  }
  const handlePointerMove = (event: PointerEvent): void => {
    const origin = longPressOrigin
    if (origin === null) return
    if (
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >
      LONG_PRESS_SLOP_PX
    ) {
      cancelLongPress()
    }
  }

  // Choosing the route already open turns Listening off, so three chips still
  // reach all four states without a fourth that only ever says "stop".
  const chooseProfile = (profile: GuitarInputProfileKind): void => {
    closePicker(true)
    applySelection(controlledSelection() === profile ? null : profile)
  }
  const chipLabel = (profile: GuitarInputProfileKind): string =>
    controlledSelection() === profile
      ? `Turn Listening off (${guitarInputProfileLabel(profile)} is on)`
      : `Listen with ${guitarInputProfileLabel(profile)}`

  const moveChipFocus = (from: number, delta: number): void => {
    const chips = pickerRoot?.querySelectorAll('[data-chip]')
    if (chips === undefined || chips.length === 0) return
    const next = (from + delta + chips.length) % chips.length
    ;(chips[next] as HTMLElement | undefined)?.focus()
  }

  const applySelection = (next: GuitarNightListeningSelection): void => {
    if (blocked()) return
    setPendingSelection(next)

    let result: Promise<void> | void
    try {
      result = props.onSelect(next)
    } catch (error) {
      setPendingSelection(undefined)
      throw error
    }

    if (result === undefined) {
      setPendingSelection(undefined)
      return
    }

    // The owner reports any capture failure through `status`; this local
    // state only keeps a second route change from racing the first one.
    void result.then(
      () => setPendingSelection(undefined),
      () => setPendingSelection(undefined),
    )
  }

  const selectNext = (): void => {
    applySelection(nextGuitarNightListeningSelection(controlledSelection()))
  }

  return (
    <div class={styles.dock}>
      <button
        type="button"
        ref={button}
        class={styles.cycle}
        data-state={selection() ?? 'off'}
        data-status={props.status()}
        data-active={active()}
        data-pending={pending()}
        data-testid="guitar-night-listening-cycle"
        aria-label={accessibleLabel()}
        aria-busy={pending()}
        aria-disabled={blocked()}
        aria-haspopup="menu"
        aria-expanded={pickerOpen()}
        title={`${accessibleLabel()}. Hold or right-click to pick a route.`}
        onClick={() => {
          if (suppressNextClick) {
            suppressNextClick = false
            return
          }
          selectNext()
        }}
        // Right-click on a pointer device, and the keyboard's own context
        // key, both arrive here -- so the picker is reachable without a mouse.
        onContextMenu={(event) => {
          event.preventDefault()
          openPicker()
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
      >
        <span class={styles.icon} aria-hidden="true">
          {routeIcon(selection(), pending())}
        </span>
        <span class={styles.copy} aria-hidden="true">
          <span class={styles.eyebrow}>Listening</span>
          <strong>{selectionLabel(selection())}</strong>
        </span>
      </button>
      <Show when={pickerOpen()}>
        <div
          class={styles.pickerBackdrop}
          data-testid="guitar-night-listening-picker-backdrop"
          aria-hidden="true"
          onPointerDown={() => {
            closePicker(false)
          }}
        />
        <div
          class={styles.picker}
          ref={(element) => {
            pickerRoot = element
            keepPickerOnScreen(element)
          }}
          style={{ '--picker-shift': `${pickerShift()}px` }}
          role="menu"
          data-testid="guitar-night-listening-picker"
          aria-label="Listening route"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              closePicker(true)
              return
            }
            const chips = [
              ...(pickerRoot?.querySelectorAll('[data-chip]') ?? []),
            ]
            const index = chips.indexOf(event.target as Element)
            if (index < 0) return
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
              event.preventDefault()
              moveChipFocus(index, 1)
            }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              event.preventDefault()
              moveChipFocus(index, -1)
            }
          }}
        >
          <For each={PROFILE_ORDER}>
            {(profile, index) => (
              <button
                type="button"
                data-chip={profile}
                class={styles.pickerChip}
                data-current={controlledSelection() === profile}
                // The fan: outer chips sit lower and lean away from the middle.
                style={{ '--chip-slot': String(index() - 1) }}
                role="menuitemradio"
                aria-checked={controlledSelection() === profile}
                aria-label={chipLabel(profile)}
                title={chipLabel(profile)}
                ref={(element) => {
                  if (controlledSelection() === profile || index() === 0) {
                    queueMicrotask(() => element.focus())
                  }
                }}
                onClick={() => {
                  chooseProfile(profile)
                }}
              >
                <span class={styles.pickerIcon} aria-hidden="true">
                  {profileIcon(profile)}
                </span>
                <span class={styles.pickerName} aria-hidden="true">
                  {guitarInputProfileLabel(profile)}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
      <span
        class={styles.visuallyHidden}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {accessibleLabel()}
      </span>
    </div>
  )
}
