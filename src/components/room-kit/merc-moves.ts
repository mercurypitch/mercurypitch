// ============================================================
// Merc's moves: what he does in a premium room, and where
// ============================================================
//
// Out of the room's controller: Merc's state, his place (in Long note,
// beside the lantern or floating in its glass), his hops between the two,
// and his cheer (Long note's goal and brim). Every change of state bumps a counter, so a landing
// scheduled before it cannot overwrite what came after. While he cheers,
// the lock's ups and downs leave him be; after it he follows the voice
// again, from beside the lantern.
//
// Under reduced motion (`still`) he never drops in, hops or jumps: he goes
// straight to his place, and a state that leaps or sparkles shows as a
// still one (STILL_STATE).

import type { Accessor } from 'solid-js'
import { batch, createSignal, untrack } from 'solid-js'
import type { MercState } from '@/lib/merc/constants'

export type MercPlace = 'beside' | 'inside'

/** His hop between the glass and the ground, ms (the room's .mercHop). */
export const HOP_MS = 650
/** His cheer at the goal and the brim, ms: two of his jumps. */
export const CHEER_MS = 1600

/**
 * Under reduced motion: his fall from above shows as standing there, and
 * his jumping, sparkling cheer as the lock's smile.
 */
const STILL_STATE: Partial<Record<MercState, MercState>> = {
  drop: 'idle',
  celebrate: 'lock',
}

export interface MercMovesDeps {
  /** A timer that belongs to the screen, dropped when it goes. */
  later: (ms: number, fn: () => void) => void
  /** Reduced motion: he moves without dropping, hopping or jumping. */
  still: () => boolean
  /** His face after a cheer, for the voice as it is; null once the take is over. */
  afterCheer: () => MercState | null
}

export interface MercMoves {
  state: Accessor<MercState>
  place: Accessor<MercPlace>
  /** A new state, where he stands. */
  set: (next: MercState) => void
  /** A state and a place at once, without a hop. */
  put: (next: MercState, place: MercPlace) => void
  /** A hop from one place to the other, landing in `then`. */
  hopTo: (place: MercPlace, then: MercState) => void
  /**
   * A hop, or straight there when he is there already or under reduced
   * motion. True when he hops.
   */
  move: (place: MercPlace, then: MercState) => boolean
  /** His face for the lock's ups and downs, unless he is cheering. */
  mood: (next: MercState) => void
  /** Out of the glass, or where he stands, to cheer; then the voice again. */
  cheer: () => void
  /** The take is over: a cheer under way ends with it. */
  stopCheering: () => void
}

export function createMercMoves(deps: MercMovesDeps): MercMoves {
  const shown = (next: MercState): MercState =>
    deps.still() ? (STILL_STATE[next] ?? next) : next
  const [state, setState] = createSignal<MercState>(shown('drop'))
  const [place, setPlace] = createSignal<MercPlace>('beside')
  let change = 0
  /** Bumped by each cheer and each stop, so an old cheer's end is dropped. */
  let cheers = 0
  let cheering = false

  const set = (next: MercState): void => {
    change += 1
    setState(shown(next))
  }
  const put = (next: MercState, where: MercPlace): void => {
    batch(() => {
      set(next)
      setPlace(where)
    })
  }
  const hopTo = (where: MercPlace, then: MercState): void => {
    if (deps.still()) {
      put(then, where)
      return
    }
    put('hop', where)
    const hop = change
    deps.later(HOP_MS, () => {
      if (change === hop) set(then)
    })
  }
  const move = (where: MercPlace, then: MercState): boolean => {
    const hop = !deps.still() && untrack(place) !== where
    if (hop) hopTo(where, then)
    else put(then, where)
    return hop
  }
  const stopCheering = (): void => {
    cheers += 1
    cheering = false
  }

  return {
    state,
    place,
    set,
    put,
    hopTo,
    move,
    mood: (next) => {
      if (!cheering) set(next)
    },
    cheer: () => {
      stopCheering()
      const mine = cheers
      cheering = true
      const hopped = move('beside', 'celebrate')
      deps.later((hopped ? HOP_MS : 0) + CHEER_MS, () => {
        if (mine !== cheers) return
        cheering = false
        const next = deps.afterCheer()
        if (next !== null) set(next)
      })
    },
    stopCheering,
  }
}
