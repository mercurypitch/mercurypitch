import { createSignal, Show } from 'solid-js'
import './games.css'
import { AppHeader } from '@/components/AppHeader'
import { JourneyPrototype } from '@/games/glass/JourneyPrototype'

interface GamesScreenProps {
  onBack: () => void
}

/** B-side games: small sung games, unscored and ungated. The list stays in
 * the paper world; entering a game flips the record to its own stage. */
export function GamesScreen(props: GamesScreenProps) {
  const [playing, setPlaying] = createSignal<'journey' | 'trials' | null>(null)

  return (
    <Show
      when={playing() === null}
      fallback={
        <div class="games-stage">
          <JourneyPrototype variant={playing() ?? 'journey'} />
          <button
            class="games-leave"
            type="button"
            onClick={() => setPlaying(null)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 5-7 7 7 7" />
            </svg>
            Leave
          </button>
        </div>
      }
    >
      <main class="games-screen app-screen">
        <AppHeader label="B-side games" onBack={props.onBack} />
        <section class="games-screen__intro" aria-labelledby="games-title">
          <p class="screen-kicker">The other side</p>
          <h1 id="games-title">A small game, sung.</h1>
          <p class="games-screen__sub">
            Merc climbs when you hum. Resting on a note is allowed; only glass
            gives way. A few minutes, then back to your day.
          </p>
        </section>

        <button
          class="game-card"
          type="button"
          onClick={() => setPlaying('journey')}
        >
          <img
            class="game-card__art"
            src="games/merc.webp"
            alt=""
            width="64"
            height="64"
          />
          <span class="game-card__body">
            <span class="game-card__name">
              Merc's Journey
              <span class="game-card__chip">Prototype</span>
            </span>
            <span class="game-card__blurb">
              Hum to climb the platforms, shatter the gate, cross the melody
              bridge.
            </span>
          </span>
          <svg class="game-card__go" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>

        <button
          class="game-card"
          type="button"
          onClick={() => setPlaying('trials')}
        >
          <img
            class="game-card__art"
            src="games/merc.webp"
            alt=""
            width="64"
            height="64"
          />
          <span class="game-card__body">
            <span class="game-card__name">
              Jump Trials
              <span class="game-card__chip">Tryout</span>
            </span>
            <span class="game-card__blurb">
              Walk with the arrow keys — your voice is the jump. The higher the
              note, the higher the leap.
            </span>
          </span>
          <svg class="game-card__go" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>

        <p class="games-screen__note">
          Uses the microphone while a game is open, and only then. More B-side
          games are on the way; nothing here is scored or gated.
        </p>
      </main>
    </Show>
  )
}
