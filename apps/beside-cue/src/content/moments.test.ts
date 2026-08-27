import { describe, expect, it } from 'vitest'
import { MOMENTS, resolveMoment } from './moments'
import { DEFAULT_CONTENT_PACK } from './pack'

const pack = DEFAULT_CONTENT_PACK

describe('moment engine', () => {
  it('resolves a beat into art, caption and line', () => {
    const shown = resolveMoment(pack, 'cue.open', { pullId: 'snacking' })

    expect(shown.characterState).toBe('notice')
    expect(shown.art.still).toMatch(/corky-notice/u)
    expect(shown.caption).toBe('One cue, no argument')
    expect(shown.line.text.length).toBeGreaterThan(0)
    expect(shown.pullCharacter?.name).toBe('Sugarlump')
    expect(shown.entity).toBe(shown.pullCharacter)
  })

  it('rotates lines deterministically', () => {
    // The same counter must always produce the same line, or a screen would
    // change what it is saying every time it re-renders.
    const first = resolveMoment(pack, 'turn.b-side', { rotation: 0 })
    const again = resolveMoment(pack, 'turn.b-side', { rotation: 0 })
    const second = resolveMoment(pack, 'turn.b-side', { rotation: 1 })

    expect(again.line.id).toBe(first.line.id)
    expect(second.line.id).not.toBe(first.line.id)
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
