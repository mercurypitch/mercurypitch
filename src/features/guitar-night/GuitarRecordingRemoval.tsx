// Gallery and quick switching share one explicit, exact-recording removal confirmation.
import { createSignal, onCleanup, Show } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { GuitarRecording } from '@/lib/guitar/recording-types'

export function useGuitarRecordingRemoval(options: {
  remove(id: string): Promise<void>
  fallbackFocus?(): HTMLElement | undefined
}) {
  const [target, setTarget] = createSignal<GuitarRecording | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  let disposed = false
  onCleanup(() => {
    disposed = true
  })
  const request = (row: GuitarRecording) => {
    if (busy() || row.state === 'capturing') return
    setError(null)
    setTarget(row)
  }
  const cancel = () => {
    if (busy()) return
    setTarget(null)
    setError(null)
  }
  const confirm = async () => {
    const row = target()
    if (row === null || busy()) return
    setBusy(true)
    setError(null)
    try {
      await options.remove(row.id)
      if (disposed) return
      setTarget(null)
      // The removed tile no longer owns a focus target. Return to the surviving
      // shelf control only if the dialog could not restore its original button.
      queueMicrotask(() => {
        const active = document.activeElement
        if (active === document.body || active?.isConnected !== true)
          options.fallbackFocus?.()?.focus({ preventScroll: true })
      })
    } catch (cause) {
      if (!disposed)
        setError(
          cause instanceof Error
            ? cause.message
            : 'This melody could not be removed. Try again; it is still saved.',
        )
    } finally {
      if (!disposed) setBusy(false)
    }
  }
  return { target, busy, error, request, cancel, confirm }
}

export function GuitarRecordingRemoveDialog(props: {
  removal: ReturnType<typeof useGuitarRecordingRemoval>
}) {
  return (
    <ConfirmDialog
      open={props.removal.target() !== null}
      title="Remove this melody?"
      message={
        <>
          Remove <strong>{props.removal.target()?.title}</strong> from this
          device, including its original audio, detected notes, corrections, all
          practice revisions, song attachments and Hear Yourself entry? This
          cannot be undone. Other melodies and practice attempts remain.
          <Show when={props.removal.error()}>
            {(message) => <span role="alert"> {message()}</span>}
          </Show>
        </>
      }
      busy={props.removal.busy()}
      confirmLabel="Remove melody"
      onCancel={props.removal.cancel}
      onConfirm={() => void props.removal.confirm()}
    />
  )
}
