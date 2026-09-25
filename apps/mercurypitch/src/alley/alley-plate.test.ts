import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { alleyFit } from './alley-geometry'
import { ALLEY_PLATE, DOORS, doorSpec, plateSourceFor } from './alley-plate'

const drawn = (
  w: number,
  h: number,
  frame?: { top: number; bottom: number; left?: number },
): number => alleyFit(ALLEY_PLATE, DOORS, w, h, frame).scale

describe('which plate file a screen gets', () => {
  it('keeps the 1x where it is not upscaled, and takes the 2x where it would be', () => {
    // 852 / 1536 x 3 = 1.664: just under the 1x file's 1.667.
    expect(plateSourceFor(drawn(393, 852), 3)).toBe(ALLEY_PLATE.src)
    // 932 / 1536 x 3 = 1.82.
    expect(plateSourceFor(drawn(430, 932), 3)).toBe(ALLEY_PLATE.hi)
    // A DPR 2 phone never needs it; a DPR 2 tablet does.
    expect(plateSourceFor(drawn(390, 844), 2)).toBe(ALLEY_PLATE.src)
    expect(plateSourceFor(drawn(1024, 1366), 2)).toBe(ALLEY_PLATE.hi)
  })

  it('reads the scale the plate is drawn at on its side, not the cover scale', () => {
    // 852 x 393 at DPR 3 beside its headline block: the band draws the plate
    // at about 0.36 CSS px per unit, 1.09 device px. The cover scale (0.83,
    // 2.5 device px) asked for the 2x.
    const scale = drawn(852, 393, { top: 8, bottom: 321, left: 300 })
    expect(scale * 3).toBeLessThan(1.2)
    expect(plateSourceFor(scale, 3)).toBe(ALLEY_PLATE.src)
  })
})

describe('the room an open door ends on', () => {
  // The open's last frame is the room's own picture drawn where the room's
  // [data-room-background] draws it (alley-entry.ts), and the door can only
  // know how from its spec. A room whose stylesheet drifted from it would
  // hand over with a jump, so the two are read side by side.
  const rule = (file: string, selector: string): string => {
    const css = readFileSync(
      new URL(`../../../../src/features/${file}`, import.meta.url),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//gu, '')
    const found = new RegExp(
      `\\n${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`,
      'u',
    ).exec(css)
    if (found === null) throw new Error(`${file}: no ${selector} rule`)
    return found[1]
  }
  const scaleOf = (block: string): number => {
    const found = /transform:\s*scale\(([\d.]+)\)/u.exec(block)
    return found === null ? 1 : Number(found[1])
  }

  it.each([
    ['sing', 'sing-room/sing-room.module.css', '.cover'],
    ['ear', 'ear-lab/EarRoomShell.module.css', '.roomPlate'],
  ] as const)(
    '%s: its room draws the picture as the door expects',
    (key, file, selector) => {
      const block = rule(file, selector)
      const spec = doorSpec(key).roomBackground
      expect(spec?.surface).toBe(key)
      expect(block).toMatch(/background-image:\s*var\(--mp-stage-image\)/u)
      expect(block).toMatch(/background-size:\s*cover/u)
      expect(block).toMatch(/background-position:\s*var\(--mp-stage-position/u)
      expect(spec?.scale).toBe(scaleOf(block))
    },
  )

  it('names a room for exactly the doors that open', () => {
    for (const door of DOORS) {
      expect(door.roomBackground !== null, door.key).toBe(door.tab !== null)
    }
  })
})
