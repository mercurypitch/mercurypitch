// Piano Night link tests keep desktop and mobile launchers on the canonical route.
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PIANO_NIGHT_PATH } from '@/features/piano-night/route'

function repoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('Piano Night launchers', () => {
  it('uses one canonical path in both legacy Piano presentations', () => {
    const desktop = repoFile('src/pages/PianoPage.tsx')
    const mobile = repoFile('src/components/mobile/PianoMobileStage.tsx')

    expect(PIANO_NIGHT_PATH).toBe('/piano-night')
    expect(desktop).toContain('href={PIANO_NIGHT_PATH}')
    expect(desktop).toContain('data-tour="piano-night-launch"')
    expect(desktop).toContain('data-testid="open-piano-night"')
    expect(mobile).toContain('href={PIANO_NIGHT_PATH}')
    expect(mobile).toContain('aria-label="Open Piano Night performance room"')
    expect(mobile).toContain('data-testid="open-piano-night"')
  })
})
