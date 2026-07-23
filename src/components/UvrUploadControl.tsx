// ============================================================
// UVR File Upload Control
// ============================================================

import type { Component } from 'solid-js'
import { isZipFile } from '@/db/services/session-export-service'
import { AUDIO_UPLOAD_ALLOWED_TYPES, formatFileSize } from '@/lib/audio-accept'
import { CONTENT_POLICY_URL } from '@/lib/legal-links'
import { showActionNotification } from '@/stores/notifications-store'
import { FileUpload, MusicNote } from './icons'

interface UploadControlProps {
  onFilesSelect?: (files: File[]) => void
  /** Called when the user drops/picks exported session ZIP(s) — routes them
   *  to the session import flow instead of audio processing. */
  onImportZips?: (files: File[]) => void
  maxSize?: number
  /** Tooltip on the size pill + appended to the too-large message, e.g. to
   *  explain the smaller cloud-GPU limit and point at Browser mode. */
  maxSizeNote?: string
  allowedTypes?: string[]
  disabled?: boolean
}

export const UvrUploadControl: Component<UploadControlProps> = (props) => {
  const maxSize = () => props.maxSize ?? 100 * 1024 * 1024 // 100MB default
  const allowedTypes = () => props.allowedTypes || AUDIO_UPLOAD_ALLOWED_TYPES

  const acceptsAudio = (file: File): boolean => {
    const mimeType = file.type.toLowerCase()
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    return (
      allowedTypes().includes(mimeType) || allowedTypes().includes(extension)
    )
  }

  const handleFilesSelect = (files: File[]) => {
    if (props.disabled === true) return

    const oversized = files.filter(
      (file) => acceptsAudio(file) && file.size > maxSize(),
    )
    const invalid = files.filter((file) => !acceptsAudio(file))
    const accepted = files.filter(
      (file) => acceptsAudio(file) && file.size <= maxSize(),
    )

    if (oversized.length > 0) {
      const note =
        props.maxSizeNote !== undefined ? ` ${props.maxSizeNote}.` : ''
      showActionNotification(
        `${oversized.length} ${oversized.length === 1 ? 'song is' : 'songs are'} over the ${formatFileSize(maxSize())} limit.${note}`,
        'warning',
        { label: 'OK', onClick: () => {} },
      )
    }

    if (invalid.length > 0) {
      showActionNotification(
        `${invalid.length} unsupported ${invalid.length === 1 ? 'file was' : 'files were'} skipped. Choose MP3, WAV or FLAC audio.`,
        'warning',
        { label: 'OK', onClick: () => {} },
      )
    }

    if (accepted.length > 0) props.onFilesSelect?.(accepted)
  }

  // dragenter/dragleave fire for every child element crossed inside the
  // zone — only the balance says whether the pointer actually left, so the
  // highlight used to flicker off after the first child crossing.
  let dragDepth = 0

  const setDragActive = (event: DragEvent, active: boolean) => {
    const element = event.currentTarget as HTMLElement | null
    element?.classList.toggle('dragging', active)
  }

  const handleDragEnter = (event: DragEvent) => {
    if (props.disabled === true) return
    dragDepth++
    setDragActive(event, true)
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    if (props.disabled === true) return
    if (dragDepth === 0) dragDepth = 1
    setDragActive(event, true)
  }

  const handleDragLeave = (event: DragEvent) => {
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) setDragActive(event, false)
  }

  /** Route session ZIP exports to the import flow and return any remaining
   *  audio candidates. Imports are DB-only, so they bypass the `disabled`
   *  (another-session-processing) guard. */
  const routeZipsToImport = (files: File[]): File[] => {
    if (props.onImportZips === undefined) return files
    const zips = files.filter(isZipFile)
    if (zips.length > 0) props.onImportZips(zips)
    return files.filter((file) => !isZipFile(file))
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    dragDepth = 0
    setDragActive(e, false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    const audioFiles = routeZipsToImport([...files])
    if (props.disabled === true) return
    handleFilesSelect(audioFiles)
  }

  const handleFileInput = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    if (input.files && input.files.length > 0) {
      const audioFiles = routeZipsToImport([...input.files])
      if (audioFiles.length > 0) handleFilesSelect(audioFiles)
      input.value = ''
    }
  }

  return (
    <div
      class={`uvr-upload-control ${props.disabled === true ? 'disabled' : ''}`}
    >
      <div class="upload-header">
        <div class="upload-icon-wrapper">
          <MusicNote />
        </div>
        <h3>Add songs to your setlist</h3>
        <p class="upload-subtitle">
          Build a setlist and separate every song in order
        </p>
      </div>

      {/* Upload Zone */}
      <label
        class={`upload-zone ${props.disabled === true ? 'disabled' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        for="uvr-file-input"
      >
        <input
          id="uvr-file-input"
          type="file"
          accept={allowedTypes().join(',')}
          multiple
          onChange={handleFileInput}
          class="file-input"
          disabled={props.disabled}
        />

        <div class="upload-content">
          <div class="upload-icon">
            <FileUpload />
          </div>
          <p class="upload-text">Drop MP3, WAV or FLAC songs here</p>
          <p class="upload-hint">
            Up to 15 at once, or{' '}
            <span class="upload-text-highlight">choose files</span>
          </p>
        </div>
      </label>

      {/* Supported Formats */}
      <div class="supported-formats">
        <div class="formats-list">
          <span class="format-tag">MP3</span>
          <span class="format-tag">WAV</span>
          <span class="format-tag">FLAC</span>
          <span
            class="format-tag format-tag-size"
            title={props.maxSizeNote}
            data-testid="uvr-max-size-pill"
          >
            {formatFileSize(maxSize())}
          </span>
        </div>
      </div>

      {/* Rights notice — the legally important touchpoint. Users provide their
          own audio; we never fetch it from a link. Links to the Terms on the
          marketing site (single source of truth) rather than restating them. */}
      <p class="upload-rights-note">
        By uploading, you accept our{' '}
        <a href={CONTENT_POLICY_URL} target="_blank" rel="noopener noreferrer">
          terms
        </a>
        .
      </p>
    </div>
  )
}
