// ============================================================
// The veil slider, and the scrim it has to reproduce
// ============================================================
//
// The one number that matters is the DEFAULT: it has to land on the scrim the
// room shipped with (25% portrait, 35% landscape), or the first singer to
// open the sheet sees the room change under a slider they have not moved.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatSingGlassValue, loadSingGlass, persistSingGlass, SING_GLASS, SING_GLASS_VAR, singGlassLabel, } from './sing-glass'

/** What `.scrimDim` computes: the heaviest veil, times what is left of it. */
const scrim = (glass: number, heaviest: number): number =>
  Math.round((1 - glass) * heaviest * 100) / 100

function storage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    read: (key: string) => values.get(key) ?? null,
  }
}

describe('the sing room veil', () => {
  it('starts exactly where the room shipped', () => {
    expect(SING_GLASS.defaultValue).toBe(0.5)
    // 50% and 70% are what the stylesheet paints at full veil.
    expect(scrim(SING_GLASS.defaultValue, 0.5)).toBe(0.25)
    expect(scrim(SING_GLASS.defaultValue, 0.7)).toBe(0.35)
  })

  it('takes the veil off entirely at the top, and doubles it at the floor', () => {
    expect(scrim(SING_GLASS.max, 0.5)).toBe(0)
    expect(scrim(SING_GLASS.min, 0.5)).toBe(0.5)
    expect(scrim(SING_GLASS.min, 0.7)).toBe(0.7)
  })

  it('reads the default when nothing is stored', () => {
    expect(loadSingGlass(storage())).toBe(0.5)
  })

  it('reads a stored value back', () => {
    const store = storage({ pitchperfect_sing_room_glass: '0.85' })
    expect(loadSingGlass(store)).toBe(0.85)
  })

  it('ignores a value from a build whose bounds were different', () => {
    const store = storage({ pitchperfect_sing_room_glass: '4' })
    expect(loadSingGlass(store)).toBe(0.5)
  })

  it('clamps what it writes, and hands back what it wrote', () => {
    const store = storage()
    expect(persistSingGlass(2, store)).toBe(1)
    expect(store.read('pitchperfect_sing_room_glass')).toBe('1')
    expect(persistSingGlass(-1, store)).toBe(0)
  })

  it('is the number the room’s own scrim reads', () => {
    // The two halves of this are in different languages: a slider writes a
    // custom property and a stylesheet spends it. Nothing but this notices a
    // rename on one side — the scrim would simply fall back to its default
    // and the slider would move nothing at all.
    const css = readFileSync(
      'src/features/sing-room/sing-room.module.css',
      'utf8',
    )
    expect(css).toContain(`var(${SING_GLASS_VAR}`)
    const dim = css.slice(css.indexOf('.scrimDim'))
    expect(dim.slice(0, dim.indexOf('}'))).toContain(SING_GLASS_VAR)
  })

  it('says something useful without the room in front of you', () => {
    expect(singGlassLabel(0)).toBe('Focused')
    expect(singGlassLabel(0.3)).toBe('Soft')
    expect(singGlassLabel(0.5)).toBe('Clear')
    expect(singGlassLabel(1)).toBe('Open')
    expect(formatSingGlassValue(0.5)).toBe('Clear · 50% room visibility')
  })
})
