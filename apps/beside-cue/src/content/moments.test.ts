import { describe, expect, it } from 'vitest'
import { getLocalizedMoments } from './localized-catalog'
import { getVoiceLines } from './localized-voice-lines'
import { MOMENTS, resolveMoment } from './moments'
import { DEFAULT_CONTENT_PACK } from './pack'

const pack = DEFAULT_CONTENT_PACK

describe('moment engine', () => {
  it.each([
    ['es', 'Girar hacia la cara B'],
    ['de', 'Hin zu Seite B'],
  ] as const)(
    'resolves a %s heading and line without altering the narrative beat',
    (locale, heading) => {
      const localizedPack = { ...pack, lines: getVoiceLines(locale) }
      const shown = resolveMoment(
        localizedPack,
        'turn.b-side',
        { rotation: 1 },
        getLocalizedMoments(locale),
      )
      const english = resolveMoment(pack, 'turn.b-side', { rotation: 1 })

      expect(shown.caption).toBe(heading)
      expect(shown.line).toBe(
        getVoiceLines(locale).find((line) => line.id === 'corky.side-b.02'),
      )
      expect(shown.line.text).not.toBe(english.line.text)
      expect(shown.character).toBe(english.character)
      expect(shown.characterState).toBe(english.characterState)
      expect(shown.art).toBe(english.art)
      expect(shown.pullCharacter).toBeUndefined()
      expect(english.caption).toBe('Turn toward Side B')
    },
  )

  it('resolves a beat into art, caption and line', () => {
    const shown = resolveMoment(pack, 'cue.open', { pullId: 'snacking' })

    expect(shown.characterState).toBe('notice')
    expect(shown.art.still).toMatch(/corky-notice/u)
    expect(shown.caption).toBe('One cue, no argument')
    expect(shown.line).toMatchObject({
      id: 'corky.cue-open.01',
      text: 'Needle’s hovering. No rush.',
    })
    expect(shown.pullCharacter?.name).toBe('Sugarlump')
    expect(shown.entity).toBe(shown.pullCharacter)
  })

  it('uses only the canonical Corky pool for each runtime moment', () => {
    expect(
      Object.fromEntries(
        Object.entries(MOMENTS).map(([id, definition]) => [
          id,
          definition.lineIds,
        ]),
      ),
    ).toEqual({
      'cue.open': [
        'corky.cue-open.01',
        'corky.cue-open.02',
        'corky.cue-open.03',
      ],
      'turn.b-side': ['corky.side-b.01', 'corky.side-b.02', 'corky.side-b.03'],
      'turn.a-side': [
        'corky.not-now.01',
        'corky.not-now.02',
        'corky.not-now.03',
      ],
      return: ['corky.return.01', 'corky.return.02', 'corky.return.03'],
      'pressing.earned': [
        'corky.pressing.01',
        'corky.pressing.02',
        'corky.pressing.03',
      ],
      'reminder.set': ['corky.reminder-set.01', 'corky.reminder-set.02'],
    })
  })

  it('rotates lines deterministically', () => {
    // The same counter must always produce the same line, or a screen would
    // change what it is saying every time it re-renders.
    const first = resolveMoment(pack, 'turn.b-side', { rotation: 0 })
    const again = resolveMoment(pack, 'turn.b-side', { rotation: 0 })
    const second = resolveMoment(pack, 'turn.b-side', { rotation: 1 })

    expect(again.line.id).toBe(first.line.id)
    expect(first.line.id).toBe('corky.side-b.01')
    expect(second.line.id).toBe('corky.side-b.02')
  })

  it('wraps a rotation counter past the end of the set', () => {
    const definition = MOMENTS['turn.b-side']
    const wrapped = resolveMoment(pack, 'turn.b-side', {
      rotation: definition.lineIds.length,
    })

    expect(wrapped.line.id).toBe(definition.lineIds[0])
  })

  it('survives a negative rotation counter', () => {
    // A stored counter can outlive the content it indexed into.
    expect(() =>
      resolveMoment(pack, 'turn.b-side', { rotation: -3 }),
    ).not.toThrow()
  })

  it('falls back to the plain cue when a pull has no creature', () => {
    // Someone who named their own moment still needs something to look at.
    const shown = resolveMoment(pack, 'cue.open', { pullId: 'custom' })

    expect(shown.pullCharacter?.id).toBe('generic')
    expect(shown.pullCharacter?.noticeOverlay.still).toMatch(
      /notice-cue-generic/u,
    )
    expect(shown.entity).toBe(shown.pullCharacter)
  })

  it('shows no cue at a beat that is not about one', () => {
    expect(resolveMoment(pack, 'turn.b-side').entity).toBeUndefined()
    expect(resolveMoment(pack, 'pressing.earned').entity).toBeUndefined()
  })

  it('never puts a cue on screen while the character rests neutrally', () => {
    // The notice art has the character looking at a fixed point. Any beat that
    // shows an entity must use a state where he is actually looking at it, or
    // the token lands beside a character staring past it.
    for (const definition of Object.values(MOMENTS)) {
      if (definition.showsEntity) {
        expect(
          ['notice', 'rest'],
          `moment "${definition.id}" shows a cue in state "${definition.characterState}"`,
        ).toContain(definition.characterState)
      }
    }
  })

  it('gives every moment a caption that stands without audio', () => {
    for (const definition of Object.values(MOMENTS)) {
      expect(definition.caption.trim().length).toBeGreaterThan(0)
    }
  })

  it('refuses a pack with no lead character', () => {
    expect(() =>
      resolveMoment({ ...pack, leadCharacterId: 'nobody' }, 'cue.open'),
    ).toThrow(/lead character/u)
  })
})
