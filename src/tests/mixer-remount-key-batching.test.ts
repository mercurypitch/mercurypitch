// ============================================================
// The mixer's remount key may never move on its own
// ============================================================
//
// `mixerSessionId` is the keyed `<Show>` key that remounts the Stem Mixer,
// and the mixer reads `stems` exactly once, at mount (the props are handed to
// useStemMixerAudioController behind a `solid/reactivity` disable, on purpose:
// a song is a fresh mount, not a live prop swap).
//
// So writing the id outside a batch remounts the mixer immediately, against
// whatever `mixerStems` still holds — the previous song's audio under the new
// song's chrome and lyrics. Two paths did exactly that; a third was correct
// only because of the order its statements happened to be in.
//
// This is a source scan rather than a render test because the trap is in the
// *shape* of the update, not in any one outcome: a future caller that adds a
// fourth path would reintroduce it without failing a behavioural test that
// only covers the three we know about.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/components/UvrPanel.tsx'),
  'utf8',
)

/** Every `batch(() => { ... })` body, matched by brace balance. */
function batchBodies(text: string): string[] {
  const bodies: string[] = []
  const opener = /batch\(\(\) => \{/g
  let match: RegExpExecArray | null
  while ((match = opener.exec(text)) !== null) {
    let depth = 1
    let index = match.index + match[0].length
    const start = index
    while (index < text.length && depth > 0) {
      const char = text[index]
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      index += 1
    }
    bodies.push(text.slice(start, index - 1))
  }
  return bodies
}

const SESSION_ID_WRITE = 'setMixerSessionId('
const STEMS_WRITE = 'setMixerStems('

const countOf = (text: string, needle: string): number =>
  text.split(needle).length - 1

describe('Stem Mixer remount key', () => {
  it('is only ever written inside a batch', () => {
    const bodies = batchBodies(source)
    const inBatches = bodies.reduce(
      (total, body) => total + countOf(body, SESSION_ID_WRITE),
      0,
    )
    // The signal's own `createSignal` line names the setter too; the writes
    // are the call sites.
    const everywhere = countOf(source, SESSION_ID_WRITE)

    expect(everywhere).toBeGreaterThan(0)
    expect(
      inBatches,
      'a setMixerSessionId call escaped its batch — the mixer will remount against the previous song’s stems',
    ).toBe(everywhere)
  })

  it('never moves without the stems that mount alongside it', () => {
    for (const body of batchBodies(source)) {
      if (!body.includes(SESSION_ID_WRITE)) continue
      expect(
        body.includes(STEMS_WRITE),
        'a batch sets the remount key without setting the stems for that mount',
      ).toBe(true)
    }
  })
})
