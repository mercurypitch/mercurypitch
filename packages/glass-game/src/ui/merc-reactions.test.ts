// Merc break reaction tests — a seeded deck exhausts every line before repeating.
import { describe, expect, it, vi } from 'vitest'
import { createMercReactionSelector, MERC_BREAK_REACTIONS, } from './merc-reactions'

describe('Merc break reactions', () => {
  it('keeps every cue paired with its exact approved caption', () => {
    expect(MERC_BREAK_REACTIONS).toEqual([
      { cue: 'optional-break', caption: 'Gorgeous. Absolutely gorgeous.' },
      { cue: 'beautiful-mess', caption: 'Another beautiful mess.' },
      {
        cue: 'little-disaster',
        caption: 'A little note. A lovely little disaster.',
      },
      { cue: 'sparkling', caption: 'That was positively sparkling.' },
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
    ])
  })

  it('uses every reaction before reshuffling and avoids a boundary repeat', () => {
    let randomCalls = 0
    const selector = createMercReactionSelector(() =>
      // Cycle one ends on catalog item B. Put B at the top of cycle two so
      // the boundary guard, rather than a lucky shuffle, prevents repetition.
      randomCalls++ === MERC_BREAK_REACTIONS.length - 1 ? 0.2 : 0,
    )
    const cues = Array.from(
      { length: MERC_BREAK_REACTIONS.length * 2 },
      () => selector.next().cue,
    )

    expect(new Set(cues.slice(0, MERC_BREAK_REACTIONS.length)).size).toBe(
      MERC_BREAK_REACTIONS.length,
    )
    expect(new Set(cues.slice(MERC_BREAK_REACTIONS.length)).size).toBe(
      MERC_BREAK_REACTIONS.length,
    )
    expect(cues[MERC_BREAK_REACTIONS.length - 1]).not.toBe(
      cues[MERC_BREAK_REACTIONS.length],
    )
  })

  it('is deterministic for an injected random sequence', () => {
    const sequence = [0.14, 0.8, 0.31, 0.62, 0.03, 0.49]
    const seeded = () => {
      let index = 0
      return vi.fn(() => sequence[index++ % sequence.length])
    }
    const first = createMercReactionSelector(seeded())
    const second = createMercReactionSelector(seeded())

    expect(Array.from({ length: 16 }, () => first.next().cue)).toEqual(
      Array.from({ length: 16 }, () => second.next().cue),
    )
  })
})
