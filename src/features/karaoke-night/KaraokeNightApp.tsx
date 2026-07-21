import { createSignal, lazy, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import { Notifications } from '@/components/Notifications'
import { studioSessionUrl } from '@/lib/karaoke-night-link'
import { karaokeFocus, setKaraokeFocus } from '@/stores/ui-store'
import type { DemoSongManifest } from './demo-song'
import { DEMO_SESSION_ID, demoIsPlayable, loadDemoSong, seedDemoLyrics, } from './demo-song'
import { trackKaraoke } from './funnel'
import type { KaraokeSong } from './KaraokeRailPanels'

// Everything store/db-backed stays out of the first-paint chunk: the rail
// panels stream in right after mount, the stage host (mixer + playlist
// runner + their styles) only when a song opens.
const KaraokeRailPanels = lazy(async () => {
  const m = await import('./KaraokeRailPanels')
  return { default: m.KaraokeRailPanels }
})

const KaraokeStageHost = lazy(async () => {
  const m = await import('./KaraokeStageHost')
  return { default: m.KaraokeStageHost }
})

// Always-mounted runtime: the playlist runner + the studio's ?playlist=
// deep-link consumer. Lazy like the rail, so first paint stays tiny.
const KaraokeNightRuntime = lazy(async () => {
  const m = await import('./KaraokeNightRuntime')
  return { default: m.KaraokeNightRuntime }
})

// The account chip pulls the auth/billing services + toast host — kept lazy so
// first paint (the ad LCP) stays tiny; it streams into the topbar.
const KaraokeAccount = lazy(async () => {
  const m = await import('./KaraokeAccount')
  return { default: m.KaraokeAccount }
})

const ALPHA_KEY = 'pitchperfect_kn_stage_alpha'
const RAIL_KEY = 'pitchperfect_kn_rail_collapsed'

function loadStageAlpha(): number {
  try {
    const v = Number(localStorage.getItem(ALPHA_KEY))
    if (v >= 0.05 && v <= 1) return v
  } catch {
    /* localStorage unavailable */
  }
  // Middle of the atmospheric range — clearly glassy, still readable.
  return 0.45
}

function loadRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === 'true'
  } catch {
    return false
  }
}

