import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assetUrls } from './assets'
import { MOMENTS } from './moments'
import { CHARACTER_STATES, DEFAULT_CONTENT_PACK, findCharacter, findCueEntity, findLine, GENERIC_CUE_ENTITY, validateContentPack, } from './pack'
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

  it('gives every built-in pull a cue entity', () => {
    // A custom pull deliberately has none; the built-in six must not.
    for (const option of pullOptions) {
      expect(findCueEntity(DEFAULT_CONTENT_PACK, option.id)).toBeDefined()
    }
  })

  it('has no entity for a pull that does not exist', () => {
    expect(findCueEntity(DEFAULT_CONTENT_PACK, 'custom')).toBeUndefined()
    expect(findCueEntity(DEFAULT_CONTENT_PACK, undefined)).toBeUndefined()
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

  it('reports every fault at once rather than the first', () => {
    const problems = validateContentPack({
      ...DEFAULT_CONTENT_PACK,
      leadCharacterId: 'nobody',
      cueEntities: [
        ...DEFAULT_CONTENT_PACK.cueEntities,
        {
          id: 'not-a-pull',
          name: 'Ghost',
          token: { still: '/x.webp', alt: '' },
          noticeOverlay: { still: '/y.webp', alt: '' },
          voiceNote: '',
        },
      ],
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
      ...[...DEFAULT_CONTENT_PACK.cueEntities, GENERIC_CUE_ENTITY].flatMap(
        (cueEntity) => [cueEntity.token, cueEntity.noticeOverlay],
      ),
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

  it('keeps runtime art honest while authored readiness stays with its source', () => {
    for (const cueEntity of DEFAULT_CONTENT_PACK.cueEntities) {
      expect(cueEntity.token.alt).toMatch(/standing in/iu)
    }
  })

  it('keeps every user-facing cue description broad and neutral', () => {
    const publicCopy = [
      ...pullOptions.flatMap((option) => [
        option.label,
        option.moment,
        ...option.suggestions,
      ]),
      ...DEFAULT_CONTENT_PACK.cueEntities.flatMap((entity) => [
        entity.name,
        entity.token.alt,
        entity.voiceNote,
      ]),
    ].join('\n')

    expect(publicCopy).not.toMatch(/alcohol|smok|vap|takeaway/iu)
  })

  it('maps unpublished legacy pull ids to the neutral cast', () => {
    expect(findCueEntity(DEFAULT_CONTENT_PACK, 'alcohol-ritual')?.id).toBe(
      'familiar-ritual',
    )
    expect(findCueEntity(DEFAULT_CONTENT_PACK, 'smoking-vaping')?.id).toBe(
      'two-minute-pause',
    )
    expect(findCueEntity(DEFAULT_CONTENT_PACK, 'takeaway')?.id).toBe(
      'one-tap-convenience',
    )
  })

  it('keeps a spoken line free of the pull it belongs to', () => {
    // Shipped constraint: private text stays off the lock screen, and audio
    // played from a phone speaker in a quiet room deserves the same care.
    const pullWords =
      /scroll|snack|drink|alcohol|smok|vap|takeaway|procrastinat/iu
    for (const line of DEFAULT_CONTENT_PACK.lines) {
      expect(line.text, `line "${line.id}" names a pull`).not.toMatch(pullWords)
    }
  })
})
