// Store-backed rail panels (upload + library) for the Karaoke Night page.
// This module owns every db/store dependency of the rail, so the page shell
// stays in the tiny first-paint chunk and this loads behind it (lazy()).
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import { ensureSessionHydrated } from '@/features/stem-mixer/karaoke-playlist-runner'
import { getPlaylistsReactive, initKaraokePlaylistStore, isPlaylistActive, startPlaylist, } from '@/stores/karaoke-playlist-store'
import { showNotification } from '@/stores/notifications-store'
import type { UvrProcessingMode } from '@/stores/uvr-store'
import { completeUvrSession, getAllUvrSessionsReactive, getUvrProcessingMode, getUvrSession, initGroupStore, initSessionStore, setErrorUvrSession, setUvrProcessingMode, startUvrSession, } from '@/stores/uvr-store'
import { DEMO_SESSION_ID } from './demo-song'
import { trackKaraoke } from './funnel'
import { credits, refreshCredits, signedIn } from './karaoke-account'

export interface KaraokeSong {
  sessionId: string
  title: string
  stems: { vocal?: string; instrumental?: string }
  /** Start playback as soon as the stems finish loading — set only for
   *  explicit user stagings (the demo button, a library/sheet pick);
   *  playlists run their own countdown flow and background auto-stagings
   *  must stay silent. */
  autoPlay?: boolean
}

interface KaraokeRailPanelsProps {
  onSing: (song: KaraokeSong) => void
  /** True while a song is already on stage — so a background separation that
   *  finishes doesn't yank the visitor off their current performance. */
  stageBusy: () => boolean
  /** Session currently on stage — accents its row in the library list. */
  activeSessionId: () => string | null
}

// Module scope on purpose: collapsing the rail unmounts this component, and
// component-local signals would drop a running separation's progress UI (the
// pipeline itself lives in the store and keeps going). Hoisted, the rail
// re-attaches to the in-flight upload when it comes back.
const [uploadSessionId, setUploadSessionId] = createSignal<string | null>(null)
const [uploadError, setUploadError] = createSignal('')
// Session currently being staged from a library pick (hydration can take a
// second or two) — shows a spinner on its row and locks out further picks.
// Module scope so a rail collapse mid-stage can't strand the lock UI state.
const [stagingSessionId, setStagingSessionId] = createSignal<string | null>(
  null,
)