export function KaraokeNightApp() {
  const [manifest, setManifest] = createSignal<DemoSongManifest | null>(null)
  const [activeSong, setActiveSong] = createSignal<KaraokeSong | null>(null)
  const [stageAlpha, setStageAlpha] = createSignal(loadStageAlpha())
  const [railCollapsed, setRailCollapsed] = createSignal(loadRailCollapsed())

  const updateAlpha = (v: number) => {
    setStageAlpha(v)
    try {
      localStorage.setItem(ALPHA_KEY, String(v))
    } catch {
      /* localStorage unavailable */
    }
  }

  const updateRail = (collapsed: boolean) => {
    setRailCollapsed(collapsed)
    try {
      localStorage.setItem(RAIL_KEY, String(collapsed))
    } catch {
      /* localStorage unavailable */
    }
  }

  const updateSessionUrl = (sessionId: string | null, push = true) => {
    try {
      const currentParams = new URLSearchParams(window.location.search)
      const currentSession = currentParams.get('session')
      const targetSession = sessionId ?? null
      if (currentSession !== targetSession) {
        if (targetSession !== null) {
          currentParams.set('session', targetSession)
        } else {
          currentParams.delete('session')
        }
        const searchStr = currentParams.toString()
        const newUrl = `${window.location.pathname}${searchStr !== '' ? `?${searchStr}` : ''}${window.location.hash}`
        if (push) {
          window.history.pushState({ session: targetSession }, '', newUrl)
        } else {
          window.history.replaceState({ session: targetSession }, '', newUrl)
        }
      }
    } catch {
      /* history state unavailable */
    }
  }

  const setSongWithUrl = (song: KaraokeSong | null, push = true) => {
    setActiveSong(song)
    updateSessionUrl(song?.sessionId ?? null, push)
  }

  const restoreFromUrl = async (
    sessionId: string | null,
    providedManifest?: DemoSongManifest | null,
  ) => {
    if (sessionId === null || sessionId === '') {
      setActiveSong(null)
      return
    }
    if (sessionId === DEMO_SESSION_ID) {
      const m = providedManifest ?? (await loadDemoSong())
      if (m !== null) setManifest(m)
      if (demoIsPlayable(m)) {
        const demoSong = m as DemoSongManifest
        await seedDemoLyrics(demoSong)
        setActiveSong({
          sessionId: DEMO_SESSION_ID,
          title: `${demoSong.title} — ${demoSong.artist}`,
          stems: demoSong.stems,
          autoPlay: false,
        })
      }
      return
    }

    try {
      const { initSessionStore, getUvrSession } =
        await import('@/stores/uvr-store')
      const { ensureSessionHydrated } =
        await import('@/features/stem-mixer/karaoke-playlist-runner')
      await initSessionStore()
      const s = getUvrSession(sessionId)
      if (!s) {
        updateSessionUrl(null, false)
        return
      }
      const hydrated = await ensureSessionHydrated(s)
      const outputs = hydrated.outputs
      if (
        (outputs?.vocal ?? '') !== '' ||
        (outputs?.instrumental ?? '') !== ''
      ) {
        setActiveSong({
          sessionId,
          title: s.originalFile?.name ?? 'Your song',
          stems: {
            vocal: outputs?.vocal,
            instrumental: outputs?.instrumental,
          },
          autoPlay: false,
        })
      } else {
        updateSessionUrl(null, false)
      }
    } catch {
      updateSessionUrl(null, false)
    }
  }

  onMount(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const initialSession = searchParams.get('session')

    void loadDemoSong().then((m) => {
      setManifest(m)
      if (initialSession === DEMO_SESSION_ID) {
        void restoreFromUrl(DEMO_SESSION_ID, m)
      }
    })

    if (
      initialSession !== null &&
      initialSession !== '' &&
      initialSession !== DEMO_SESSION_ID
    ) {
      void restoreFromUrl(initialSession)
    }

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const sessionInUrl = params.get('session')
      if (sessionInUrl !== (activeSong()?.sessionId ?? null)) {
        void restoreFromUrl(sessionInUrl)
      }
    }

    window.addEventListener('popstate', handlePopState)
    onCleanup(() => window.removeEventListener('popstate', handlePopState))
  })

  const singDemo = () => {
    const m = manifest()
    if (!demoIsPlayable(m)) return
    trackKaraoke('karaoke_demo_start')
    const md = m as DemoSongManifest
    void (async () => {
      // The stage's lyrics controller reads the db on mount and starts an
      // online search when it finds nothing — so the seed must land first.
      await seedDemoLyrics(md)
      setSongWithUrl(
        {
          sessionId: DEMO_SESSION_ID,
          title: `${md.title} — ${md.artist}`,
          stems: md.stems,
          autoPlay: true,
        },
        true,
      )
    })()
  }

  const attribution = () => manifest()?.attribution

  return (
    <div class="kn-app" style={{ '--kn-alpha': String(stageAlpha()) }}>
      <header class="kn-topbar">
        <a class="kn-brand" href="/">
          MercuryPitch
        </a>
        <span class="kn-topbar-title">Karaoke Night</span>
        <nav class="kn-topbar-links">
          <Show when={activeSong()}>
            <label class="kn-glass" title="Stage transparency">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2v16a8 8 0 0 1 0-16z"
                />
              </svg>
              <input
                type="range"
                class="kn-glass-slider"
                min="0.05"
                max="1"
                step="0.02"
                value={stageAlpha()}
                onInput={(e) => updateAlpha(Number(e.currentTarget.value))}
              />
            </label>
            <button
              class="kn-focus-toggle"
              classList={{ 'kn-focus-toggle--active': karaokeFocus() }}
              title="Focus mode — just the stage and a floating control bar (Esc exits)"
              aria-label="Toggle focus mode"
              aria-pressed={karaokeFocus()}
              onClick={() => setKaraokeFocus((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M15 3h6v6" />
                <path d="M9 21H3v-6" />
                <path d="M21 3l-7 7" />
                <path d="M3 21l7-7" />
              </svg>
            </button>
          </Show>
          <a
            href={studioSessionUrl(
              // The demo/opener isn't a real library session, so a session
              // deep-link would open an empty studio. Send it to the studio
              // home instead.
              activeSong()?.sessionId === DEMO_SESSION_ID
                ? null
                : activeSong()?.sessionId,
            )}
            onClick={() => trackKaraoke('karaoke_cta_studio')}
          >
            Open the studio
          </a>
          <Suspense>
            <KaraokeAccount />
          </Suspense>
        </nav>
      </header>

      <div
        class="kn-body"
        classList={{
          'kn-body--staged': activeSong() !== null,
          'kn-body--rail-min': railCollapsed(),
        }}
      >
        <aside class="kn-rail" classList={{ 'kn-rail--min': railCollapsed() }}>
          <Show
            when={!railCollapsed()}
            fallback={
              <div class="kn-rail-icons">
                {/* Phones collapse to a single hamburger (see the media query);
                    the icon strip below is the desktop affordance. */}
                <button
                  class="kn-rail-burger"
                  title="Open the panel"
                  aria-label="Open the panel"
                  onClick={() => updateRail(false)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  class="kn-rail-icon"
                  title="Expand the panel"
                  onClick={() => updateRail(false)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M9 6l6 6-6 6V6z" />
                  </svg>
                </button>
                <button
                  class="kn-rail-icon"
                  title="Tonight's opener"
                  onClick={() => updateRail(false)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"
                    />
                  </svg>
                </button>
                <button
                  class="kn-rail-icon"
                  title="Add a song you own"
                  onClick={() => updateRail(false)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M12 3l5 5h-3v6h-4V8H7l5-5zM5 19h14v2H5v-2z"
                    />
                  </svg>
                </button>
                <button
                  class="kn-rail-icon"
                  title="Your library"
                  onClick={() => updateRail(false)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"
                    />
                  </svg>
                </button>
              </div>
            }
          >
            <button
              class="kn-rail-collapse"
              title="Collapse the panel"
              onClick={() => updateRail(true)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M15 6l-6 6 6 6V6z" />
              </svg>
              Hide panel
            </button>
            <section class="kn-card kn-card--demo">
              <p class="kn-card-kicker">Tonight's opener</p>
              <h2>{manifest()?.title ?? "Tonight's opener"}</h2>
              <p class="kn-card-sub">{manifest()?.artist ?? ''}</p>
              <Show
                when={demoIsPlayable(manifest())}
                fallback={<p class="kn-soon">Opener coming soon</p>}
              >
                <button
                  class="kn-btn kn-btn--primary"
                  onClick={singDemo}
                  disabled={activeSong()?.sessionId === DEMO_SESSION_ID}
                >
                  Sing this song
                </button>
              </Show>
            </section>

            <Suspense>
              <KaraokeRailPanels
                onSing={(s) => setSongWithUrl(s, true)}
                stageBusy={() => activeSong() !== null}
                activeSessionId={() => activeSong()?.sessionId ?? null}
              />
            </Suspense>
          </Show>
        </aside>

        <main class="kn-stage">
          <Show
            when={activeSong()}
            keyed
            fallback={
              <div class="kn-hero">
                <h1>Your stage is set</h1>
                <p>
                  Start with our ready-to-sing song, or add one you own — the
                  vocals lift away, the lyrics light up line by line, and every
                  note you sing is scored live.
                </p>
                <div class="kn-steps">
                  <div class="kn-step">
                    <span class="kn-step-n">1</span>
                    <p>The vocals separate cleanly from the instruments</p>
                  </div>
                  <div class="kn-step">
                    <span class="kn-step-n">2</span>
                    <p>Lyrics sync to the music, word by word</p>
                  </div>
                  <div class="kn-step">
                    <span class="kn-step-n">3</span>
                    <p>Sing into the mic and watch your score climb</p>
                  </div>
                </div>
                <Show when={demoIsPlayable(manifest())}>
                  <button class="kn-btn kn-btn--primary" onClick={singDemo}>
                    Sing this song
                  </button>
                </Show>
              </div>
            }
          >
            {(song) => (
              <div class="kn-stage-panel">
                <Suspense
                  fallback={
                    <div class="kn-stage-loading">Raising the curtain…</div>
                  }
                >
                  <KaraokeStageHost
                    song={song}
                    onExit={() => setSongWithUrl(null, true)}
                    onSong={(s) => setSongWithUrl(s, true)}
                  />
                </Suspense>
              </div>
            )}
          </Show>
        </main>
      </div>

      <footer class="kn-footer">
        <Show when={attribution()}>
          {(a) => (
            <p class="kn-attribution">
              <a href={a().url} target="_blank" rel="noopener noreferrer">
                {a().text}
              </a>{' '}
              <a
                href={a().licenseUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                ({a().license})
              </a>
            </p>
          )}
        </Show>
        <nav class="kn-footer-links">
          <a href="/" onClick={() => trackKaraoke('karaoke_cta_studio')}>
            MercuryPitch — the full studio
          </a>
          <a href="/mirror">Voice Mirror</a>
          <a
            href="/#/settings/credits"
            onClick={() => trackKaraoke('karaoke_cta_studio')}
          >
            Account &amp; credits
          </a>
        </nav>
      </footer>

      {/* Toast host — the playlist runner and other flows raise notifications
          (e.g. "song unavailable, skipping…"); without this they'd render
          nowhere on the standalone page. */}
      <Notifications />
      <Suspense>
        <KaraokeNightRuntime onSong={(s) => setSongWithUrl(s, true)} />
      </Suspense>
    </div>
  )
}
