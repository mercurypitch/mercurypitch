// ============================================================
// The Sing room's palette — the dark stage's over the photograph
// ============================================================
//
// The room is a photograph under black scrims in either app theme. In the
// light theme its words were the theme's dark inks on it (1.3:1), its chips
// a light glass and its capsule near-white on blue (2.3:1). The column
// drawn over the photograph takes the dark stage's palette now
// (src/styles/dark-stage.css), with its glass mixed again from it, and the
// capsule keeps one ink for its one fill. Read from the sources, as the dark
// stage's own contract test reads its roots: jsdom applies no stylesheet.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const stage = source('src/features/sing-room/SingRoomStage.tsx')
const css = source('src/features/sing-room/sing-room.module.css')

/** A rule's body in the room's stylesheet, by its selector. */
const rule = (selector: string): string =>
  new RegExp(
    `\\n${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`,
  ).exec(css)?.[1] ?? ''

const luminance = (hex: string): number => {
  const [r, g, b] = (hex.match(/[a-f\d]{2}/giu) ?? []).map((channel) => {
    const v = Number.parseInt(channel, 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe("the Sing room's palette", () => {
  it('puts the column over the photograph on the dark stage, and not the room its sheets anchor in', () => {
    expect(stage).toContain('class={`${styles.ui} mp-dark-stage`}')
    expect(stage).toMatch(/class=\{styles\.room\}\n/u)
  })

  it("mixes the column's glass from the stage's surface, not the document's", () => {
    expect(rule('.ui')).toMatch(
      /--glass-bg:\s*color-mix\(in srgb, var\(--bg-secondary\) 72%, transparent\);/u,
    )
  })

  it('writes the capsule in one ink that reads on its one fill', () => {
    const capsule = rule('.capsule')
    const fill =
      /background:\s*var\(--accent-primary,\s*(#[\da-f]{6})\)/iu.exec(
        capsule,
      )?.[1]
    const ink = /\n\s*color:\s*(#[\da-f]{6});/iu.exec(capsule)?.[1]

    expect(fill).toBe('#58a6ff')
    expect(ink).toBeDefined()
    expect(contrast(fill ?? '', ink ?? '')).toBeGreaterThanOrEqual(4.5)
  })
})
