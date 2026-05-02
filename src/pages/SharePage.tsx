// ============================================================
// SharePage — Public share URL handler
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import type { SharedMelody, SharedSession } from '@/components/CommunityShare'
import type { MelodyItem } from '@/types'

export const SharePage: Component = () => {
  const [contentType, setContentType] = createSignal<string>('')
  const [_contentId, setContentId] = createSignal<string>('')
  const [content, setContent] = createSignal<SharedMelody | SharedSession | null>(null)
  const [error, setError] = createSignal<string>('')

  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type') ?? ''
    const id = params.get('id') ?? ''

    if (type === '' || id === '') {
      setError('Invalid share link. Please use a valid link.')
      return
    }

    setContentType(type)
    setContentId(id)
    loadSharedContent(type, id)
  })

  const loadSharedContent = (type: string, id: string) => {
    try {
      const storedKey = `pp_shared_${type === 'melody' ? 'melodies' : 'sessions'}`
      const stored = localStorage.getItem(storedKey) ?? '[]'
      const allContent: { id: string; name?: string; items?: MelodyItem[]; results?: number[]; author?: string; date?: string; tags?: string[] }[] = JSON.parse(stored)
      const found = allContent.find((item) => item.id === id)

      if (!found) {
        setError(`Content not found. ID: ${id}`)
        return
      }

      // Type assertion based on the stored key
      const content = type === 'melody'
        ? { ...found, items: found.items || [] } as unknown as SharedMelody
        : { ...found, results: found.results || [] } as unknown as SharedSession

      setContent(content)
    } catch (err) {
      setError('Failed to load content. Please try again later.')
      console.error('Share page error:', err)
    }
  }

  const shareContent = (type: 'melody' | 'session', id: string) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/share?type=${type}&id=${id}`
    navigator.clipboard.writeText(link)
    alert('Share link copied to clipboard!')
  }

  return (
    <div class="share-page">
      <div class="share-container">
        <Show when={error()}>
          <div class="error-state">
            <span class="error-icon">⚠️</span>
            <h2>Share Link Not Found</h2>
            <p>{error()}</p>
            <button class="back-btn" onClick={() => window.location.href = '/'}>
              ← Back to Home
            </button>
          </div>
        </Show>

        <Show when={contentType() === 'melody' && content() !== null}>
          <MelodyShareContent content={content()!} onShare={shareContent} />
        </Show>

        <Show when={contentType() === 'session' && content() !== null}>
          <SessionShareContent content={content()!} onShare={shareContent} />
        </Show>

        <Show when={!error() && !content()}>
          <div class="loading-state">
            <div class="spinner" />
            <p>Loading content...</p>
          </div>
        </Show>
      </div>
    </div>
  )
}

// ============================================================
// Melody Share Content Component
// ============================================================

const MelodyShareContent: Component<{
  content: SharedMelody | SharedSession
  onShare: (type: 'melody' | 'session', id: string) => void
}> = (props) => {
  const { content, onShare } = props

  const melodyContent = content as SharedMelody

  function isMelodyItem(item: MelodyItem): boolean {
    return (item.isRest ?? false) === false && item.note !== null
  }

  const melodyItems = melodyContent.items?.filter(isMelodyItem) ?? []

  const notes: Array<{
    midi: number
    noteName: string
    octave: number
    freq: number
    duration: number
  }> = melodyItems.map((item: MelodyItem) => ({
    midi: item.note.midi ?? 0,
    noteName: item.note.name ?? '',
    octave: item.note.octave ?? 0,
    freq: item.note.freq ?? 0,
    duration: item.duration ?? 0,
  }))

  return (
    <div class="share-content">
      <div class="share-header">
        <h1>🎵 {content.name}</h1>
        <p class="share-subtitle">Shared by {content.author}</p>
      </div>

      <div class="share-body">
        <div class="info-section">
          <h3>Melody Details</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Notes</span>
              <span class="info-value">{notes.length}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Duration</span>
              <span class="info-value">{notes.reduce((a: number, b) => a + b.duration, 0)} beats</span>
            </div>
            <div class="info-item">
              <span class="info-label">Author</span>
              <span class="info-value">{content.author}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Shared</span>
              <span class="info-value">
                {content.date ? new Date(content.date).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {(melodyContent.tags && Array.isArray(melodyContent.tags) && melodyContent.tags.length > 0) && (
          <div class="tags-section">
            <h3>Tags</h3>
            <div class="tags-container">
              <For each={melodyContent.tags}>{(tag: string) => (
                <span class="tag">{tag}</span>
              )}</For>
            </div>
          </div>
        )}

        <div class="notes-section">
          <h3>Melody Notes</h3>
          <div class="notes-grid">
            <div class="notes-header">
              <span class="note-column">Note</span>
              <span class="note-column">MIDI</span>
              <span class="note-column">Frequency (Hz)</span>
            </div>
            <For each={notes}>
              {(n) => (
                <div class="note-row">
                  <span class="note-column">{n.noteName}{n.octave}</span>
                  <span class="note-column">{n.midi}</span>
                  <span class="note-column">{n.freq.toFixed(2)}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="share-footer">
        <button class="share-btn" onClick={() => onShare('melody', content.id)}>
          <span>🔗</span> Share Again
        </button>
        <button class="load-btn" onClick={() => window.location.href = '/'} loaded-type="melody" data-melody-id={content.id}>
          <span>📥</span> Load in App
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Session Share Content Component
// ============================================================

const SessionShareContent: Component<{
  content: SharedMelody | SharedSession
  onShare: (type: 'melody' | 'session', id: string) => void
}> = (props) => {
  const { content, onShare } = props

  const sessionContent = content as SharedSession

  const hasValidResults = () => sessionContent.results !== null && Array.isArray(sessionContent.results) && sessionContent.results.length > 0

  return (
    <div class="share-content">
      <div class="share-header">
        <h1>📚 {content.name}</h1>
        <p class="share-subtitle">Shared by {content.author}</p>
      </div>

      <div class="share-body">
        <div class="info-section">
          <h3>Session Results</h3>
          <Show when={hasValidResults()}>
            <>
              <div class="results-list">
                <For each={sessionContent.results}>{(score: number) => (
                  <div class="result-item">
                    <span class="result-index">Run {score + 1}</span>
                    <span
                      class="result-score"
                      style={{
                        '--score': score,
                        '--score-color': getScoreColor(score),
                      }}
                    >
                      {score}%
                    </span>
                  </div>
                )}</For>
              </div>
              <div class="stats-row">
                <div class="stat-item">
                  <span class="stat-label">Total Runs</span>
                  <span class="stat-value">{sessionContent.results.length}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Average</span>
                  <span class="stat-value">
                    {Math.round(
                      sessionContent.results.reduce((a: number, b: number) => a + b, 0) / sessionContent.results.length
                    )}%
                  </span>
                </div>
              </div>
            </>
          </Show>
        </div>

        <div class="details-section">
          <h3>Session Details</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Shared by</span>
              <span class="info-value">{content.author}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Shared on</span>
              <span class="info-value">
                {new Date(content.date).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="share-footer">
        <button class="share-btn" onClick={() => onShare('session', content.id)}>
          <span>🔗</span> Share Again
        </button>
        <button class="load-btn" onClick={() => window.location.href = '/'} loaded-type="session" data-session-id={content.id}>
          <span>📥</span> Load in App
        </button>
      </div>
    </div>
  )
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'var(--green)'
  if (score >= 75) return 'var(--accent)'
  if (score >= 60) return 'var(--teal)'
  return 'var(--yellow)'
}
