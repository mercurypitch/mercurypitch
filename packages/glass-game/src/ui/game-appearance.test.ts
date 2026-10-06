// Appearance regression — malformed preferences and artist extremes cannot corrupt readability or game state.
import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_MATERIAL, gameThemeFromApp, normalizeGameMaterial, readGameAppearance, readGameMaterial, } from './game-appearance'

describe('game appearance preferences', () => {
  it.each([
    null,
    '{',
    'null',
    '[]',
    '42',
    '{"theme":"neon","reducedTransparency":"true"}',
  ])('keeps light defaults for %s', (raw) => {
    expect(readGameAppearance(raw)).toEqual({
      theme: 'light',
      reducedTransparency: false,
    })
  })
  it('round-trips the chosen skin and readable backing without audio fields', () => {
    expect(
      readGameAppearance(
        '{"theme":"dark","reducedTransparency":true,"musicVolume":0}',
      ),
    ).toEqual({ theme: 'dark', reducedTransparency: true })
    expect(readGameAppearance('{"theme":"app"}').theme).toBe('app')
  })
  it('maps the host presets without confusing world lighting with UI appearance', () => {
    for (const preset of [
      'dark',
      'midnight',
      'forest',
      'ocean',
      'cyberpunk',
      'rose',
      'amber',
      'slate',
    ])
      expect(gameThemeFromApp(preset)).toBe('dark')
    for (const preset of [null, 'light', 'unknown'])
      expect(gameThemeFromApp(preset)).toBe('light')
  })
  it.each([null, 'null', '[]', '{', '{"opacity":"clear","target":null}'])(
    'uses safe material defaults for %s',
    (raw) => {
      expect(readGameMaterial(raw)).toEqual(DEFAULT_GAME_MATERIAL)
    },
  )
  it('bounds all artist controls and rejects nonfinite input', () => {
    expect(
      normalizeGameMaterial({
        opacity: -1,
        gloss: 10,
        rim: 0,
        gold: Infinity,
        corner: 100,
        padding: -4,
        target: 2,
      }),
    ).toEqual({
      opacity: 0.72,
      gloss: 1,
      rim: 0.35,
      gold: 0.65,
      corner: 32,
      padding: 16,
      target: 72,
    })
    expect(normalizeGameMaterial({ opacity: NaN })).toEqual(
      DEFAULT_GAME_MATERIAL,
    )
  })
})
