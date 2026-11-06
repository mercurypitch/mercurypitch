// ============================================================
// KaraokeHero — the empty stage's heading, promise and first song
// ============================================================
//
// What the stage shows before a song is on it. The heading and the promise
// are the landing's own (entry-intent.ts): the vocal remover and the karaoke
// app say what their documents say, in their words (src/seo/entry-pages.ts),
// and Karaoke Night keeps its "Your stage is set". The steps and the one
// call to action, the example song, are the room's and the same on all
// three: the tour's first stop rings that button (data-tour="karaoke.demo").

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { KaraokeEntryIntent } from './entry-intent'

interface HeroCopy {
  /** The page's one h1 once the room is up. */
  title: string
  lede: string
}

const HERO_COPY: Record<KaraokeEntryIntent, HeroCopy> = {
  'karaoke-night': {
    title: 'Your stage is set',
    lede: 'Start with our ready-to-sing song, or add one you own. The vocals lift away, the lyrics light up line by line, and every note you sing is scored live.',
  },
  'vocal-remover': {
    title: 'Vocal remover: take the voice out, keep the song',
    lede: 'Add a song you already own and it separates into a vocal track and an instrumental one. Keep the instrumental as a backing track or the vocal on its own, then sing over it, with your pitch scored live against the original melody.',
  },
  'karaoke-app': {
    title: 'A free karaoke app with lyrics and live scoring',
    lede: 'It runs in your browser on a phone, a tablet or a computer, with nothing to install. Sing an example song or bring one you own: the original vocal is separated out, synced lyrics are looked up for it, and every note you sing is scored live.',
  },
}

export interface KaraokeHeroProps {
  intent: KaraokeEntryIntent
  /** The example song can be sung here (demoIsPlayable). */
  demoPlayable: boolean
  onSingDemo: () => void
}

export function KaraokeHero(props: KaraokeHeroProps): JSX.Element {
  const copy = (): HeroCopy => HERO_COPY[props.intent]
  return (
    <div class="kn-hero" data-intent={props.intent}>
      <h1>{copy().title}</h1>
      <p>{copy().lede}</p>
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
      <Show when={props.demoPlayable}>
        <button
          class="kn-btn kn-btn--primary"
          data-tour="karaoke.demo"
          onClick={() => props.onSingDemo()}
        >
          Sing this song
        </button>
      </Show>
    </div>
  )
}
