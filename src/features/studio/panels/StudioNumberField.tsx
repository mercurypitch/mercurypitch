// Studio number field — one committed edit, with exact bounds and cancellable drafts.
import { createEffect, createMemo, createSignal, createUniqueId, Show, } from 'solid-js'
import styles from '@/features/studio/StudioPage.module.css'

interface StudioNumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  onCommit(value: number): boolean
}

export function StudioNumberField(props: StudioNumberFieldProps) {
  const labelId = createUniqueId()
  const errorId = createUniqueId()
  const value = createMemo(() => props.value)
  const disabled = createMemo(() => props.disabled === true)
  const [draft, setDraft] = createSignal('')
  const [dirty, setDirty] = createSignal(false)
  const [error, setError] = createSignal('')

  function reset(): void {
    setDraft(String(value()))
    setDirty(false)
    setError('')
  }
  createEffect(() => {
    value()
    disabled()
    reset()
  })

  function commit(): void {
    if (!dirty() || disabled()) return
    const next = Number(draft())
    if (
      draft().trim() === '' ||
      !Number.isFinite(next) ||
      next < props.min ||
      next > props.max
    ) {
      reset()
      setError(
        `Use ${props.min} to ${props.max}${props.unit !== undefined && props.unit !== '' ? ` ${props.unit}` : ''}.`,
      )
      return
    }
    if (next !== value() && !props.onCommit(next)) {
      reset()
      setError(
        'This edit could not be applied. The previous value is unchanged.',
      )
      return
    }
    // Commands may quantize seconds to source frames; display the accepted value.
    setDraft(String(value()))
    setDirty(false)
    setError('')
  }

  function keyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape' && (dirty() || error() !== '')) {
      // Native handling precedes the panel's focus trap and Escape handler.
      event.preventDefault()
      event.stopPropagation()
      reset()
    }
  }
  return (
    <label class={styles.field}>
      <span id={labelId}>{props.label}</span>
      <span class={styles.fieldInput}>
        <input
          type="number"
          value={draft()}
          min={props.min}
          max={props.max}
          step={props.step ?? 'any'}
          disabled={disabled()}
          aria-labelledby={labelId}
          aria-invalid={error() !== ''}
          aria-describedby={error() ? errorId : undefined}
          onInput={(event) => {
            setDraft(event.currentTarget.value)
            setDirty(true)
            setError('')
          }}
          onBlur={commit}
          on:keydown={keyDown}
        />
        <span>{props.unit}</span>
      </span>
      <Show when={error()}>
        <span id={errorId} class={styles.help} role="alert">
          {error()}
        </span>
      </Show>
    </label>
  )
}
