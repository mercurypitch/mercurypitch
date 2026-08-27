import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assetUrls } from './assets'
import { MOMENTS } from './moments'
import { CHARACTER_STATES, DEFAULT_CONTENT_PACK, findCharacter, findCueEntity, findLine, findPullCharacter, GENERIC_PULL_CHARACTER, validateContentPack, } from './pack'
import { pullOptions } from './pulls'

describe('content pack', () => {
  it('is valid', () => {
    expect(validateContentPack(DEFAULT_CONTENT_PACK)).toEqual([])
  })

  it('gives the lead character every state the app can ask for', () => {
    const corky = findCharacter(DEFAULT_CONTENT_PACK, 'corky')

    expect(corky).toBeDefined()
    for (const state of CHARACTER_STATES) {
      expect(corky?.states[state].still).toMatch(/\.webp$/u)
      expect(corky?.states[state].alt.length).toBeGreaterThan(0)
    }
  })

  it('gives every built-in Pull its own character', () => {
    // A custom Pull deliberately has none; the built-in six must not.
    for (const option of pullOptions) {
      expect(findPullCharacter(DEFAULT_CONTENT_PACK, option.id)).toBeDefined()
    }
  })

  it('has no authored character for a custom Pull', () => {
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, 'custom')).toBeUndefined()
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, undefined)).toBeUndefined()
  })

  it('keeps the V1 cue-entity API as an alias', () => {
    expect(DEFAULT_CONTENT_PACK.cueEntities).toBe(
      DEFAULT_CONTENT_PACK.pullCharacters,
    )
    expect(findCueEntity(DEFAULT_CONTENT_PACK, 'snacking')).toBe(
      findPullCharacter(DEFAULT_CONTENT_PACK, 'snacking'),
    )
  })

  it('defines every line that a moment references', () => {
    // This is the check that stops a content edit from throwing at runtime:
    // `resolveMoment` trusts the pack, and this is why it can.
    for (const definition of Object.values(MOMENTS)) {
      expect(definition.lineIds.length).toBeGreaterThan(0)
      for (const lineId of definition.lineIds) {
        expect(
          findLine(DEFAULT_CONTENT_PACK, lineId),
          `moment "${definition.id}" references missing line "${lineId}"`,
        ).toBeDefined()
      }
    }
  })

  it('defines the exact Meet caption for every built-in Pull preview', () => {
    for (const option of pullOptions) {
      expect(
        findLine(DEFAULT_CONTENT_PACK, option.previewLineId),
        `Pull "${option.id}" references missing preview line "${option.previewLineId}"`,
      ).toBeDefined()
    }
  })

  it('reports every fault at once rather than the first', () => {
    const invalidPullCharacters = [
      ...DEFAULT_CONTENT_PACK.pullCharacters,
      {
        id: 'not-a-pull',
        name: 'Ghost',
        token: { still: '/x.webp', alt: '' },
        noticeOverlay: { still: '/y.webp', alt: '' },
        voiceNote: '',
      },
    ]
    const problems = validateContentPack({
      ...DEFAULT_CONTENT_PACK,
      leadCharacterId: 'nobody',
      pullCharacters: invalidPullCharacters,
      cueEntities: invalidPullCharacters,
      lines: [
        ...DEFAULT_CONTENT_PACK.lines,
        { id: 'core.two-sides', text: 'Duplicate.' },
      ],
    })

    expect(problems).toHaveLength(4)
    expect(problems.join('\n')).toMatch(/nobody/u)
    expect(problems.join('\n')).toMatch(/not-a-pull/u)
    expect(problems.join('\n')).toMatch(/declared twice/u)
  })

  it('points every asset slot at a file that exists', () => {
    // The URLs are built from template literals, so nothing catches a renamed
    // or missing render until a screen shows a broken image on a device. This
    // does, at test time, for every tier of every slot.
    // Vitest roots at the package directory. Asserting that first means a
    // wrong root fails as "no public directory" rather than as every asset
    // being missing at once.
    const publicDir = `${process.cwd()}/public`
    expect(existsSync(publicDir), `no public directory at ${publicDir}`).toBe(
      true,
    )
    const slots = [
      ...DEFAULT_CONTENT_PACK.characters.flatMap((character) =>
        CHARACTER_STATES.map((state) => character.states[state]),
      ),
      ...[
        ...DEFAULT_CONTENT_PACK.pullCharacters,
        GENERIC_PULL_CHARACTER,
      ].flatMap((pullCharacter) => [
        pullCharacter.token,
        pullCharacter.noticeOverlay,
      ]),
    ]

    const missing = slots
      .flatMap((slot) => assetUrls(slot))
      // `BASE_URL` is the app's mount point; on disk everything sits under
      // `public`, so strip the leading slash and join.
      .map((url) => ({ url, path: `${publicDir}/${url.replace(/^\/+/u, '')}` }))
      .filter((entry) => !existsSync(entry.path))
      .map((entry) => entry.url)

    expect(missing).toEqual([])
    expect(slots.length).toBeGreaterThan(0)
  })

  it('uses the approved versioned Pull studies with literal descriptions', () => {
    for (const pullCharacter of DEFAULT_CONTENT_PACK.pullCharacters) {
      expect(pullCharacter.token.still).toMatch(
        /[/]art[/]pulls[/]pull-.+-nanobanana-v0_1-512[.]webp$/u,
      )
      expect(pullCharacter.token.alt).toMatch(
        new RegExp(`^${pullCharacter.name}`, 'u'),
      )
      expect(pullCharacter.token.alt).not.toMatch(/standing in|placeholder/iu)
    }
  })

  it('keeps every user-facing cue description broad and neutral', () => {
    const publicCopy = [
      ...pullOptions.flatMap((option) => [
        option.label,
        option.moment,
        ...option.suggestions,
      ]),
      ...DEFAULT_CONTENT_PACK.pullCharacters.flatMap((character) => [
        character.name,
        character.token.alt,
        character.voiceNote,
      ]),
    ].join('\n')

    expect(publicCopy).not.toMatch(/alcohol|smok|vap|takeaway/iu)
  })

  it('maps unpublished legacy pull ids to the neutral cast', () => {
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, 'alcohol-ritual')?.id).toBe(
      'familiar-ritual',
    )
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, 'smoking-vaping')?.id).toBe(
      'two-minute-pause',
    )
    expect(findPullCharacter(DEFAULT_CONTENT_PACK, 'takeaway')?.id).toBe(
      'one-tap-convenience',
    )
  })

  it('keeps spoken character lines free of sensitive legacy interpretations', () => {
    // Pull characters may name themselves after a deliberate in-app selection,
    // but neutral V2 profiles must never reveal the unpublished substance- or
    // purchase-specific interpretations that used to sit behind three ids.
    const pullWords = /alcohol|smok|vap|takeaway/iu
    for (const line of DEFAULT_CONTENT_PACK.lines) {
      expect(line.text, `line "${line.id}" names a pull`).not.toMatch(pullWords)
    }
  })
})
