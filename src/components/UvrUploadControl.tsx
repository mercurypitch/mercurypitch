// ============================================================
// UVR File Upload Control
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { FileUpload, ImportFile, MusicNote } from './icons'
import { Button } from './shared/Button'
import styles from './UvrUploadControl.module.css'

interface UploadControlProps {
  onFileSelect?: (file: File) => void
  onFileReady?: (file: File) => void
  onProcessStart?: (sessionId: string) => void
  maxSize?: number
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
    if (props.disabled === true) return
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
      class={`${styles.uvrUploadControl} ${props.disabled === true ? styles.disabled : ''}`}
    >
      <div class={styles.uploadHeader}>
        <div class={styles.uploadIconWrapper}>
          <MusicNote />
        </div>
        <h3>Select a Song</h3>
        <p class={styles.uploadSubtitle}>
          Upload an audio file to separate vocals and instruments
        </p>
      </div>

      {/* Upload Zone */}
      <label
        class={`${styles.uploadZone} ${isDragging() ? styles.dragging : ''} ${props.disabled === true ? styles.disabled : ''}`}
        onDragEnter={() => props.disabled !== true && setIsDragging(true)}
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
          class={styles.fileInput}
          disabled={props.disabled}
        />

        <Show when={!selectedFile()}>
          <div class={styles.uploadContent}>
            <div class={styles.uploadIcon}>
              <FileUpload />
            </div>
            <p class={styles.uploadText}>
              Drag & drop an audio file here, or{' '}
              <span class={styles.uploadTextHighlight}>click to browse</span>
            </p>
          </div>
        </Show>

        <Show when={selectedFile()}>
          <div class={styles.fileInfo}>
            <div class={styles.filePreview}>
              <div class={styles.fileIcon}>
                <MusicNote />
              </div>
              <div class={styles.fileDetails}>
                <p class={styles.fileName}>
                  {selectedFile()?.name ?? 'Unknown'}
                </p>
                <p class={styles.fileMeta}>
                  {formatFileSize(selectedFile()?.size ?? 0)} •{' '}
                  {selectedFile()?.type ?? 'Unknown type'}
                </p>
              </div>
            </div>

            <Show when={props.processing}>
              <div class={styles.processingIndicator}>
                <div class={styles.pulseSpinner} />
                <span>Processing...</span>
              </div>
            </Show>

            <Show when={!(props.processing ?? false)}>
              <div class={styles.uploadActions}>
                <Button
                  variant="secondary"
                  onClick={handleClear}
                  disabled={props.disabled}
                  class={styles.uploadBtn}
                >
                  Change File
                </Button>
                <Button
                  variant="primary"
                  onClick={handleProcess}
                  disabled={!selectedFile() || props.disabled}
                  class={`${styles.uploadBtn} ${styles.uploadBtnPrimary}`}
                >
                  <ImportFile />
                  Process
                </Button>
              </div>
            </Show>
          </div>
        </Show>
      </label>

      {/* Supported Formats */}
      <div class={styles.supportedFormats}>
        <div class={styles.formatsList}>
          <span class={styles.formatTag}>MP3</span>
          <span class={styles.formatTag}>WAV</span>
          <span class={styles.formatTag}>FLAC</span>
          <span class={`${styles.formatTag} ${styles.formatTagSize}`}>
            {formatFileSize(maxSize())}
          </span>
        </div>
      </div>
    </div>
  )
}
