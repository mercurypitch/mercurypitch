// ============================================================
// GuitarNightFileDrop turns any song well into a focused, accessible import surface.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, createUniqueId, Show } from 'solid-js'
import { GUITAR_NIGHT_IMPORT_DROP_COPY, GUITAR_NIGHT_IMPORT_FORMATS, } from './guitar-night-import'
import styles from './GuitarNightApp.module.css'

export interface GuitarNightFileDropProps {
  children: JSX.Element
  onChoose: () => void
  onFile: (file: File) => void
  onRejected: (files: readonly File[]) => void
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

export function GuitarNightFileDrop(props: GuitarNightFileDropProps) {
  const [dragActive, setDragActive] = createSignal(false)
  const hintId = createUniqueId()
  let dragDepth = 0

  const opening = () => Boolean(props.openingFileName)
  const blocked = () => props.disabled === true || opening()
  const rootClass = () =>
    [styles.guitarNightFileDrop, props.class].filter(Boolean).join(' ')

  const resetDrag = () => {
    dragDepth = 0
    setDragActive(false)
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
    if (blocked() || files.length === 0) return
    if (files.length !== 1) {
      props.onRejected(files)
      return
    }
    props.onFile(files[0])
  }

  return (
    <div
      class={rootClass()}
      data-testid="guitar-night-file-drop"
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
          class={styles.guitarNightFileDropStatus}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span title={props.openingFileName ?? undefined}>
            Opening {props.openingFileName}…
          </span>
        </div>
      </Show>

      <Show when={props.message}>
        {(message) => (
          <div
            class={styles.guitarNightFileDropStatus}
            role="alert"
            aria-atomic="true"
          >
            <span>{message()}</span>
          </div>
        )}
      </Show>

      <div class={styles.guitarNightFileDropPrompt}>
        <button
          type="button"
          class={styles.guitarNightFileDropChoose}
          disabled={blocked()}
          aria-describedby={hintId}
          onClick={() => props.onChoose()}
        >
          Choose a file
        </button>
        <span class={styles.guitarNightFileDropOr}>or drop it here</span>
        <span id={hintId} class={styles.guitarNightFileDropFormats}>
          {GUITAR_NIGHT_IMPORT_FORMATS}
        </span>
      </div>

      <Show when={dragActive() && !blocked()}>
        <div class={styles.guitarNightFileDropOverlay} aria-hidden="true">
          <strong>{GUITAR_NIGHT_IMPORT_DROP_COPY}</strong>
          <span>One file at a time</span>
        </div>
      </Show>
    </div>
  )
}
