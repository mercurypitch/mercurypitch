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

  const maxSize = () => props.maxSize || 100 * 1024 * 1024 // 100MB default
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

  const formatDuration = (seconds: number): string => {
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
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}` || ''

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
        <p class="upload-subtitle">
          Upload MP3 or WAV files to separate vocals and create MIDI
        </p>
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
            <p class="upload-hint">
              Supports MP3, WAV files up to {formatFileSize(maxSize())}
            </p>
          </div>
        </Show>

        <Show when={selectedFile()}>
          <div class="file-info">
            <div class="file-preview">
              <div class="file-icon">🎵</div>
              <div class="file-details">
                <p class="file-name">{selectedFile()?.name || 'Unknown'}</p>
                <p class="file-meta">
                  {formatFileSize(selectedFile()?.size || 0)} •
                  {selectedFile()?.type || 'Unknown type'}
                </p>
              </div>
            </div>

            <Show when={props.processing}>
              <div class="processing-indicator">
                <div class="pulse-spinner" />
                <span>Processing...</span>
              </div>
            </Show>

            <Show when={!props.processing}>
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
        <p class="formats-label">Supported formats:</p>
        <div class="formats-list">
          <span class="format-tag">MP3</span>
          <span class="format-tag">WAV</span>
          <span class="format-tag">FLAC</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CSS Styles (inline for this component)
// ============================================================

export const UvrUploadControlStyles: string = `
.uvr-upload-control {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  width: 100%;
}

.upload-header {
  text-align: center;
}

.upload-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  margin: 0 auto 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  color: white;
}

.upload-icon-wrapper svg {
  width: 1.75rem;
  height: 1.75rem;
}

.upload-header h3 {
  font-size: 1.25rem;
  color: var(--fg-primary);
  margin-bottom: 0.25rem;
}

.upload-subtitle {
  color: var(--fg-secondary);
  font-size: 0.9rem;
}

.upload-zone {
  position: relative;
  border: 2px dashed var(--border);
  border-radius: 1rem;
  background: var(--bg-secondary);
  transition: all 0.2s ease;
  cursor: pointer;
}

.upload-zone:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}

.upload-zone.dragging {
  border-color: var(--accent);
  background: rgba(102, 126, 234, 0.1);
  transform: scale(1.01);
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  gap: 0.75rem;
}

.upload-icon {
  color: var(--fg-tertiary);
}

.upload-icon svg {
  width: 3rem;
  height: 3rem;
}

.upload-text {
  color: var(--fg-primary);
  font-size: 1rem;
  font-weight: 500;
}

.upload-text-highlight {
  color: var(--accent);
  text-decoration: underline;
}

.upload-hint {
  color: var(--fg-secondary);
  font-size: 0.85rem;
}

.file-info {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 0.5rem;
}

.file-icon {
  font-size: 1.75rem;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  color: var(--fg-primary);
  font-weight: 500;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-meta {
  color: var(--fg-secondary);
  font-size: 0.8rem;
}

.processing-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 0.5rem;
  color: var(--accent);
  font-size: 0.9rem;
}

.pulse-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid var(--accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.upload-actions {
  display: flex;
  gap: 0.75rem;
}

.upload-btn {
  flex: 1;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.upload-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.upload-btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.upload-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-btn-secondary {
  background: var(--bg-tertiary);
  color: var(--fg-primary);
}

.upload-btn-secondary:hover:not(:disabled) {
  background: var(--border);
}

.supported-formats {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
}

.formats-label {
  color: var(--fg-secondary);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.formats-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.format-tag {
  padding: 0.25rem 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: var(--fg-secondary);
}
`
