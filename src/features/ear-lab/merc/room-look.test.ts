// The drill room's look (docs/plans/ear-lab-native-look.md): the native
// app's language, not the brass room it replaced. Its stylesheets, and
// the bench's since it was drawn in the same light, carry no brass,
// parchment or serif; the kit's colours stand where they were, and every
// station lights the stage in its own two colours, its tile and its
// sheet too.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STATION_ORDER } from './stations'

const SHEETS = {
  room: 'src/features/ear-lab/merc/room.module.css',
  plate: 'src/features/ear-lab/merc/plate.module.css',
  loupe: 'src/features/ear-lab/merc/loupe.module.css',
  bench: 'src/features/ear-lab/merc/bench.module.css',
  rooms: 'src/features/premium-exercises/ear-rooms-row.module.css',
} as const

/** A sheet's text without its comments, which may name what went. */
function css(path: string): string {
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '')
}

describe("the drill room's stylesheets", () => {
  for (const [name, path] of Object.entries(SHEETS)) {
    it(`${name}: no brass, parchment or serif left`, () => {
      const text = css(path)
      // The brass room's tokens and its three brasses.
      expect(text).not.toMatch(/--merc-/u)
      expect(text).not.toMatch(/#c9a45e|#e7c67d|#f0d697|#efe6d6|#24190a/iu)
      expect(text).not.toMatch(/231 198 125|201 164 94|239 230 214/u)
      // Inter for every word: no Crimson Pro, no serif but sans-serif.
      expect(text).not.toMatch(/crimson/iu)
      expect(text).not.toMatch(/(?<!sans-)serif/iu)
    })
  }

  it("keeps the kit's colours: lit violet, the filled violet, teal and red", () => {
    const room = css(SHEETS.room)
    expect(room).toContain('--room-lit: #9a87f0')
    expect(room).toContain('--room-lit-fill: #7c4dff')
    expect(room).toContain('--room-right: #2ee6c9')
    expect(room).toContain('--room-wrong: #ff6a5c')
  })

  it('lights the stage in each station its own pair of colours', () => {
    const room = css(SHEETS.room)
    for (const station of STATION_ORDER) {
      expect(room, station).toContain(`.room[data-station='${station}']`)
    }
  })

  it("lights each station's tile and sheet in the same pair", () => {
    const room = css(SHEETS.room)
    const bench = css(SHEETS.bench)
    const pair = (text: string, selector: string): string[] => {
      const block = text.slice(text.indexOf(selector))
      return [/--room-a: (#[0-9a-f]+)/u, /--room-b: (#[0-9a-f]+)/u].map(
        (re) => re.exec(block)?.[1] ?? '',
      )
    }
    const channels = (hex: string): string =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
    for (const station of STATION_ORDER) {
      const [a, b] = pair(room, `.room[data-station='${station}']`)
      const block = bench.slice(bench.indexOf(`[data-faculty='${station}']`))
      expect(block, station).toMatch(
        new RegExp(
          `--station-a: ${channels(a)};\\s*--station-b: ${channels(b)};`,
          'u',
        ),
      )
    }
  })
})
