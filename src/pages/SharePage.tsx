// ============================================================
// SharePage — Public share URL handler
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import type { SharedMelody, SharedSession } from '@/components/CommunityShare'
import { IconAlertTriangle, IconArrowLeft, IconBooks, IconDownload, IconLink, IconMusicNote, } from '@/components/hidden-features-icons'
import type { MelodyItem } from '@/types'

export const SharePage: Component = () => {
  const [contentType, setContentType] = createSignal<string>('')
  const [content, setContent] = createSignal<
    SharedMelody | SharedSession | null
  >(null)
  const [error, setError] = createSignal<string>('')

  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type')
    const id = params.get('id')

    if (type === null || id === null) {
      setError('Invalid share link. Please use a valid link.')
      return
    }

    setContentType(type)
    loadSharedContent(type, id)
  })

  const loadSharedContent = (type: string, id: string) => {
    try {
      const storedKey = `pp_shared_${type === 'melody' ? 'melodies' : 'sessions'}`
      const stored = localStorage.getItem(storedKey)
      if (stored === null) {
        setError(
          `Content not found. It may have been removed or never existed.`,
        )
        return
      }

      const allContent = JSON.parse(stored)
      const found = allContent.find((item: { id: string }) => item.id === id)

      if (found === undefined) {
        setError(`Content not found. ID: ${id}`)
        return
      }

      setContent(found)
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
            <span class="error-icon">
              <IconAlertTriangle />
            </span>
            <h2>Share Link Not Found</h2>
            <p>{error()}</p>
            <button
              class="back-btn"
              onClick={() => (window.location.href = '/')}
            >
              <IconArrowLeft /> Back to Home
            </button>
          </div>
        </Show>

        <Show when={contentType() === 'melody' && content()}>
          <MelodyShareContent
            content={content() as SharedMelody}
            onShare={shareContent}
          />
        </Show>

        <Show when={contentType() === 'session' && content()}>
          <SessionShareContent
            content={content() as SharedSession}
            onShare={shareContent}
          />
        </Show>

        <Show when={error() === '' && content() === null}>
          <div class="loading-state">
            <div class="spinner" />
            <p>Loading props.content...</p>
          </div>
        </Show>
      </div>
    </div>
  )
}

// ============================================================
// Melody Share Content Component
// ============================================================

interface MelodyShareProps {
  content: SharedMelody
  onShare: (type: 'melody' | 'session', id: string) => void
}

const MelodyShareContent: Component<MelodyShareProps> = (props) => {
  const notes = createMemo(() =>
    props.content.items
      .filter(
        (item: MelodyItem) => item.isRest !== true && item.note !== undefined,
      )
      .map((item: MelodyItem) => {
        const note = item.note
        return {
          midi: note.midi,
          noteName: note.name,
          octave: note.octave,
          freq: note.freq,
          duration: item.duration,
        }
      }),
  )

  return (
    <div class="share-content">
      <div class="share-header">
        <h1>
          <span class="share-header-icon">
            <IconMusicNote />
          </span>
          {props.content.name}
        </h1>
        <p class="share-subtitle">Shared by {props.content.author}</p>
      </div>

      <div class="share-body">
        <div class="info-section">
          <h3>Melody Details</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Notes</span>
              <span class="info-value">{notes().length}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Duration</span>
              <span class="info-value">
                {notes().reduce(
                  (a: number, b: { duration: number }) => a + b.duration,
                  0,
                )}{' '}
                beats
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Author</span>
              <span class="info-value">{props.content.author}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Shared</span>
              <span class="info-value">
                {new Date(props.content.date).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <Show
          when={
            props.content.tags !== undefined && props.content.tags.length > 0
          }
        >
          <div class="tags-section">
            <h3>Tags</h3>
            <div class="tags-container">
              <For each={props.content.tags}>
                {(tag: string) => <span class="tag">{tag}</span>}
              </For>
            </div>
          </div>
        </Show>

        <div class="notes-section">
          <h3>Melody Notes</h3>
          <div class="notes-grid">
            <div class="notes-header">
              <span class="note-column">Note</span>
              <span class="note-column">MIDI</span>
              <span class="note-column">Frequency (Hz)</span>
            </div>
            <For each={notes()}>
              {(
                n: {
                  midi: number
                  noteName: string
                  octave: number
                  freq: number
                  duration: number
                },
                _i,
              ) => (
                <div class="note-row">
                  <span class="note-column">
                    {n.noteName}
                    {n.octave}
                  </span>
                  <span class="note-column">{n.midi}</span>
                  <span class="note-column">{n.freq.toFixed(2)}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      <div class="share-footer">
        <button
          class="share-btn"
          onClick={() => props.onShare('melody', props.content.id)}
        >
          <IconLink /> Share Again
        </button>
        <button
          class="load-btn"
          onClick={() => (window.location.href = '/')}
          loaded-type="melody"
          data-melody-id={props.content.id}
        >
          <IconDownload /> Load in App
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Session Share Content Component
// ============================================================

interface SessionShareProps {
  content: SharedSession
  onShare: (type: 'melody' | 'session', id: string) => void
}

const SessionShareContent: Component<SessionShareProps> = (props) => {
  return (
    <div class="share-content">
      <div class="share-header">
        <h1>
          <span class="share-header-icon">
            <IconBooks />
          </span>
          {props.content.name}
        </h1>
        <p class="share-subtitle">Shared by {props.content.author}</p>
      </div>

      <div class="share-body">
        <div class="info-section">
          <h3>Session Results</h3>
          <div class="results-list">
            <For each={props.content.results}>
              {(score: number, i) => (
                <div class="result-item">
                  <span class="result-index">Run {i() + 1}</span>
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
              )}
            </For>
          </div>

          {props.content.results.length > 0 && (
            <div class="stats-row">
              <div class="stat-item">
                <span class="stat-label">Total Runs</span>
                <span class="stat-value">{props.content.results.length}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Average</span>
                <span class="stat-value">
                  {Math.round(
                    props.content.results.reduce(
                      (a: number, b: number) => a + b,
                      0,
                    ) / props.content.results.length,
                  )}
                  %
                </span>
              </div>
            </div>
          )}
        </div>

        <div class="details-section">
          <h3>Session Details</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Shared by</span>
              <span class="info-value">{props.content.author}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Shared on</span>
              <span class="info-value">
                {new Date(props.content.date).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="share-footer">
        <button
          class="share-btn"
          onClick={() => props.onShare('session', props.content.id)}
        >
          <IconLink /> Share Again
        </button>
        <button
          class="load-btn"
          onClick={() => (window.location.href = '/')}
          loaded-type="session"
          data-session-id={props.content.id}
        >
          <IconDownload /> Load in App
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