export function KaraokeRailPanels(props: KaraokeRailPanelsProps) {
  const [mode, setMode] = createSignal<UvrProcessingMode>(
    getUvrProcessingMode(),
  )

  // Server mode is only usable with a signed-in account (billing) and credits.
  const serverReady = () => signedIn() && (credits() ?? 0) > 0
  const effectiveMode = (): UvrProcessingMode =>
    mode() === 'server' && serverReady() ? 'server' : 'local'

  const toggleMode = () => {
    if (!signedIn()) return
    const next: UvrProcessingMode = mode() === 'server' ? 'local' : 'server'
    setMode(next)
    setUvrProcessingMode(next) // shared pref — stays in sync with the studio
  }

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

  // autoPlay only for explicit picks (library click) — the auto-open after a
  // background separation must never start blasting audio unannounced.
  const singSession = async (sessionId: string, autoPlay = false) => {
    // One stage at a time: hydration takes a moment and rapid re-clicks
    // would race each other onto the stage.
    if (stagingSessionId() !== null) return
    setStagingSessionId(sessionId)
    try {
      const s = getUvrSession(sessionId)
      if (s === undefined) {
        showNotification('That song is no longer in your library.', 'warning')
        return
      }
      // Local sessions persist stems as db blobs; the stored object URLs die
      // with the page that minted them, so verify + re-mint before staging.
      const hydrated = await ensureSessionHydrated(s)
      const outputs = hydrated.outputs
      if (
        (outputs?.vocal ?? '') === '' &&
        (outputs?.instrumental ?? '') === ''
      ) {
        // A silent no-op here reads as a dead button — say why.
        showNotification(
          "This song's audio isn't on this device anymore — process it again to sing it.",
          'warning',
        )
        return
      }
      trackKaraoke('karaoke_song_staged')
      props.onSing({
        sessionId,
        title: s.originalFile?.name ?? 'Your song',
        stems: { vocal: outputs?.vocal, instrumental: outputs?.instrumental },
        autoPlay,
      })
    } finally {
      setStagingSessionId(null)
    }
  }

  const playPlaylist = (id: string) => {
    startPlaylist(id)
    if (isPlaylistActive()) {
      trackKaraoke('karaoke_playlist_start')
    } else {
      // startPlaylist no-ops when nothing in the playlist resolves to a
      // playable session on this device.
      showNotification('That playlist has no playable songs yet.', 'warning')
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (file === undefined) return
    setUploadError('')
    trackKaraoke('karaoke_upload_start')
    const runMode = effectiveMode()
    const sessionId = startUvrSession(
      file.name,
      file.size,
      file.type,
      'separate',
      runMode,
    )
    setUploadSessionId(sessionId)
    try {
      // Pipeline (and with it the ONNX separation stack, for local mode) loads
      // only when a visitor actually uploads — never on page load.
      const pipeline = await import('@/lib/uvr-processing-pipeline')
      await pipeline.runUvrPipeline(file, sessionId, runMode, {
        onProgress: () => {
          // The pipeline writes progress onto the session record; the rail
          // reads it reactively from the store.
        },
        onComplete: async (result) => {
          await completeUvrSession(sessionId, result.outputs, result.stemMeta)
          trackKaraoke('karaoke_upload_done')
          // Server separations debit credits server-side — refresh the balance.
          if (runMode === 'server') void refreshCredits()
          // Auto-open the finished song only when the stage is idle. If the
          // visitor is mid-performance (demo or another song), it just lands
          // in "Your library" for them to pick when they're ready — never
          // interrupts a take.
          if (!props.stageBusy()) void singSession(sessionId)
        },
        onError: (message) => {
          trackKaraoke('karaoke_upload_error')
          setErrorUvrSession(sessionId, message)
          setUploadError(message)
          if (runMode === 'server') void refreshCredits()
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
          Your song
          <Show
            when={signedIn()}
            fallback={<span class="kn-chip">On this device</span>}
          >
            {/* Label + styling follow the STORED choice, and the chip stays
                clickable in every state — out of credits used to both show
                the effective fallback ("On this device") AND disable the
                chip, trapping the user the warning told to "switch back". */}
            <button
              class="kn-chip kn-chip--toggle"
              classList={{ 'kn-chip--server': mode() === 'server' }}
              onClick={toggleMode}
              title="Switch between on-device and studio-quality separation"
            >
              {mode() === 'server' ? 'Studio quality' : 'On this device'}
            </button>
          </Show>
        </p>
        <h3>Add a song you own</h3>
        <Show
          when={effectiveMode() === 'server'}
          fallback={
            <p class="kn-card-sub">
              All data stays on your device. Higher-quality separation is
              available as a paid option
              {signedIn() ? '' : ' — sign in to use it'}.
            </p>
          }
        >
          <p class="kn-card-sub">
            Studio-quality separation — the cleanest vocal lift.
            <Show when={credits() !== null}>
              {' '}
              <strong>{credits()} credits</strong> left · 1 credit per song.
            </Show>
          </p>
        </Show>
        <Show when={mode() === 'server' && signedIn() && !serverReady()}>
          <p class="kn-progress-warn">
            You're out of credits. <a href="/#/settings/credits">Get credits</a>{' '}
            to use studio separation, or switch back to on-device.
          </p>
        </Show>
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
              when={effectiveMode() === 'server'}
              fallback={
                <Show
                  when={(uploadSession()?.progress ?? 0) > 0}
                  fallback="Warming up the separator — the first run downloads its model…"
                >
                  {Math.round(uploadSession()?.progress ?? 0)}% — separating on
                  this device.
                </Show>
              }
            >
              <Show
                when={uploadSession()?.phase === 'queued'}
                fallback={`${Math.round(uploadSession()?.progress ?? 0)}% — separating in studio quality.`}
              >
                Warming up the studio — your song starts in a moment…
              </Show>
            </Show>
          </p>
          <Show when={effectiveMode() !== 'server'}>
            <p class="kn-progress-warn">
              Separation is an intensive workload — for smooth karaoke, let it
              finish before you sing.
            </p>
          </Show>
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
          <p class="kn-card-kicker">
            Your library
            <span class="kn-count-pill">{librarySongs().length}</span>
          </p>
          <ul class="kn-library">
            <For each={librarySongs()}>
              {(s) => (
                <li>
                  <button
                    class="kn-library-song"
                    classList={{
                      'kn-library-song--active':
                        props.activeSessionId() === s.sessionId,
                      'kn-library-song--staging':
                        stagingSessionId() === s.sessionId,
                    }}
                    disabled={stagingSessionId() !== null}
                    onClick={() => void singSession(s.sessionId, true)}
                    title={
                      stagingSessionId() === s.sessionId
                        ? 'Loading this song…'
                        : props.activeSessionId() === s.sessionId
                          ? 'On stage now'
                          : 'Sing this song'
                    }
                  >
                    <Show when={stagingSessionId() === s.sessionId}>
                      <span class="kn-song-spinner" aria-hidden="true" />
                    </Show>
                    <Show
                      when={
                        props.activeSessionId() === s.sessionId &&
                        stagingSessionId() !== s.sessionId
                      }
                    >
                      <span class="kn-eq" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </Show>
                    <span class="kn-library-title">
                      {s.originalFile?.name ?? s.sessionId}
                    </span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <Show when={getPlaylistsReactive().length > 0}>
        <section class="kn-card">
          <p class="kn-card-kicker">Your playlists</p>
          <ul class="kn-library">
            <For each={getPlaylistsReactive()}>
              {(p) => (
                <li>
                  <button
                    class="kn-library-song kn-playlist-row"
                    onClick={() => playPlaylist(p.id)}
                    title={`Start "${p.name}"`}
                  >
                    <svg
                      class="kn-playlist-play"
                      viewBox="0 0 24 24"
                      width="13"
                      height="13"
                      aria-hidden="true"
                    >
                      <path fill="currentColor" d="M8 5v14l11-7z" />
                    </svg>
                    <span class="kn-playlist-name">{p.name}</span>
                    <span class="kn-playlist-count">
                      {p.items.length}{' '}
                      {p.items.some((i) => i.kind === 'group')
                        ? 'entries'
                        : p.items.length === 1
                          ? 'song'
                          : 'songs'}
                    </span>
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
