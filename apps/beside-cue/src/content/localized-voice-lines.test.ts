// ============================================================
// Localized dialogue contract — stable identity and language-exact delivery
// ============================================================

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { findLocalizedVoiceLine, getRecordedVoiceLines, getVoiceLines, } from './localized-voice-lines'
import { PREMIUM_PULL_IDS } from './premium-pulls'
import { FREE_PULL_IDS } from './pulls'
import { CANONICAL_VOICE_LINES } from './voice-lines'

describe('localized voice lines', () => {
  it('leaves all English lines and delivery identities unchanged', () => {
    expect(getVoiceLines('en')).toBe(CANONICAL_VOICE_LINES)
    expect(getRecordedVoiceLines('en')).toBe(CANONICAL_VOICE_LINES)
  })

  it.each(['es', 'de'] as const)(
    'has a complete, exact NFC caption registry for %s',
    (locale) => {
      const lines = getVoiceLines(locale)
      expect(lines).toHaveLength(67)
      expect(new Set(lines.map((line) => line.id)).size).toBe(67)
      expect(new Set(lines.map((line) => line.fileStem)).size).toBe(67)
      expect(lines.map((line) => line.id)).toEqual(
        CANONICAL_VOICE_LINES.map((line) => line.id),
      )
      for (const [index, line] of lines.entries()) {
        const original = CANONICAL_VOICE_LINES[index]!
        expect(line.speakerId).toBe(original.speakerId)
        expect(line.kind).toBe(original.kind)
        expect(line.text).not.toBe(original.text)
        expect(line.text).toBe(line.text.normalize('NFC'))
        expect(line.captionSha256).toBe(
          createHash('sha256').update(line.text, 'utf8').digest('hex'),
        )
        expect(line.captionSha256).not.toBe(original.captionSha256)
        expect(line.fileStem).toBe(
          original.fileStem.replace(/^en__/u, `${locale}__`),
        )
        expect(findLocalizedVoiceLine(locale, line.id)).toBe(line)
      }
    },
  )

  it.each(['es', 'de'] as const)(
    'limits %s planned recordings to Corky and six basic Pulls',
    (locale) => {
      const lines = getRecordedVoiceLines(locale)
      expect(lines).toHaveLength(43)
      expect(lines.filter((line) => line.speakerId === 'corky')).toHaveLength(
        25,
      )
      for (const id of FREE_PULL_IDS) {
        expect(
          lines
            .filter((line) => line.id.startsWith(`pull.${id}.`))
            .map((line) => line.kind),
        ).toEqual(['meet', 'present', 'recede'])
      }
      for (const id of PREMIUM_PULL_IDS) {
        const prefix = `pull.${id}.`
        expect(
          getVoiceLines(locale).filter((line) => line.id.startsWith(prefix)),
        ).toHaveLength(3)
        expect(lines.filter((line) => line.id.startsWith(prefix))).toEqual([])
      }
      expect(lines.some((line) => /pocket|loop/u.test(line.speakerId))).toBe(
        false,
      )
    },
  )

  it('keeps the approved vocabulary, familiar names and comparison greetings', () => {
    expect(
      findLocalizedVoiceLine('es', 'corky.onboarding.greeting')?.text,
    ).toBe('Hola, soy Corky.')
    expect(
      findLocalizedVoiceLine('de', 'corky.onboarding.greeting')?.text,
    ).toBe('Hallo, ich bin Corky.')
    expect(
      findLocalizedVoiceLine('es', 'corky.onboarding.pull-choice')?.text,
    ).toContain('Un impulso')
    expect(
      findLocalizedVoiceLine('de', 'corky.onboarding.pull-choice')?.text,
    ).toContain('Ein Impuls')
    expect(
      findLocalizedVoiceLine('es', 'corky.onboarding.sides')?.text,
    ).toContain('La cara A')
    expect(
      findLocalizedVoiceLine('de', 'corky.onboarding.sides')?.text,
    ).toContain('Seite B')
    expect(findLocalizedVoiceLine('es', 'pull.snacking.meet')?.text).toContain(
      'Sugarlump',
    )
    expect(findLocalizedVoiceLine('de', 'pull.scrolling.meet')?.text).toContain(
      'The Scroll',
    )
    expect(findLocalizedVoiceLine('de', 'unknown')).toBeUndefined()
  })
})
