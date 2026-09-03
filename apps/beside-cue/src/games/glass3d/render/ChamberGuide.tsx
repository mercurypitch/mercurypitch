// Teaching the room, before the room has to.
// ============================================================
//
// A chamber's rule is one sentence of physics -- sing a note and the air
// settles into loud places and still places -- and a player who has that
// sentence reads the floor immediately. A player who does not sees
// coloured stripes and a droplet that keeps falling over.
//
// So this is four cards, and every one of them earns its place by
// answering a question the room cannot answer for itself in time:
// what am I singing at, what do the colours mean, why did everything
// move, and how do I walk.
//
// THE DIAGRAMS ARE DRAWN FROM `standingAmplitude`, the same function
// that colours the floor and decides whether Merc falls. A hand-drawn
// picture of a standing wave would be a second source of truth about
// where the nodes are, and the first thing to go stale.

import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { standingAmplitude } from '../sim/chamber3d'

/** Where the curve is drawn, in the diagram's own units. */
const W = 260
const H = 54
const STEPS = 96

/** Matches the floor's own threshold closely enough to teach with. The
 * rooms sit between 0.5 and 0.55; the picture is about which side of a
 * line a place falls on, not about the third decimal. */
const SAFE = 0.52

/**
 * The room, seen side-on, with the air's pattern drawn along it.
 *
 * Bands rather than a curve alone, because bands are what the player
 * will actually be looking at on the floor -- the curve is there to say
 * WHY the bands are where they are.
 */
const WaveDiagram = (props: {
  mode: number
  pane?: number
  merc?: number
  dim?: boolean
}) => {
  const bands = (): { x: number; w: number; safe: boolean }[] => {
    const out: { x: number; w: number; safe: boolean }[] = []
    for (let i = 0; i < STEPS; i++) {
      const x01 = (i + 0.5) / STEPS
      out.push({
        x: (i / STEPS) * W,
        w: W / STEPS,
        safe: standingAmplitude(x01, props.mode) <= SAFE,
      })
    }
    return out
  }

  const curve = (): string => {
    const points: string[] = []
    for (let i = 0; i <= STEPS; i++) {
      const x01 = i / STEPS
      const y = H - 6 - standingAmplitude(x01, props.mode) * (H - 16)
      points.push(
        `${i === 0 ? 'M' : 'L'}${((x01 * W) as number).toFixed(1)} ${y.toFixed(1)}`,
      )
    }
    return points.join(' ')
  }

  return (
    <svg
      class="chamber-guide__wave"
      classList={{ 'is-dim': props.dim === true }}
      viewBox={`0 0 ${W} ${H + 16}`}
      role="img"
      aria-label={`The room divided into ${props.mode} parts`}
    >
      <For each={bands()}>
        {(band) => (
          <rect
            x={band.x}
            y={H - 5}
            width={band.w + 0.4}
            height={7}
            class={band.safe ? 'is-safe' : 'is-danger'}
          />
        )}
      </For>
      <path class="chamber-guide__curve" d={curve()} />
      <Show when={props.pane !== undefined}>
        <rect
          x={(props.pane ?? 0) * W - 1.5}
          y={8}
          width={3}
          height={H - 14}
          class="chamber-guide__pane"
        />
      </Show>
      <Show when={props.merc !== undefined}>
        <circle
          cx={(props.merc ?? 0) * W}
          cy={H - 12}
          r={5.5}
          class="chamber-guide__merc"
        />
      </Show>
    </svg>
  )
}

interface Card {
  title: string
  body: string
  art: () => JSX.Element
}

/** Mode 3 puts a belly dead centre; mode 4 puts a node there. The two
 * pictures side by side are the whole mechanic. */
const CARDS: readonly Card[] = [
  {
    title: 'The room has a note',
    body: 'Sing it and the air stops travelling. It settles into a pattern of loud places and still places, and the pattern does not move while you hold the note.',
    art: () => <WaveDiagram mode={3} />,
  },
  {
    title: 'Loud breaks, still holds',
    body: 'Glass shakes itself apart where the air moves hardest — the red bands. The floor is only steady where the air is still — the teal ones. Stand on red while you are singing and Merc goes over.',
    art: () => <WaveDiagram mode={3} pane={0.5} merc={1 / 3} />,
  },
  {
    title: 'A different note, a different room',
    body: 'Sing a higher one and the room divides into more parts. Here the same pane sits on a loud place for the first note and a still one for the second — so the note you choose decides which glass can break, and where there is anywhere left to stand. The room\u2019s notes are listed down the left of the screen.',
    art: () => (
      <>
        <WaveDiagram mode={3} pane={0.5} />
        <WaveDiagram mode={4} pane={0.5} dim />
      </>
    ),
  },
  {
    title: 'Getting about',
    body: 'Press the left or right of the bar to walk, and tap it — or the arrow — to jump. If the room sits too high or too low for your voice, the octave buttons move the whole room. It never makes the puzzle easier.',
    art: () => null,
  },
]

const SEEN_KEY = 'beside-cue:games:chamber-guide'

export const guideSeen = (): boolean => {
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'seen'
  } catch {
    return false
  }
}

const markSeen = (): void => {
  try {
    window.localStorage.setItem(SEEN_KEY, 'seen')
  } catch {
    // it will be offered again next time, which is the safe way to be wrong
  }
}

export const ChamberGuide = (props: { onClose: () => void }) => {
  const [page, setPage] = createSignal(0)
  const card = (): Card => CARDS[page()]!
  const last = (): boolean => page() === CARDS.length - 1

  const done = (): void => {
    markSeen()
    props.onClose()
  }

  return (
    <div class="chamber-guide" role="dialog" aria-label="How a chamber works">
      <div class="chamber-guide__card">
        <p class="chamber-guide__step">
          {page() + 1} of {CARDS.length}
        </p>
        <h2>{card().title}</h2>
        <div class="chamber-guide__art">{card().art()}</div>
        <p class="chamber-guide__body">{card().body}</p>
        <div class="chamber-guide__nav">
          <button type="button" class="chamber-guide__skip" onClick={done}>
            Skip
          </button>
          <Show
            when={last()}
            fallback={
              <button type="button" onClick={() => setPage(page() + 1)}>
                Next
              </button>
            }
          >
            <button type="button" onClick={done}>
              Let me in
            </button>
          </Show>
        </div>
      </div>
    </div>
  )
}
