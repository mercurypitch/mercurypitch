// ============================================================
// useFileDropZone — arm an element (a practice canvas container)
// as a drag-and-drop target for song files. Tracks drag-over
// state with an enter/leave counter so child elements don't
// flicker the overlay, and filters dropped files by name.
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'

export interface FileDropZoneOptions {
  /** File-name filter, e.g. /\.(mid|midi)$/i */
  accept: RegExp
  onFiles: (files: File[]) => void
  /** Called when a drop contains only files that fail the filter. */
  onRejected?: (files: File[]) => void
}

export interface FileDropZone {
  isDragOver: Accessor<boolean>
  /** Attach as ref to the drop container (listeners cleaned up on dispose). */
  bind: (el: HTMLElement) => void
}

const dragHasFiles = (e: DragEvent): boolean =>
  Array.from(e.dataTransfer?.types ?? []).includes('Files')

export function useFileDropZone(opts: FileDropZoneOptions): FileDropZone {
  const [isDragOver, setIsDragOver] = createSignal(false)
  // dragenter/dragleave fire for every child crossed; only the balance tells
  // us whether the pointer actually left the container.
  let depth = 0

  const onDragEnter = (e: DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    depth++
    setIsDragOver(true)
  }

  const onDragOver = (e: DragEvent) => {
    if (!dragHasFiles(e)) return
    // Required — without preventDefault the browser navigates to the file.
    e.preventDefault()
  }

  const onDragLeave = (e: DragEvent) => {
    if (!dragHasFiles(e)) return
    depth = Math.max(0, depth - 1)
    if (depth === 0) setIsDragOver(false)
  }

  const onDrop = (e: DragEvent) => {
    if (!dragHasFiles(e)) return
    e.preventDefault()
    depth = 0
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length === 0) return
    const accepted = files.filter((f) => opts.accept.test(f.name))
    if (accepted.length > 0) {
      opts.onFiles(accepted)
    } else {
      opts.onRejected?.(files)
    }
  }

  const bind = (el: HTMLElement) => {
    el.addEventListener('dragenter', onDragEnter)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    onCleanup(() => {
      el.removeEventListener('dragenter', onDragEnter)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    })
  }

  return { isDragOver, bind }
}
