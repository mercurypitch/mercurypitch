// Free-form modes coordinate intent without owning input, audio, notes or storage.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js'

export type GuitarFreeFormMode = 'live' | 'replay' | 'practice'

interface GuitarFreeFormModeOptions {
  sourceId: Accessor<string | null>
  captureBusy: Accessor<boolean>
  blocked: Accessor<boolean>
  pauseReplay(): void
  settlePractice(): Promise<void>
  cancelPracticeStart(): void
  preparePractice(): Promise<boolean>
  startRecording(): Promise<void>
  onMissingSource(): void
}

export function useGuitarFreeFormModes(options: GuitarFreeFormModeOptions) {
  const [mode, setMode] = createSignal<GuitarFreeFormMode>('live')
  const [pending, setPending] = createSignal<
    GuitarFreeFormMode | 'record' | null
  >(null)
  const [error, setError] = createSignal<string | null>(null)
  let generation = 0
  let disposed = false
  let selectedId: string | null = null

  const cancel = (): void => {
    generation++
    setPending(null)
    options.cancelPracticeStart()
  }
  createEffect(() => {
    const id = options.sourceId()
    if (id === selectedId) return
    selectedId = id
    untrack(() => {
      cancel()
      setMode(id === null ? 'live' : 'replay')
      setError(null)
    })
  })
  onCleanup(() => {
    disposed = true
    generation++
  })

  const park = async (): Promise<void> => {
    options.pauseReplay()
    await options.settlePractice()
  }
  const select = async (
    next: GuitarFreeFormMode,
    intent: { refresh?: boolean } = {},
  ): Promise<boolean> => {
    if (disposed || options.captureBusy() || options.blocked()) return false
    if (pending() === next) return false
    if (next !== 'live' && options.sourceId() === null) {
      options.onMissingSource()
      return false
    }
    if (next === mode() && pending() === null && intent.refresh !== true)
      return true
    const operation = ++generation
    const sourceId = options.sourceId()
    setPending(next)
    setError(null)
    options.cancelPracticeStart()
    const current = () =>
      !disposed &&
      operation === generation &&
      sourceId === options.sourceId() &&
      !options.captureBusy() &&
      !options.blocked()
    try {
      await park()
      if (!current()) return false
      if (next === 'practice' && !(await options.preparePractice()))
        return false
      if (!current()) return false
      setMode(next)
      return true
    } catch (cause) {
      if (current())
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not change mode. Your melody is still available.',
        )
      return false
    } finally {
      if (!disposed && operation === generation) setPending(null)
    }
  }
  const record = async (): Promise<void> => {
    if (
      disposed ||
      options.captureBusy() ||
      options.blocked() ||
      pending() === 'record'
    )
      return
    const operation = ++generation
    setPending('record')
    setError(null)
    options.cancelPracticeStart()
    try {
      await park()
      if (
        disposed ||
        operation !== generation ||
        options.captureBusy() ||
        options.blocked()
      )
        return
      setMode('live')
      // The recorder owns preparation/cancellation from this point onward.
      setPending(null)
      await options.startRecording()
    } catch (cause) {
      if (!disposed && operation === generation)
        setError(
          cause instanceof Error ? cause.message : 'Could not start recording.',
        )
    } finally {
      if (!disposed && operation === generation) setPending(null)
    }
  }
  return { mode, pending, error, select, record, cancel, park }
}
