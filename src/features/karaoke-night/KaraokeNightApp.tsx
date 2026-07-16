import { createSignal, lazy, onMount, Show, Suspense } from 'solid-js'
import type { DemoSongManifest } from './demo-song'
import { DEMO_SESSION_ID, demoIsPlayable, loadDemoSong, seedDemoLyrics, } from './demo-song'
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

const ALPHA_KEY = 'pitchperfect_kn_stage_alpha'

function loadStageAlpha(): number {
  try {
    const v = Number(localStorage.getItem(ALPHA_KEY))
    if (v >= 0.3 && v <= 1) return v
  } catch {
    /* localStorage unavailable */
  }
  return 0.78
}

export function KaraokeNightApp() {
  const [manifest, setManifest] = createSignal<DemoSongManifest | null>(null)
  const [activeSong, setActiveSong] = createSignal<KaraokeSong | null>(null)
  const [stageAlpha, setStageAlpha] = createSignal(loadStageAlpha())

  const updateAlpha = (v: number) => {
    setStageAlpha(v)
    try {
      localStorage.setItem(ALPHA_KEY, String(v))
    } catch {
      /* localStorage unavailable */
    }
  }

  onMount(() => {
    void loadDemoSong().then(setManifest)
  })

  const singDemo = () => {
    const m = manifest()
    if (!demoIsPlayable(m)) return
    const md = m as DemoSongManifest
    void (async () => {
      // The stage's lyrics controller reads the db on mount and starts an
      // online search when it finds nothing — so the seed must land first.
      await seedDemoLyrics(md)
      setActiveSong({
        sessionId: DEMO_SESSION_ID,
        title: `${md.title} — ${md.artist}`,
        stems: md.stems,
      })
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
                min="0.3"
                max="1"
                step="0.02"
                value={stageAlpha()}
                onInput={(e) => updateAlpha(Number(e.currentTarget.value))}
              />
            </label>
          </Show>
          <a href="/#/karaoke">Open the studio</a>
          <a href="/#/settings/credits">Credits</a>
        </nav>
      </header>

      <div
        class="kn-body"
        classList={{ 'kn-body--staged': activeSong() !== null }}
      >
        <aside class="kn-rail">
          <section class="kn-card kn-card--demo">
            <p class="kn-card-kicker">Tonight's opener</p>
            <h2>{manifest()?.title ?? 'Demo mix'}</h2>
            <p class="kn-card-sub">{manifest()?.artist ?? ''}</p>
            <Show
              when={demoIsPlayable(manifest())}
              fallback={<p class="kn-soon">Demo mix coming soon</p>}
            >
              <button
                class="kn-btn kn-btn--primary"
                onClick={singDemo}
                disabled={activeSong()?.sessionId === DEMO_SESSION_ID}
              >
                Sing the demo
              </button>
            </Show>
          </section>

          <Suspense>
            <KaraokeRailPanels onSing={setActiveSong} />
          </Suspense>
        </aside>

        <main class="kn-stage">
          <Show
            when={activeSong()}
            keyed
            fallback={
              <div class="kn-hero">
                <h1>Your stage is set</h1>
                <p>
                  Pick the demo, or add a song you own — the vocals lift away,
                  the lyrics light up line by line, and every note you sing is
                  scored live.
                </p>
                <div class="kn-steps">
                  <div class="kn-step">
                    <span class="kn-step-n">1</span>
                    <p>AI separates the vocals from the instruments</p>
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
                    Sing the demo
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
                    onSong={setActiveSong}
                    onExit={() => setActiveSong(null)}
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
          <a href="/">MercuryPitch — the full studio</a>
          <a href="/mirror">Voice Mirror</a>
          <a href="/#/settings/credits">Account &amp; credits</a>
        </nav>
      </footer>
    </div>
  )
}
