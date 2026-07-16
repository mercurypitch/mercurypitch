import { createSignal, lazy, onMount, Show, Suspense } from 'solid-js'
import type { DemoSongManifest } from './demo-song'
import { DEMO_SESSION_ID, demoIsPlayable, loadDemoSong, seedDemoLyrics, } from './demo-song'
import type { KaraokeSong } from './KaraokeRailPanels'

/** Inject a component's CSS string once (StemMixer ships its styles as a
 *  string that the studio app injects at boot — mirror that here, but only
 *  when the stage chunk actually loads). */
function injectStyles(key: string, css: string): void {
  if (document.head.querySelector(`style[data-kn="${key}"]`) !== null) return
  const el = document.createElement('style')
  el.setAttribute('data-kn', key)
  el.textContent = css
  document.head.appendChild(el)
}

// Everything store/db-backed stays out of the first-paint chunk: the rail
// panels stream in right after mount, the stage (mixer + controllers) only
// when a song opens. Styles ride along with the same dynamic import.
const KaraokeRailPanels = lazy(async () => {
  const m = await import('./KaraokeRailPanels')
  return { default: m.KaraokeRailPanels }
})

const StemMixer = lazy(async () => {
  const m = await import('@/components/StemMixer')
  injectStyles('stem-mixer', m.StemMixerStyles)
  const lu = await import('@/components/LyricsUploader')
  injectStyles('lyrics-uploader', lu.LyricsUploaderStyles)
  return { default: m.StemMixer }
})

export function KaraokeNightApp() {
  const [manifest, setManifest] = createSignal<DemoSongManifest | null>(null)
  const [activeSong, setActiveSong] = createSignal<KaraokeSong | null>(null)

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
    <div class="kn-app">
      <header class="kn-topbar">
        <a class="kn-brand" href="/">
          MercuryPitch
        </a>
        <span class="kn-topbar-title">Karaoke Night</span>
        <nav class="kn-topbar-links">
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
                  <StemMixer
                    sessionId={song.sessionId}
                    stems={song.stems}
                    songTitle={song.title}
                    practiceMode="full"
                    requestedStems={{ vocal: true, instrumental: true }}
                    preset="performance"
                    onBack={() => setActiveSong(null)}
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
