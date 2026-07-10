// ============================================================
// UVR File Upload Control
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { isZipFile } from '@/db/services/session-export-service'
import { CONTENT_POLICY_URL } from '@/lib/legal-links'
import { showActionNotification } from '@/stores/notifications-store'
import { FileUpload, ImportFile, MusicNote } from './icons'

interface UploadControlProps {
  onFileSelect?: (file: File) => void
  onFileReady?: (file: File) => void
  onProcessStart?: (sessionId: string) => void
  /** Called when the user drops/picks exported session ZIP(s) — routes them
   *  to the session import flow instead of audio processing. */
  onImportZips?: (files: File[]) => void
  maxSize?: number
  /** Tooltip on the size pill + appended to the too-large message, e.g. to
   *  explain the smaller cloud-GPU limit and point at Browser mode. */
  maxSizeNote?: string
  allowedTypes?: string[]
  processing?: boolean
  disabled?: boolean
}

export const UvrUploadControl: Component<UploadControlProps> = (props) => {
  const [isDragging, setIsDragging] = createSignal(false)
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null)

  const maxSize = () => props.maxSize ?? 100 * 1024 * 1024 // 100MB default
  const allowedTypes = () =>
    props.allowedTypes || [
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/wave',
      'audio/x-wav',
      'audio/flac',
      'audio/x-flac',
      '.mp3',
      '.wav',
      '.flac',
    ]

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const handleFileSelect = (file: File) => {
    if (props.disabled === true) return

    // Validate file size
    if (file.size > maxSize()) {
      const note =
        props.maxSizeNote !== undefined ? ` ${props.maxSizeNote}.` : ''
      showActionNotification(
        `File too large! Maximum size: ${formatFileSize(maxSize())}.${note}`,
        'warning',
        { label: 'OK', onClick: () => {} },
      )
      return
    }

    // Validate file type
    const mimeType = file.type.toLowerCase()
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`

    if (
      !allowedTypes().includes(mimeType) &&
      !allowedTypes().includes(extension)
    ) {
      showActionNotification(
        'Invalid file type. Please upload MP3, WAV or FLAC files.',
        'warning',
        { label: 'OK', onClick: () => {} },
      )
      return
    }

    setSelectedFile(file)
    if (props.onFileSelect) {
      props.onFileSelect(file)
    }
    if (props.onFileReady) {
      props.onFileReady(file)
    }
  }

  // dragenter/dragleave fire for every child element crossed inside the
  // zone — only the balance says whether the pointer actually left, so the
  // highlight used to flicker off after the first child crossing.
  let dragDepth = 0

  const handleDragEnter = () => {
    if (props.disabled === true) return
    dragDepth++
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) setIsDragging(false)
  }

  /** Session ZIP exports go to the import flow, not audio processing.
   *  Returns true when the files were consumed as ZIPs. Imports are DB-only,
   *  so they bypass the `disabled` (another-session-processing) guard. */
  const routeZipsToImport = (files: File[]): boolean => {
    if (props.onImportZips === undefined) return false
    const zips = files.filter(isZipFile)
    if (zips.length === 0) return false
    props.onImportZips(zips)
    return true
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    dragDepth = 0
    setIsDragging(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    if (routeZipsToImport([...files])) return
    if (props.disabled === true) return
    handleFileSelect(files[0])
  }

  const handleFileInput = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    if (input.files && input.files.length > 0) {
      if (routeZipsToImport([...input.files])) {
        input.value = ''
        return
      }
      handleFileSelect(input.files[0])
    }
  }

  const handleClear = () => {
    if (props.disabled === true) return
    setSelectedFile(null)
    const fileInput = document.getElementById(
      'uvr-file-input',
    ) as HTMLInputElement | null
    if (fileInput) fileInput.value = ''
  }

  const handleProcess = () => {
    if (props.disabled === true) return
    if (selectedFile()) {
      // Generate session ID
      const sessionId = `session-${Date.now()}`
      if (props.onProcessStart) {
        props.onProcessStart(sessionId)
      }
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
        <h3>Select a Song</h3>
        <p class="upload-subtitle">
          Upload an audio file to separate vocals and instruments
        </p>
      </div>

      {/* Upload Zone */}
      <label
        class={`upload-zone ${isDragging() ? 'dragging' : ''} ${props.disabled === true ? 'disabled' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        for="uvr-file-input"
      >
        <input
          id="uvr-file-input"
          type="file"
          accept={allowedTypes().join(',')}
          onChange={handleFileInput}
          class="file-input"
          disabled={props.disabled}
        />

        <Show when={!selectedFile()}>
          <div class="upload-content">
            <div class="upload-icon">
              <FileUpload />
            </div>
            <p class="upload-text">
              Drag & drop an audio file here, or{' '}
              <span class="upload-text-highlight">click to browse</span>
            </p>
          </div>
        </Show>

        <Show when={selectedFile()}>
          <div class="file-info">
            <div class="file-preview">
              <div class="file-icon">
                <MusicNote />
              </div>
              <div class="file-details">
                <p class="file-name">{selectedFile()?.name ?? 'Unknown'}</p>
                <p class="file-meta">
                  {formatFileSize(selectedFile()?.size ?? 0)} •
                  {selectedFile()?.type ?? 'Unknown type'}
                </p>
              </div>
            </div>

            <Show when={props.processing}>
              <div class="processing-indicator">
                <div class="pulse-spinner" />
                <span>Processing...</span>
              </div>
            </Show>

            <Show when={!(props.processing ?? false)}>
              <div class="upload-actions">
                <button
                  class="upload-btn upload-btn-secondary"
                  onClick={handleClear}
                  disabled={props.disabled}
                >
                  Change File
                </button>
                <button
                  class="upload-btn upload-btn-primary"
                  onClick={handleProcess}
                  disabled={!selectedFile() || props.disabled}
                >
                  <ImportFile />
                  Process
                </button>
              </div>
            </Show>
          </div>
        </Show>
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
