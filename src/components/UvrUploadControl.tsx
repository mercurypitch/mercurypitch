// ============================================================
// UVR File Upload Control
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { FileUpload, MusicNote } from './icons'

interface UploadControlProps {
  onFileSelect?: (file: File) => void
  onFileReady?: (file: File) => void
  onProcessStart?: (sessionId: string) => void
  maxSize?: number
  allowedTypes?: string[]
  processing?: boolean
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
    ]

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  }

  const _formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleFileSelect = (file: File) => {
    // Validate file size
    if (file.size > maxSize()) {
      alert(`File too large! Maximum size: ${formatFileSize(maxSize())}`)
      return
    }

    // Validate file type
    const mimeType = file.type.toLowerCase()
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`

    if (
      !allowedTypes().includes(mimeType) &&
      !allowedTypes().includes(extension)
    ) {
      alert('Invalid file type. Please upload MP3 or WAV files.')
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

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInput = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    if (input.files && input.files.length > 0) {
      handleFileSelect(input.files[0])
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    const fileInput = document.getElementById(
      'uvr-file-input',
    ) as HTMLInputElement | null
    if (fileInput) fileInput.value = ''
  }

  const handleProcess = () => {
    if (selectedFile()) {
      // Generate session ID
      const sessionId = `session-${Date.now()}`
      if (props.onProcessStart) {
        props.onProcessStart(sessionId)
      }
    }
  }

  return (
    <div class="uvr-upload-control">
      <div class="upload-header">
        <div class="upload-icon-wrapper">
          <MusicNote />
        </div>
        <h3>Import Audio File</h3>
      </div>

      {/* Upload Zone */}
      <label
        class={`upload-zone ${isDragging() ? 'dragging' : ''}`}
        onDragEnter={() => setIsDragging(true)}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        for="uvr-file-input"
      >
        <input
          id="uvr-file-input"
          type="file"
          accept={allowedTypes().join(',')}
          onChange={handleFileInput}
          class="file-input"
        />

        <Show when={!selectedFile()}>
          <div class="upload-content">
            <div class="upload-icon">
              <FileUpload />
            </div>
            <p class="upload-text">
              Drag & drop your file here or{' '}
              <span class="upload-text-highlight">browse</span>
            </p>
          </div>
        </Show>

        <Show when={selectedFile()}>
          <div class="file-info">
            <div class="file-preview">
              <div class="file-icon">🎵</div>
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
                >
                  Change File
                </button>
                <button
                  class="upload-btn upload-btn-primary"
                  onClick={handleProcess}
                  disabled={!selectedFile()}
                >
                  Process with UVR
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
          <span class="format-tag format-tag-size">{formatFileSize(maxSize())}</span>
        </div>
      </div>
    </div>
  )
}


