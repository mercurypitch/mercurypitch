// ============================================================
// LyricsUploader — manual lyrics: drop a file, paste text, or open LRCLIB
// ============================================================
// The "add your own" half of the lyrics finder, shown beneath the LRCLIB
// search on every surface (studio panel + zen stage). `compact` drops the
// heading when the surrounding context already says "no synced lyrics".

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { FileText, FileUpload, MagnifyingGlass } from './icons'

export interface LyricsUploadResult {
  text: string
  format: 'txt' | 'lrc'
  filename: string
}

interface LyricsUploaderProps {
  onUpload: (result: LyricsUploadResult) => void
  suggestion?: string
  onDismiss?: () => void
  searchUrl?: string
  /** Hide the "No lyrics found" heading when the surface already frames it. */
  compact?: boolean
}

const isLrcText = (text: string): boolean =>
  /^\[\d{1,3}:\d{2}/.test(text.trim())

const safeBase = (suggestion: string | undefined, fallback: string): string =>
  suggestion != null && suggestion.trim() !== ''
    ? suggestion.replace(/[^a-zA-Z0-9_-]/g, '_')
    : fallback

export const LyricsUploader: Component<LyricsUploaderProps> = (props) => {
  const [dragOver, setDragOver] = createSignal(false)
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [showPasteArea, setShowPasteArea] = createSignal(false)
  const [pastedText, setPastedText] = createSignal('')

  const readFile = (file: File): void => {
    setError('')
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'txt' && ext !== 'lrc') {
      setError('That file type is not supported — drop a .txt or .lrc.')
      return
    }
    setLoading(true)
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      if (!text.trim()) {
        setError('That file looks empty.')
        setLoading(false)
        return
      }
      setLoading(false)
      props.onUpload({ text, format: ext, filename: file.name })
    }
    reader.onerror = () => {
      setError("Couldn't read that file. Try another.")
      setLoading(false)
    }
    reader.readAsText(file)
  }

  const submitText = (text: string): void => {
    const isLrc = isLrcText(text)
    props.onUpload({
      text,
      format: isLrc ? 'lrc' : 'txt',
      filename: `${safeBase(props.suggestion, 'pasted')}.${isLrc ? 'lrc' : 'txt'}`,
    })
  }

  const handlePasteSubmit = (): void => {
    setError('')
    const text = pastedText().trim()
    if (!text) {
      setError('Paste or type some lyrics first.')
      return
    }
    submitText(text)
  }

  // Try the clipboard directly; fall back to the textarea if the browser
  // blocks it (or there's nothing useful on the clipboard).
  const handlePasteChip = (): void => {
    // Read reactive props synchronously — the async clipboard callback below
    // isn't a tracked scope.
    const onUpload = props.onUpload
    const suggestion = props.suggestion
    navigator.clipboard
      .readText()
      .then((text) => {
        const trimmed = text.trim()
        if (trimmed.length === 0) {
          setShowPasteArea(true)
          return
        }
        const isLrc = isLrcText(trimmed)
        onUpload({
          text: trimmed,
          format: isLrc ? 'lrc' : 'txt',
          filename: `${safeBase(suggestion, 'pasted')}.${isLrc ? 'lrc' : 'txt'}`,
        })
      })
      .catch(() => setShowPasteArea(true))
  }

  const handlePasteFromClipboard = async (): Promise<void> => {
    try {
      setPastedText(await navigator.clipboard.readText())
    } catch {
      setError('Your browser blocked clipboard access — paste with Ctrl+V.')
    }
  }

  const handleDrop = (e: DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) readFile(file)
  }

  const handleChange = (e: Event): void => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (file) readFile(file)
  }

  return (
    <div
      class="lu-root"
      classList={{ 'lu-root--compact': props.compact === true }}
    >
      <Show when={props.compact !== true}>
        <div class="lu-message">
          <FileText />
          <span class="lu-title">
            No lyrics found
            {(props.suggestion ?? '') !== ''
              ? ` for "${props.suggestion}"`
              : ''}
          </span>
          <span class="lu-hint">Add your own to sing in time.</span>
        </div>
      </Show>

      <label
        class="lu-drop"
        classList={{ 'lu-drop--over': dragOver() }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input type="file" accept=".txt,.lrc" onChange={handleChange} hidden />
        <Show
          when={!loading()}
          fallback={<span class="lu-loading">Reading file…</span>}
        >
          <span class="lu-drop-icon">
            <FileUpload />
          </span>
          <span class="lu-drop-label">Drop a .lrc or .txt, or browse</span>
          <span class="lu-drop-hint">
            Timed .lrc syncs to the beat · .txt shows the words
          </span>
        </Show>
      </label>

      <Show
        when={!showPasteArea()}
        fallback={
          <div class="lu-paste-area">
            <div class="lu-paste-toolbar">
              <span class="lu-paste-title">Paste your lyrics</span>
              <button
                class="lu-paste-read"
                onClick={() => void handlePasteFromClipboard()}
                title="Read from clipboard"
              >
                Read clipboard
              </button>
            </div>
            <textarea
              class="lu-paste-textarea"
              placeholder="Paste or type the lyrics here…"
              value={pastedText()}
              onInput={(e) => setPastedText(e.currentTarget.value)}
              rows="6"
            />
            <div class="lu-paste-actions">
              <button
                class="lu-btn lu-btn--ghost"
                onClick={() => setShowPasteArea(false)}
              >
                Cancel
              </button>
              <button
                class="lu-btn lu-btn--primary"
                onClick={handlePasteSubmit}
              >
                Use these lyrics
              </button>
            </div>
          </div>
        }
      >
        <div class="lu-actions">
          <button
            class="lu-chip"
            onClick={handlePasteChip}
            title="Paste lyrics"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            </svg>
            Paste lyrics
          </button>
          <Show when={props.searchUrl}>
            <a
              class="lu-chip"
              href={props.searchUrl!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MagnifyingGlass />
              Open LRCLIB
            </a>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <span class="lu-error">{error()}</span>
      </Show>

      <Show when={props.onDismiss}>
        <button class="lu-skip" onClick={() => props.onDismiss?.()}>
          Skip for now
        </button>
      </Show>
    </div>
  )
}

// ============================================================
// CSS — glass, cohesive with the LRCLIB search picker (.sm-song-picker-*)
// ============================================================

export const LyricsUploaderStyles: string = `
.lu-root {
  --lyf-acc: var(--lyf-accent, var(--accent, #8b5cf6));
  --lyf-acc-rgb: var(--lyf-accent-rgb, 139, 92, 246);
  --lyf-surface: color-mix(in srgb, var(--fg-primary, #e6edf3) 6%, transparent);
  --lyf-surface-2: color-mix(in srgb, var(--fg-primary, #e6edf3) 11%, transparent);
  --lyf-border: color-mix(in srgb, var(--fg-primary, #e6edf3) 14%, transparent);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.6rem;
  width: 100%;
  box-sizing: border-box;
}

.lu-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  text-align: center;
}

.lu-message svg {
  width: 1.3rem;
  height: 1.3rem;
  color: var(--lyf-acc);
  margin-bottom: 0.1rem;
}

.lu-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary, #e6edf3);
}

.lu-hint {
  font-size: 0.75rem;
  color: var(--fg-tertiary, #6e7681);
}

.lu-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 1.35rem 1rem;
  text-align: center;
  border: 1.5px dashed var(--lyf-border);
  border-radius: 14px;
  background: var(--lyf-surface);
  cursor: pointer;
  box-sizing: border-box;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}

.lu-drop--over,
.lu-drop:hover {
  border-color: rgba(var(--lyf-acc-rgb), 0.55);
  background: rgba(var(--lyf-acc-rgb), 0.06);
}

.lu-drop-icon {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  background: rgba(var(--lyf-acc-rgb), 0.14);
  color: var(--lyf-acc);
}

.lu-drop-icon svg {
  width: 1.05rem;
  height: 1.05rem;
}

.lu-drop-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-primary, #e6edf3);
}

.lu-drop-hint {
  font-size: 0.72rem;
  color: var(--fg-tertiary, #6e7681);
}

.lu-loading {
  font-size: 0.85rem;
  color: var(--fg-secondary, #8b949e);
  padding: 0.6rem 0;
}

.lu-actions {
  display: flex;
  gap: 0.5rem;
}

.lu-chip {
  flex: 1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--fg-secondary, #8b949e);
  text-decoration: none;
  background: var(--lyf-surface);
  border: 1px solid var(--lyf-border);
  border-radius: 12px;
  cursor: pointer;
  transition:
    color 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease;
}

.lu-chip:hover {
  color: var(--lyf-acc);
  background: rgba(var(--lyf-acc-rgb), 0.08);
  border-color: rgba(var(--lyf-acc-rgb), 0.3);
}

.lu-chip svg {
  width: 0.95rem;
  height: 0.95rem;
  flex-shrink: 0;
}

.lu-paste-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.lu-paste-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lu-paste-title {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--fg-secondary, #8b949e);
}

.lu-paste-read {
  background: none;
  border: none;
  color: var(--lyf-acc);
  font-size: 0.78rem;
  font-family: inherit;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 8px;
  transition: background 0.16s ease;
}

.lu-paste-read:hover {
  background: rgba(var(--lyf-acc-rgb), 0.1);
}

.lu-paste-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 96px;
  padding: 0.65rem 0.75rem;
  background: var(--lyf-surface);
  border: 1px solid var(--lyf-border);
  border-radius: 12px;
  color: var(--fg-primary, #e6edf3);
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.lu-paste-textarea:focus {
  border-color: rgba(var(--lyf-acc-rgb), 0.7);
  box-shadow: 0 0 0 3px rgba(var(--lyf-acc-rgb), 0.18);
}

.lu-paste-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.lu-btn {
  min-height: 40px;
  padding: 0 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  font-family: inherit;
  border-radius: 12px;
  cursor: pointer;
  transition:
    filter 0.16s ease,
    color 0.16s ease,
    background 0.16s ease;
}

.lu-btn--ghost {
  color: var(--fg-secondary, #8b949e);
  background: var(--lyf-surface);
  border: 1px solid var(--lyf-border);
}

.lu-btn--ghost:hover {
  color: var(--fg-primary, #e6edf3);
  background: var(--lyf-surface-2);
}

.lu-btn--primary {
  color: #fff;
  background: var(--lyf-acc);
  border: 1px solid transparent;
}

.lu-btn--primary:hover {
  filter: brightness(1.08);
}

.lu-error {
  font-size: 0.75rem;
  color: var(--error, #f85149);
  text-align: center;
}

.lu-skip {
  align-self: center;
  background: none;
  border: none;
  color: var(--fg-tertiary, #6e7681);
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  transition: color 0.16s ease;
}

.lu-skip:hover {
  color: var(--fg-secondary, #8b949e);
}

@media (prefers-reduced-motion: reduce) {
  .lu-drop,
  .lu-chip,
  .lu-btn,
  .lu-paste-textarea,
  .lu-paste-read,
  .lu-skip {
    transition: none;
  }
}
`
