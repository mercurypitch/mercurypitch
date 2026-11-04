// ============================================================
// TV memory: what each TV shows when it connects
// ============================================================
//
// Keyed by the TV's name, with one key for every TV whose name never came;
// a change keeps the TV's place, a forget makes it ask again; kept across a
// launch under an `mp:` key, which the settings sync never pushes; and
// storage that does not read as a list of TVs reads as none kept.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { forgetTv, reloadTvMemoryForTests, rememberedChoice, rememberedTvs, rememberTv, TV_MEMORY_KEY, } from './tv-memory'

const LG = 'LG webOS TV OLED48C24LA'
const SAMSUNG = '[TV] Samsung Q60 Series (55)'

beforeEach(() => {
  localStorage.clear()
  reloadTvMemoryForTests()
})

afterEach(() => {
  localStorage.clear()
  reloadTvMemoryForTests()
})

describe('the TV memory', () => {
  it('remembers a choice under the TV’s own name, and no other', () => {
    rememberTv(LG, 'stage')

    expect(rememberedChoice(LG)).toBe('stage')
    expect(rememberedChoice(SAMSUNG)).toBeNull()
    expect(rememberedChoice(null)).toBeNull()
  })

  it('keeps one choice for every TV whose name never came, apart from named ones', () => {
    rememberTv(null, 'lyrics')
    rememberTv(LG, 'stage')

    expect(rememberedChoice(null)).toBe('lyrics')
    expect(rememberedChoice(LG)).toBe('stage')
  })

  it('changes a TV’s choice in its place, without a second entry', () => {
    rememberTv(LG, 'stage')
    rememberTv(SAMSUNG, 'lyrics')

    rememberTv(LG, 'mirror')

    expect(rememberedTvs()).toEqual([
      { name: LG, choice: 'mirror' },
      { name: SAMSUNG, choice: 'lyrics' },
    ])
  })

  it('forgets one TV and keeps the rest', () => {
    rememberTv(LG, 'stage')
    rememberTv(null, 'lyrics')

    forgetTv(LG)

    expect(rememberedChoice(LG)).toBeNull()
    expect(rememberedTvs()).toEqual([{ name: null, choice: 'lyrics' }])
  })

  it('is still there after a launch, under a key the settings sync leaves alone', () => {
    rememberTv(LG, 'lyrics')

    reloadTvMemoryForTests()

    expect(rememberedChoice(LG)).toBe('lyrics')
    expect(TV_MEMORY_KEY.startsWith('pitchperfect_')).toBe(false)
    expect(JSON.parse(localStorage.getItem(TV_MEMORY_KEY) ?? 'null')).toEqual([
      { name: LG, choice: 'lyrics' },
    ])
  })

  it.each([
    ['a choice it does not know', [{ name: LG, choice: 'cinema' }]],
    ['an empty name', [{ name: '', choice: 'stage' }]],
    [
      'a TV twice',
      [
        { name: LG, choice: 'stage' },
        { name: LG, choice: 'lyrics' },
      ],
    ],
    ['something that is not a list', { [LG]: 'stage' }],
  ])('reads storage holding %s as no TV kept', (_what, stored) => {
    localStorage.setItem(TV_MEMORY_KEY, JSON.stringify(stored))
    reloadTvMemoryForTests()

    expect(rememberedTvs()).toEqual([])
  })
})
