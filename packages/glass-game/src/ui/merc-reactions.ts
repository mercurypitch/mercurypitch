// Merc break reactions — one typed cue and caption leave the shuffled deck together.
import type { MercNarrationLine } from '../host'

export const MERC_PATH_OPEN_LINE: MercNarrationLine = {
  cue: 'required-break',
  caption: 'Beautiful. A new path is open.',
}

export const MERC_BREAK_REACTIONS: readonly MercNarrationLine[] = [
  {
    cue: 'optional-break',
    caption: 'Gorgeous. Absolutely gorgeous.',
  },
  {
    cue: 'beautiful-mess',
    caption: 'Another beautiful mess.',
  },
  {
    cue: 'little-disaster',
    caption: 'A little note. A lovely little disaster.',
  },
  {
    cue: 'sparkling',
    caption: 'That was positively sparkling.',
  },
  {
    cue: 'glass-had-plans',
    caption: 'That glass had plans. So did you.',
  },
  {
    cue: 'music-to-my-ears',
    caption: 'Music to my ears. Confetti to my feet.',
  },
  {
    cue: 'cracking-performance',
    caption: 'Now that was a cracking performance.',
  },
]

export interface MercReactionSelector {
  next(): MercNarrationLine
}

function randomIndex(random: () => number, length: number): number {
  const sample = random()
  if (!Number.isFinite(sample) || sample <= 0) return 0
  return Math.min(length - 1, Math.floor(sample * length))
}

export function createMercReactionSelector(
  random: () => number = Math.random,
): MercReactionSelector {
  let deck: MercNarrationLine[] = []
  let previousCue: MercNarrationLine['cue'] | undefined

  function refill(): void {
    deck = [...MERC_BREAK_REACTIONS]
    for (let index = deck.length - 1; index > 0; index--) {
      const swap = randomIndex(random, index + 1)
      const line = deck[index]
      deck[index] = deck[swap]
      deck[swap] = line
    }
    const next = deck.length - 1
    if (previousCue !== undefined && deck[next]?.cue === previousCue) {
      const line = deck[0]
      deck[0] = deck[next]
      deck[next] = line
    }
  }

  return {
    next() {
      if (deck.length === 0) refill()
      const line = deck.pop()
      if (line === undefined) throw new Error('Merc reaction catalog is empty')
      previousCue = line.cue
      return line
    },
  }
}
