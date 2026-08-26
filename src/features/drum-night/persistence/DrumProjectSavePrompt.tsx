// ============================================================
// Drum Project Save Prompt — focused inline naming for the current groove
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createSignal, createUniqueId, Show } from 'solid-js'
import type { DrumCurrentProjectView, DrumProjectOperationState, } from './drum-persistence-ui'
import styles from './DrumProjectLibrary.module.css'

interface DrumProjectSavePromptProps {
  readonly open: boolean
  readonly current: DrumCurrentProjectView
  readonly operation: DrumProjectOperationState
  readonly onSave: (name: string) => void
  readonly onCancel: () => void
}

export function DrumProjectSavePrompt(
  props: DrumProjectSavePromptProps,
): JSX.Element {
  const headingId = createUniqueId()
  const [name, setName] = createSignal('')
  let input: HTMLInputElement | undefined
  let wasOpen = false
  let wasFocusable = false

  const busy = () => props.operation.kind === 'pending'

  createEffect(() => {
    const open = props.open
    const focusable = open && !busy()
    if (open && !wasOpen) {
      setName(props.current.name.trim() || props.current.suggestedName)
    }
    if (focusable && !wasFocusable) {
      queueMicrotask(() => {
        if (input !== undefined && input.isConnected && !input.disabled) {
          input.focus()
        }
      })
    }
    wasOpen = open
    wasFocusable = focusable
  })

  const submit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault()
    const candidate = name().trim()
    if (candidate === '' || busy()) return
    props.onSave(candidate)
  }

  return (
    <Show when={props.open}>
      <form
        class={styles.saveLedger}
        aria-labelledby={headingId}
        onSubmit={submit}
      >
        <div class={styles.formCopy}>
          <span>SAVE CURRENT GROOVE</span>
          <h3 id={headingId}>
            {props.current.persisted
              ? 'Save these changes'
              : 'Name this pocket'}
          </h3>
          <p>Groove notation and practice settings stay on this device.</p>
        </div>
        <label class={styles.nameField}>
          <span>Project name</span>
          <input
            ref={input}
            value={name()}
            maxlength={80}
            autocomplete="off"
            disabled={busy()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div class={styles.formActions}>
          <button
            class={styles.primaryAction}
            type="submit"
            disabled={name().trim() === '' || busy()}
          >
            {props.operation.kind === 'pending' &&
            props.operation.action === 'save'
              ? 'Saving…'
              : 'Save on this device'}
          </button>
          <button
            class={styles.quietAction}
            type="button"
            disabled={busy()}
            onClick={() => props.onCancel()}
          >
            Cancel
          </button>
        </div>
      </form>
    </Show>
  )
}
