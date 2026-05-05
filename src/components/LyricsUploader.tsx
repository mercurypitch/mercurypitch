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
        <span>
          No lyrics found{props.suggestion ? ` for "${props.suggestion}"` : ''}
        </span>
        <span class="lu-hint">Upload a .txt or .lrc file</span>
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
          <FileUpload />
          <span>Drop .txt or .lrc file here</span>
          <span class="lu-or">or click to browse</span>
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
  gap: 0.5rem;
  padding: 0.75rem 0.5rem;
  width: 100%;
  box-sizing: border-box;
}

.lu-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  font-size: 0.7rem;
  color: var(--fg-secondary);
  text-align: center;
  width: 100%;
}

.lu-message svg {
  width: 1rem;
  height: 1rem;
  color: var(--fg-tertiary);
  margin-bottom: 0.1rem;
}

.lu-hint {
  font-size: 0.62rem;
  color: var(--fg-tertiary);
}

.lu-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem;
  border: 1.5px dashed var(--border);
  border-radius: 0.4rem;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.62rem;
  color: var(--fg-tertiary);
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.lu-dropzone svg {
  width: 0.85rem;
  height: 0.85rem;
  opacity: 0.6;
}

.lu-dropzone:hover,
.lu-dropzone-over {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(from var(--accent) r g b / 0.04);
}

.lu-dropzone-over {
  background: rgba(from var(--accent) r g b / 0.08);
}

.lu-or {
  font-size: 0.58rem;
  opacity: 0.7;
}

.lu-loading {
  font-size: 0.65rem;
  color: var(--fg-tertiary);
}

.lu-error {
  font-size: 0.62rem;
  color: var(--error);
}

.lu-dismiss {
  background: none;
  border: none;
  color: var(--fg-tertiary);
  font-size: 0.62rem;
  cursor: pointer;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
}

.lu-dismiss:hover {
  color: var(--fg-secondary);
  background: var(--bg-tertiary);
}
`
