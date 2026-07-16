// Store-backed rail panels (upload + library) for the Karaoke Night page.
// This module owns every db/store dependency of the rail, so the page shell
// stays in the tiny first-paint chunk and this loads behind it (lazy()).
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { hydrateStemUrls } from '@/db/services/uvr-service'
import { initKaraokePlaylistStore } from '@/stores/karaoke-playlist-store'
import { completeUvrSession, getAllUvrSessionsReactive, getUvrSession, initGroupStore, initSessionStore, setErrorUvrSession, startUvrSession, } from '@/stores/uvr-store'
import { DEMO_SESSION_ID } from './demo-song'

export interface KaraokeSong {
  sessionId: string
  title: string
  stems: { vocal?: string; instrumental?: string }
}

interface KaraokeRailPanelsProps {
  onSing: (song: KaraokeSong) => void
}

export function KaraokeRailPanels(props: KaraokeRailPanelsProps) {
  const [uploadSessionId, setUploadSessionId] = createSignal<string | null>(
    null,
  )
  const [uploadError, setUploadError] = createSignal('')

  let fileInputRef: HTMLInputElement | undefined

  onMount(() => {
    void initSessionStore()
    void initGroupStore()
    // The stage's playlist sidebar reads this store; warm it here so it's
    // ready by the time a song opens.
    void initKaraokePlaylistStore()
  })

  const sessions = () => getAllUvrSessionsReactive()

  const librarySongs = createMemo(() =>
    sessions()
      .filter(
        (s) =>
          s.status === 'completed' &&
          s.sessionId !== DEMO_SESSION_ID &&
          (s.outputs !== undefined || s.stemMeta !== undefined),
      )
      .sort((a, b) => b.createdAt - a.createdAt),
  )

  const uploadSession = createMemo(() => {
    const id = uploadSessionId()
    if (id === null) return null
    return sessions().find((s) => s.sessionId === id) ?? null
  })

  const uploadBusy = () => {
    const s = uploadSession()
    return (
      s !== null &&
      (s.status === 'uploading' ||
        s.status === 'processing' ||
        s.status === 'finalizing')
    )
  }

  const singSession = async (sessionId: string) => {
    const s = getUvrSession(sessionId)
    if (s === undefined) return
    let outputs = s.outputs
    // Local sessions persist stems as db blobs; re-mint object URLs when the
    // in-memory ones died with a previous page load.
    if (
      (outputs?.vocal ?? '').startsWith('blob:') === false ||
      outputs === undefined
    ) {
      const urls = await hydrateStemUrls(sessionId)
      if (urls !== null && urls !== undefined) outputs = { ...outputs, ...urls }
    }
    if ((outputs?.vocal ?? '') === '' && (outputs?.instrumental ?? '') === '')
      return
    props.onSing({
      sessionId,
      title: s.originalFile?.name ?? 'Your song',
      stems: { vocal: outputs?.vocal, instrumental: outputs?.instrumental },
    })
  }

  const handleFile = async (file: File | undefined) => {
    if (file === undefined) return
    setUploadError('')
    const sessionId = startUvrSession(
      file.name,
      file.size,
      file.type,
      'separate',
      'local',
    )
    setUploadSessionId(sessionId)
    try {
      // Pipeline (and with it the ONNX separation stack) loads only when a
      // visitor actually uploads — never on page load.
      const pipeline = await import('@/lib/uvr-processing-pipeline')
      await pipeline.runUvrPipeline(file, sessionId, 'local', {
        onProgress: () => {
          // The pipeline writes progress onto the session record; the rail
          // reads it reactively from the store.
        },
        onComplete: async (result) => {
          await completeUvrSession(sessionId, result.outputs, result.stemMeta)
          void singSession(sessionId)
        },
        onError: (message) => {
          setErrorUvrSession(sessionId, message)
          setUploadError(message)
        },
      })
    } catch (err) {
      if (import.meta.env.DEV)
        console.warn('[KaraokeNight] separation failed:', err)
      const message =
        err instanceof Error ? err.message : 'Separation failed — try again.'
      setErrorUvrSession(sessionId, message)
      setUploadError(message)
    }
  }

  return (
    <>
      <section class="kn-card">
        <p class="kn-card-kicker">Your song</p>
        <h3>Add a song you own</h3>
        <p class="kn-card-sub">
          Vocals are removed on this device — free, nothing uploaded.
          Studio-quality separation lives in the app.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          class="kn-file-input"
          onChange={(e) => {
            void handleFile(e.currentTarget.files?.[0])
            e.currentTarget.value = ''
          }}
        />
        <button
          class="kn-btn"
          onClick={() => fileInputRef?.click()}
          disabled={uploadBusy()}
        >
          {uploadBusy() ? 'Separating…' : 'Choose a song'}
        </button>
        <Show when={uploadBusy()}>
          <div class="kn-progress">
            <div
              class="kn-progress-bar"
              style={{ width: `${uploadSession()?.progress ?? 0}%` }}
            />
          </div>
          <p class="kn-progress-note">
            {Math.round(uploadSession()?.progress ?? 0)}% — this runs in your
            browser and can take a few minutes.
          </p>
        </Show>
        <Show when={uploadError() !== ''}>
          <p class="kn-error">{uploadError()}</p>
        </Show>
      </section>

      <Show when={librarySongs().length > 0}>
        <section class="kn-card">
          <p class="kn-card-kicker">Your library</p>
          <ul class="kn-library">
            <For each={librarySongs()}>
              {(s) => (
                <li>
                  <button
                    class="kn-library-song"
                    onClick={() => void singSession(s.sessionId)}
                  >
                    {s.originalFile?.name ?? s.sessionId}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </>
  )
}
