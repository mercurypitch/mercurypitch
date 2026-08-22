// Guitar Night Listening cycle keeps coarse input switching close to playback.
// ============================================================
//
// It deliberately owns no device picker: Session remains the one place for
// choosing a particular microphone, interface, or MIDI port. This button only
// advances through the four room-level states.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, createSignal, Match, Switch } from 'solid-js'
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

  const selectNext = (): void => {
    if (blocked()) return

    const next = nextGuitarNightListeningSelection(controlledSelection())
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

  return (
    <button
      type="button"
      class={styles.cycle}
      data-state={selection() ?? 'off'}
      data-status={props.status()}
      data-active={active()}
      data-pending={pending()}
      aria-label={accessibleLabel()}
      aria-busy={pending()}
      disabled={blocked()}
      title={accessibleLabel()}
      onClick={selectNext}
    >
      <span class={styles.icon} aria-hidden="true">
        {routeIcon(selection(), pending())}
      </span>
      <span class={styles.copy} aria-hidden="true">
        <span class={styles.eyebrow}>Listening</span>
        <strong>{selectionLabel(selection())}</strong>
      </span>
    </button>
  )
}
