// Store-backed rail panels (upload + library) for the Karaoke Night page.
// This module owns every db/store dependency of the rail, so the page shell
// stays in the tiny first-paint chunk and this loads behind it (lazy()).
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { ensureSessionHydrated } from '@/features/stem-mixer/karaoke-playlist-runner'
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

  // Local runs never leave status 'idle' until they finalize (the studio's
  // processing screen is view-state-driven, not status-driven) — so "busy"
  // here means "our session exists and hasn't reached a terminal state".
  const uploadBusy = () => {
    const s = uploadSession()
    return (
      s !== null &&
      s.status !== 'completed' &&
      s.status !== 'error' &&
      s.status !== 'cancelled' &&
      s.status !== 'interrupted'
    )
  }

  const cancelUpload = async () => {
    const id = uploadSessionId()
    if (id === null) return
    const pipeline = await import('@/lib/uvr-processing-pipeline')
    pipeline.cancelUvrPipeline('local')
    setErrorUvrSession(id, 'Cancelled')
    setUploadSessionId(null)
  }

  const singSession = async (sessionId: string) => {
    const s = getUvrSession(sessionId)
    if (s === undefined) return
    // Local sessions persist stems as db blobs; the stored object URLs die
    // with the page that minted them, so verify + re-mint before staging.
    const hydrated = await ensureSessionHydrated(s)
    const outputs = hydrated.outputs
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
        <p class="kn-card-kicker">
          Your song <span class="kn-chip">On this device</span>
        </p>
        <h3>Add a song you own</h3>
        <p class="kn-card-sub">
          All data stays on your device. Higher-quality separation is available
          as a paid option in the app.
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
          <div
            class="kn-progress"
            classList={{
              'kn-progress--indeterminate':
                (uploadSession()?.progress ?? 0) === 0,
            }}
          >
            <div
              class="kn-progress-bar"
              style={{
                width: `${Math.max(4, uploadSession()?.progress ?? 0)}%`,
              }}
            />
          </div>
          <p class="kn-progress-note">
            <Show
              when={(uploadSession()?.progress ?? 0) > 0}
              fallback="Warming up the separator — the first run downloads its model…"
            >
              {Math.round(uploadSession()?.progress ?? 0)}% — separating on this
              device.
            </Show>
          </p>
          <p class="kn-progress-warn">
            Separation is an intensive workload — for smooth karaoke, let it
            finish before you sing.
          </p>
          <button class="kn-cancel" onClick={() => void cancelUpload()}>
            Cancel
          </button>
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
