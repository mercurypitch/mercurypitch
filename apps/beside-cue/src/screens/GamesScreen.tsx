import { createSignal, For, Show } from 'solid-js'
import './games.css'
import { AppHeader } from '@/components/AppHeader'
import { JOURNEY_CONFIG } from '@/games/glass/journey-config'
import { JourneyPrototype } from '@/games/glass/JourneyPrototype'
import { SONGBOOK } from '@/games/glass/levels'
import type { LevelDef } from '@/games/glass/levels/types'

interface GamesScreenProps {
  onBack: () => void
}

type LevelControl = 'flow' | 'platformer' | 'rhythm'

type PlayPick =
  | 'journey'
  | 'trials'
  | { level: LevelDef; control: LevelControl }
  | null

/** The range setting: songs sit lower / centered / higher around the
 * hummed note. Persisted per device; a later guided range-finder (sing
 * your lowest and highest) will set this automatically. */
const BIAS_KEY = 'beside-cue:games:range-bias'
const BIAS_STEP = JOURNEY_CONFIG.melody.rangeBiasSemis
const readBias = (): number => {
  try {
    const v = Number(window.localStorage.getItem(BIAS_KEY))
    return v === -BIAS_STEP || v === BIAS_STEP ? v : 0
  } catch {
    return 0
  }
}

/** B-side games: small sung games, unscored and ungated. The list stays in
 * the paper world; entering a game flips the record to its own stage. */
export function GamesScreen(props: GamesScreenProps) {
  const [playing, setPlaying] = createSignal<PlayPick>(null)
  const [rangeBias, setRangeBias] = createSignal(readBias())
  const pickBias = (b: number): void => {
    setRangeBias(b)
    try {
      window.localStorage.setItem(BIAS_KEY, String(b))
    } catch {
      // preference just lives for the session when storage is denied
    }
  }
  const levelPick = (): {
    level: LevelDef
    control: LevelControl
  } | null => {
    const p = playing()
    return typeof p === 'object' && p !== null ? p : null
  }

  return (
    <Show
      when={playing() === null}
      fallback={
        <div class="games-stage">
          <JourneyPrototype
            variant={playing() === 'trials' ? 'trials' : 'journey'}
            level={levelPick()?.level}
            control={levelPick()?.control}
            rangeBias={rangeBias()}
          />
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

        <div class="games-range" role="group" aria-label="Song range">
          <span class="games-range__label">Songs sit</span>
          <button
            class="games-range__pick"
            type="button"
            aria-pressed={rangeBias() === -BIAS_STEP}
            onClick={() => pickBias(-BIAS_STEP)}
          >
            Lower
          </button>
          <button
            class="games-range__pick"
            type="button"
            aria-pressed={rangeBias() === 0}
            onClick={() => pickBias(0)}
          >
            Centered
          </button>
          <button
            class="games-range__pick"
            type="button"
            aria-pressed={rangeBias() === BIAS_STEP}
            onClick={() => pickBias(BIAS_STEP)}
          >
            Higher
          </button>
        </div>

        <For each={SONGBOOK}>
          {(level) => (
            <div class="game-card game-card--song">
              <img
                class="game-card__art"
                src="games/merc.webp"
                alt=""
                width="64"
                height="64"
              />
              <span class="game-card__body">
                <span class="game-card__name">
                  {level.title}
                  <span class="game-card__chip">Songbook</span>
                </span>
                <span class="game-card__blurb">
                  {level.blurb ??
                    'The melody is the level — every slab is the next note.'}
                </span>
                <span class="game-card__modes">
                  <button
                    class="game-card__mode"
                    type="button"
                    onClick={() => setPlaying({ level, control: 'flow' })}
                  >
                    Sing the line
                  </button>
                  <button
                    class="game-card__mode"
                    type="button"
                    onClick={() => setPlaying({ level, control: 'platformer' })}
                  >
                    Jump the line
                  </button>
                  <button
                    class="game-card__mode"
                    type="button"
                    onClick={() => setPlaying({ level, control: 'rhythm' })}
                  >
                    Tap the line
                  </button>
                </span>
              </span>
            </div>
          )}
        </For>

        <p class="games-screen__note">
          Sung modes use the microphone while a game is open, and only then —
          Tap the line needs no microphone at all. More B-side games are on the
          way; nothing here is scored or gated.
        </p>
      </main>
    </Show>
  )
}
