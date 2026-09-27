// Merc songbook audition — compare original sung sketches with the chosen character voice.
import { createSignal, For, onCleanup, Show, untrack } from 'solid-js'
import type { MercSongbookId, MercSongbookTake } from '../content/merc-songbook'
import { MERC_SONGBOOK, mercSongbookAssetId } from '../content/merc-songbook'
import type { GlassGameHost } from '../host'
import styles from './MercSongbook.module.css'
import type { SongbookPlaybackState } from './songbook-playback'
import { createSongbookPlayback } from './songbook-playback'

export function MercSongbook(props: { host: GlassGameHost; onClose(): void }) {
  const host = untrack(() => props.host)
  const [state, setState] = createSignal<SongbookPlaybackState>({
    assetId: null,
    phase: 'idle',
  })
  const player = host.createMemoryPlayback?.()
  const playback =
    player === undefined
      ? undefined
      : createSongbookPlayback({
          player,
          assetUrl: (id) => host.assetUrl(id),
          onChange: setState,
        })
  const unsubscribe = host.subscribeForeground?.((foreground) => {
    if (!foreground) playback?.stop()
  })
  onCleanup(() => {
    unsubscribe?.()
    playback?.dispose()
  })

  const button = (
    id: MercSongbookId,
    take: MercSongbookTake,
    label: string,
  ) => {
    const assetId = mercSongbookAssetId(id, take)
    const current = () => state().assetId === assetId
    const active = () =>
      current() && ['loading', 'playing'].includes(state().phase)
    return (
      <button
        type="button"
        aria-label={`${active() ? 'Stop' : 'Play'} ${label}: ${MERC_SONGBOOK.find((song) => song.id === id)!.words}`}
        aria-pressed={active()}
        disabled={playback === undefined}
        onClick={() => (active() ? playback?.stop() : playback?.play(assetId))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <Show when={active()} fallback={<path d="m8 5 11 7-11 7Z" />}>
            <path d="M6 6h12v12H6Z" />
          </Show>
        </svg>
        <span>
          {active()
            ? state().phase === 'loading'
              ? 'Loading…'
              : 'Stop'
            : label}
        </span>
      </button>
    )
  }
  return (
    <main class={styles.songbook}>
      <div class={styles.inner}>
        <header class={styles.header}>
          <div>
            <p class={styles.eyebrow}>Glassworks · Listening room</p>
            <h1>Merc’s little songbook</h1>
          </div>
          <button
            class={styles.close}
            type="button"
            onClick={() => props.onClose()}
          >
            Back to games
          </button>
        </header>
        <p class={styles.introduction}>Little songs for a beautiful mess.</p>
        <p class={styles.explanation}>
          Six little songs for our next journey. Hear Merc sing, or compare the
          guide singer. These are song sketches to try together; your lessons
          and scores stay as they are.
        </p>
        <Show when={player === undefined}>
          <p role="status">Audio audition is unavailable in this view.</p>
        </Show>
        <div class={styles.status} role="status" aria-live="polite">
          <Show when={state().phase === 'error'}>
            That take could not play. Tap it to try again.
          </Show>
        </div>
        <section class={styles.grid} aria-label="Song sketches">
          <For each={MERC_SONGBOOK}>
            {(song, index) => (
              <article class={styles.card}>
                <p class={styles.eyebrow}>
                  {String(index() + 1).padStart(2, '0')} · {song.title}
                </p>
                <h2>{song.words}</h2>
                <p class={styles.setting}>{song.setting}</p>
                <div class={styles.actions}>
                  {button(song.id, 'merc', 'Merc sings')}
                  {button(song.id, 'music', 'Guide singer')}
                </div>
              </article>
            )}
          </For>
        </section>
        <p class={styles.footnote}>
          No microphone needed. Pick a favourite feeling; the final singing
          examples will follow your comfortable range.
        </p>
      </div>
    </main>
  )
}
