// ============================================================
// The room's copy, as a tripwire rather than as four render tests
// ============================================================
//
// Device round 2, R6: "Stop putting Nothing uploaded in the UI; say it
// indirectly." The four sentences it touched live in three components, two of
// which (the resting foot and the priming door) only appear inside a stage
// that needs an audio engine, a microphone and a shell to render at all —
// so the cheapest honest check is to read the sources.
//
// It is a tripwire, not a style guide: it asserts the exact sentences that
// were decided, and that the word the owner asked for is absent from every
// string the native Sing surfaces ship. `probe-bundle.mjs` asks the same
// question of the built bundle, which is the half this cannot answer.

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Repo-relative: vitest runs from the workspace root in either project. */
const ROOM = 'src/features/sing-room'
const SHELL = 'apps/mercurypitch/src/shell'

function sources(dir: string): Array<[string, string]> {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'))
    .filter((name) => !name.includes('.test.'))
    .map((name) => [`${dir}/${name}`, readFileSync(`${dir}/${name}`, 'utf8')])
}

describe('the native copy after R6', () => {
  it('never says uploaded, in the room or in the shell', () => {
    const offenders = [...sources(ROOM), ...sources(SHELL)]
      .filter(([, text]) => /upload/iu.test(text))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('says what the microphone does instead, on the resting screen', () => {
    const stage = readFileSync(`${ROOM}/SingRoomStage.tsx`, 'utf8')
    expect(stage).toContain('The microphone stays off until you tap.')
  })

  it('says who can hear you, on the priming door', () => {
    const stage = readFileSync(`${ROOM}/SingRoomStage.tsx`, 'utf8')
    // One sentence, wrapped by the formatter — compare on the words, not on
    // the line breaks Prettier happens to choose this month.
    const flat = stage.replace(/\s+/gu, ' ')
    expect(flat).toContain(
      'MercuryPitch listens while you sing and draws your pitch on screen. Only you can hear you.',
    )
  })

  it('says where a kept take goes, on the end card', () => {
    const card = readFileSync(`${ROOM}/SingTakeSheet.tsx`, 'utf8')
    expect(card).toContain('Keep stores it on this phone.')
  })
})
