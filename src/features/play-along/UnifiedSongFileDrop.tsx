// UnifiedSongFileDrop provides host-neutral one-file picker and drag mechanics.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, createUniqueId, Show } from 'solid-js'
import { openFilePicker } from '@/lib/file-picker'

export interface UnifiedSongFileDropCopy {
  chooseFile: string
  dropAlternative: string
  formats: string
  activeDrop: string
  oneFile: string
  opening(fileName: string): string
}

export interface UnifiedSongFileDropClasses {
  root: string
  status: string
  prompt: string
  choose: string
  dropAlternative: string
  formats: string
  overlay: string
  input?: string
}

export interface UnifiedSongFileDropProps {
  children: JSX.Element
  accept: string
  copy: UnifiedSongFileDropCopy
  classes: UnifiedSongFileDropClasses
  testId: string
  onFile: (file: File) => void
  onRejected: (files: readonly File[]) => void
  /**
   * Delegate picker opening when the host already owns a guarded file input.
   * Without this callback the component renders and owns its accepted input.
   */
  onChoose?: () => void
  onPickerUnavailable?: () => void
  disabled?: boolean
  busy?: boolean
  openingFileName?: string | null
  message?: string | null
  class?: string
}

function dragHasFiles(event: DragEvent): boolean {
  return (
    Array.from(event.dataTransfer?.types ?? []).includes('Files') ||
    (event.dataTransfer?.files.length ?? 0) > 0
  )
}

export function UnifiedSongFileDrop(props: UnifiedSongFileDropProps) {
  const [dragActive, setDragActive] = createSignal(false)
  const hintId = createUniqueId()
  let dragDepth = 0
  let ownedInput: HTMLInputElement | undefined

  const opening = () => Boolean(props.openingFileName)
  const blocked = () => props.disabled === true || opening()
  const rootClass = () =>
    [props.classes.root, props.class].filter(Boolean).join(' ')

  const resetDrag = () => {
    dragDepth = 0
    setDragActive(false)
  }

  const submitFiles = (files: readonly File[]) => {
    if (blocked() || files.length === 0) return
    if (files.length !== 1) {
      props.onRejected(files)
      return
    }
    props.onFile(files[0])
  }

  const handleChoose = () => {
    if (props.onChoose !== undefined) {
      props.onChoose()
      return
    }
    openFilePicker(ownedInput, {
      onUnavailable: () => props.onPickerUnavailable?.(),
    })
  }

  const handleInputChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ''
    submitFiles(files)
  }

  const handleDragEnter = (event: DragEvent) => {
    if (!dragHasFiles(event)) return
    event.preventDefault()
    if (blocked()) return
    dragDepth += 1
    setDragActive(true)
  }

  const handleDragOver = (event: DragEvent) => {
    if (!dragHasFiles(event)) return
    event.preventDefault()
    if (blocked()) return
    if (dragDepth === 0) dragDepth = 1
    setDragActive(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    if (!dragHasFiles(event)) return
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) setDragActive(false)
  }

  const handleDrop = (event: DragEvent) => {
    if (!dragHasFiles(event)) return
    event.preventDefault()
    const files = Array.from(event.dataTransfer?.files ?? [])
    resetDrag()
    submitFiles(files)
  }

  return (
    <div
      class={rootClass()}
      data-testid={props.testId}
      aria-busy={opening() || props.busy === true ? true : undefined}
      aria-disabled={blocked() ? true : undefined}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {props.children}

      <Show when={opening()}>
        <div
          class={props.classes.status}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span title={props.openingFileName ?? undefined}>
            {props.copy.opening(props.openingFileName ?? '')}
          </span>
        </div>
      </Show>

      <Show when={props.message}>
        {(message) => (
          <div class={props.classes.status} role="alert" aria-atomic="true">
            <span>{message()}</span>
          </div>
        )}
      </Show>

      <div class={props.classes.prompt}>
        <button
          type="button"
          class={props.classes.choose}
          disabled={blocked()}
          aria-describedby={hintId}
          onClick={handleChoose}
        >
          {props.copy.chooseFile}
        </button>
        <Show when={props.copy.dropAlternative !== ''}>
          <span class={props.classes.dropAlternative}>
            {props.copy.dropAlternative}
          </span>
        </Show>
        <span id={hintId} class={props.classes.formats}>
          {props.copy.formats}
        </span>
      </div>

      <Show when={props.onChoose === undefined}>
        <input
          ref={ownedInput}
          class={props.classes.input}
          data-testid={`${props.testId}-input`}
          type="file"
          accept={props.accept}
          disabled={blocked()}
          hidden
          onChange={handleInputChange}
          tabindex="-1"
        />
      </Show>

      <Show when={dragActive() && !blocked()}>
        <div class={props.classes.overlay} aria-hidden="true">
          <strong>{props.copy.activeDrop}</strong>
          <span>{props.copy.oneFile}</span>
        </div>
      </Show>
    </div>
  )
}
