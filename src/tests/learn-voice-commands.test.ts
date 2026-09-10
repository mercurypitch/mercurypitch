// ============================================================
// The voice Learn chapter may only teach phrases that exist
// ============================================================
//
// A tutorial that names a command nobody implemented is worse than no
// tutorial: the reader says the words, nothing happens, and they conclude
// voice control is broken. Phrase lists move — a rename here is invisible to
// prose over there — so every phrase this chapter quotes is checked against
// what the app actually registers.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createLeaveForStudioVoiceCommands } from '@/features/voice-control/room-navigation-commands'
import { WALKTHROUGHS } from '@/types/walkthrough'

const chapter = (WALKTHROUGHS.study ?? []).find(
  (entry) => entry.id === 'voice-commands',
)

/** Every phrase the room/tab factories build at runtime. */
function registeredPhrases(): string[] {
  return createLeaveForStudioVoiceCommands().flatMap(
    (command) => command.phrases,
  )
}

/** Every string literal in the voice-control sources, for the rest. */
function sourceText(): string {
  const root = 'src/features/voice-control'
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) walk(path)
      else if (path.endsWith('.ts') && !path.includes('.test.'))
        files.push(path)
    }
  }
  walk(root)
  files.push('src/features/mercury-sing/mercury-sing-commands.ts')
  return files.map((file) => readFileSync(file, 'utf8')).join('\n')
}

/** Spelled out is how a person talks, and the grammar reads both. */
const NUMBER_WORDS =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/g

/**
 * The prose writes what a person says; the code writes a template.
 *
 * "back 4 beats" and "sing number two" are both `<n>` slots — the grammar
 * parses digits and number words alike — "set A" is `set a`, and a leading
 * "Mercury," is the wake word rather than part of any phrase.
 */
function asPhraseTemplate(spoken: string): string {
  return spoken
    .toLowerCase()
    .replace(/^mercury,\s*/, '')
    .replace(/\b\d+\b/g, '<n>')
    .replace(NUMBER_WORDS, '<n>')
}

describe('the "Talking to MercuryPitch" Learn chapter', () => {
  it('is registered where the other how-to chapters live', () => {
    expect(chapter).toBeDefined()
    expect(chapter?.tab).toBe('study')
  })

  it('is reachable at #/learn/voice-commands', () => {
    // The route builder takes the chapter id verbatim, so the id IS the URL.
    expect(chapter?.id).toBe('voice-commands')
  })

  it('has a title, a description and steps the Learn list can render', () => {
    expect(chapter?.title).toBeTruthy()
    expect(chapter?.description).toBeTruthy()
    expect(chapter?.steps.length).toBeGreaterThan(0)
    expect(chapter?.thumbnail).toBeTruthy()
  })

  it('quotes only phrases the app answers to', () => {
    // Italicised text is how the chapter marks something to say out loud.
    const quoted = [...(chapter?.content ?? '').matchAll(/_"([^"]+)"_/g)].map(
      (match) => match[1]!,
    )
    expect(quoted.length).toBeGreaterThan(15)

    const registered = new Set(registeredPhrases())
    const sources = sourceText()
    const unknown = quoted.filter((spoken) => {
      const phrase = asPhraseTemplate(spoken)
      if (registered.has(phrase)) return false
      return !sources.includes(`'${phrase}'`)
    })

    expect(unknown, `the chapter teaches phrases nothing registers`).toEqual([])
  })
})
