// ============================================================
// Performance Take Keep — explicit temporary-to-durable save boundary
// ============================================================
//
// Night stages prepare replay audio in memory. This controller owns only the
// final explicit Keep transaction so capture/render lifecycles can stay with
// the feature that understands them.

import { createSignal, onCleanup } from 'solid-js'
import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'

export type PerformanceTakeKeepState =
  | 'idle'
  | 'capturing'
  | 'processing'
  | 'ready'
  | 'saving'
  | 'saved'
  | 'unsupported'
  | 'error'

export type PerformanceTakeSave = () => Promise<SaveVoiceTakeResult>

export function usePerformanceTakeKeep() {
  const [state, setState] = createSignal<PerformanceTakeKeepState>('idle')
  const [message, setMessage] = createSignal('')
  let saveCandidate: PerformanceTakeSave | null = null
  let disposed = false

  const beginCapture = (nextMessage = 'Capturing this performance.'): void => {
    saveCandidate = null
    setState('capturing')
    setMessage(nextMessage)
  }

  const beginProcessing = (
    nextMessage = 'Preparing a private replay on this device.',
  ): void => {
    saveCandidate = null
    setState('processing')
    setMessage(nextMessage)
  }

  const ready = (
    save: PerformanceTakeSave,
    nextMessage = 'Replay ready. Nothing is saved until you keep it.',
  ): void => {
    saveCandidate = save
    setState('ready')
    setMessage(nextMessage)
  }

  const fail = (nextMessage: string): void => {
    saveCandidate = null
    setState('error')
    setMessage(nextMessage)
  }

  const unsupported = (nextMessage: string): void => {
    saveCandidate = null
    setState('unsupported')
    setMessage(nextMessage)
  }

  const dismiss = (): boolean => {
    if (state() === 'saving') return false
    saveCandidate = null
    setState('idle')
    setMessage('')
    return true
  }

  const keep = async (): Promise<boolean> => {
    const save = saveCandidate
    if (save === null || state() !== 'ready') return false
    setState('saving')
    setMessage('Keeping this take in Hear Yourself on this device.')
    let result: SaveVoiceTakeResult
    try {
      result = await save()
    } catch {
      if (disposed) return false
      setState('ready')
      setMessage('The take could not be kept. Your temporary replay is ready.')
      return false
    }
    if (disposed) return false
    if (result.ok) {
      saveCandidate = null
      setState('saved')
      setMessage('Kept in Hear Yourself on this device.')
      return true
    }
    setState('ready')
    setMessage(
      result.quotaExceeded
        ? 'This device does not have enough local space for the take.'
        : 'The take could not be kept. Your temporary replay is ready.',
    )
    return false
  }

  onCleanup(() => {
    disposed = true
    saveCandidate = null
  })

  return {
    state,
    message,
    beginCapture,
    beginProcessing,
    ready,
    fail,
    unsupported,
    dismiss,
    keep,
  }
}

export function performanceTakeKeepLabel(
  state: PerformanceTakeKeepState,
): string {
  if (state === 'processing') return 'Preparing replay'
  if (state === 'saving') return 'Keeping take'
  if (state === 'saved') return 'Kept in Hear Yourself'
  if (state === 'error') return 'Retry performance'
  return 'Keep in Hear Yourself'
}
