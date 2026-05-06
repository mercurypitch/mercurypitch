// ============================================================
// LyricsUploader — file upload fallback for lyrics
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { FileText, FileUpload } from './icons'

export interface LyricsUploadResult {
  text: string
  format: 'txt' | 'lrc'
  filename: string
}

interface LyricsUploaderProps {
  onUpload: (result: LyricsUploadResult) => void
  suggestion?: string
  onDismiss?: () => void
}

export const LyricsUploader: Component<LyricsUploaderProps> = (props) => {
  const [dragOver, setDragOver] = createSignal(false)
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const readFile = (file: File) => {
    setError('')
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'txt' && ext !== 'lrc') {
      setError('Please upload a .txt or .lrc file')
      return
    }

    setLoading(true)
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      if (!text.trim()) {
        setError('The file appears to be empty')
        setLoading(false)
        return
      }
      setLoading(false)
      props.onUpload({
        text,
        format: ext as 'txt' | 'lrc',
        filename: file.name,
      })
    }
    reader.onerror = () => {
      setError('Failed to read file')
      setLoading(false)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) readFile(file)
  }

  const handleChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (file) readFile(file)
  }

  return (
    <div class="lu-root">
      <div class="lu-message">
        <FileText />
        <span class="lu-title">
          No lyrics found{props.suggestion ? ` for "${props.suggestion}"` : ''}
        </span>
        <span class="lu-hint">Upload a .txt or .lrc file to sync lyrics with playback</span>
      </div>

      <label
        class={`lu-dropzone${dragOver() ? ' lu-dropzone-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".txt,.lrc"
          onChange={handleChange}
          hidden
        />
        <Show
          when={!loading()}
          fallback={<span class="lu-loading">Reading file...</span>}
        >
          <div class="lu-dropzone-icon">
            <FileUpload />
          </div>
          <span class="lu-dropzone-label">Drop file here</span>
          <span class="lu-divider">or</span>
          <span class="lu-browse-btn">Browse files</span>
        </Show>
      </label>

      <Show when={error()}>
        <span class="lu-error">{error()}</span>
      </Show>

      <Show when={props.onDismiss}>
        <button class="lu-dismiss" onClick={props.onDismiss}>
          Skip for now
        </button>
      </Show>
    </div>
  )
}

// ============================================================
// CSS Styles
// ============================================================

export const LyricsUploaderStyles: string = `
.lu-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.75rem 0.5rem;
  width: 100%;
  box-sizing: border-box;
}

.lu-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-align: center;
  width: 100%;
}

.lu-message svg {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--fg-tertiary);
  margin-bottom: 0.15rem;
}

.lu-title {
  font-size: 0.72rem;
  color: var(--fg-secondary, #8b949e);
  font-weight: 500;
}

.lu-hint {
  font-size: 0.62rem;
  color: var(--fg-tertiary, #484f58);
}

.lu-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.25rem 1rem;
  border: 2px dashed var(--border, #30363d);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.lu-dropzone-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--bg-tertiary, #21262d);
}

.lu-dropzone-icon svg {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--fg-tertiary, #484f58);
}

.lu-dropzone-label {
  font-size: 0.65rem;
  color: var(--fg-secondary, #8b949e);
}

.lu-divider {
  font-size: 0.58rem;
  color: var(--fg-tertiary, #484f58);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lu-browse-btn {
  display: inline-block;
  padding: 0.35rem 1rem;
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--accent, #58a6ff);
  background: rgba(from var(--accent, #58a6ff) r g b / 0.08);
  border: 1px solid rgba(from var(--accent, #58a6ff) r g b / 0.2);
  border-radius: 0.35rem;
  transition: all 0.15s;
}

.lu-dropzone:hover,
.lu-dropzone-over {
  border-color: var(--accent, #58a6ff);
  background: rgba(from var(--accent, #58a6ff) r g b / 0.03);
}

.lu-dropzone:hover .lu-browse-btn,
.lu-dropzone-over .lu-browse-btn {
  background: rgba(from var(--accent, #58a6ff) r g b / 0.15);
  border-color: rgba(from var(--accent, #58a6ff) r g b / 0.4);
}

.lu-dropzone-over {
  background: rgba(from var(--accent, #58a6ff) r g b / 0.06);
}

.lu-loading {
  font-size: 0.65rem;
  color: var(--fg-tertiary, #484f58);
  padding: 0.15rem 0;
}

.lu-error {
  font-size: 0.62rem;
  color: var(--error, #f85149);
  text-align: center;
}

.lu-dismiss {
  background: none;
  border: none;
  color: var(--fg-tertiary, #484f58);
  font-size: 0.6rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.15s;
}

.lu-dismiss:hover {
  color: var(--fg-secondary, #8b949e);
  background: var(--bg-tertiary, #21262d);
}
`
