// ============================================================
// Localized pack contract — matched dialogue, translated art, shared ambience
// ============================================================

import { describe, expect, it } from 'vitest'
import { findDialogueAudioAssetForLine } from './audio-manifest'
import { LOCALIZED_CHARACTER_VOICE_RECORDINGS, WITHHELD_LOCALIZED_VOICE_LINE_IDS, } from './localized-character-voice-recordings'
import { getLocalizedContentPack, getLocalizedGenericPullCharacter, } from './localized-pack'
import { getRecordedVoiceLines, getVoiceLines } from './localized-voice-lines'
import { CHARACTER_STATES, DEFAULT_CONTENT_PACK, validateContentPack, } from './pack'
import { PREMIUM_PULL_IDS } from './premium-pulls'
import { FREE_PULL_IDS, pullOptions } from './pulls'
import { createVoicePlayer } from './voice'

describe('localized content pack', () => {
  it('localizes the custom Pull fallback without adding an extra selectable character', () => {
    const english = getLocalizedGenericPullCharacter('en')
    for (const locale of ['es', 'de'] as const) {
      const generic = getLocalizedGenericPullCharacter(locale)
      expect(generic.id).toBe('generic')
      expect(generic.token.still).toBe(english.token.still)
      expect(generic.noticeOverlay).toBe(english.noticeOverlay)
      expect(generic.name).not.toBe(english.name)
      expect(generic.token.alt).not.toBe(english.token.alt)
      expect(
        getLocalizedContentPack(locale).pullCharacters.some(
          (character) => character.id === generic.id,
        ),
      ).toBe(false)
    }
  })
  it('reuses the exact English pack and caches localized packs', () => {
    expect(getLocalizedContentPack('en')).toBe(DEFAULT_CONTENT_PACK)
    expect(getLocalizedContentPack('es')).toBe(getLocalizedContentPack('es'))
    expect(getLocalizedContentPack('de')).toBe(getLocalizedContentPack('de'))
  })

  it.each(['es', 'de'] as const)(
    'keeps %s captions and registered deliveries together',
    (locale) => {
      const pack = getLocalizedContentPack(locale)
      expect(validateContentPack(pack)).toEqual([])
      expect(pack.id).toBe(`${DEFAULT_CONTENT_PACK.id}-${locale}`)
      expect(pack.audio.locale).toBe(locale)
      expect(pack.lines).toBe(getVoiceLines(locale))
      expect(pack.lines).toHaveLength(67)
      const dialogue = pack.audio.assets.filter(
        (asset) => asset.lane === 'dialogue',
      )
      expect(dialogue).toHaveLength(42)
      expect(LOCALIZED_CHARACTER_VOICE_RECORDINGS[locale]).toHaveLength(42)
      const allowedIds = new Set(
        getRecordedVoiceLines(locale)
          .filter(
            (line) =>
              !WITHHELD_LOCALIZED_VOICE_LINE_IDS[locale].includes(line.id),
          )
          .map((line) => line.id),
      )
      expect(dialogue.map((asset) => asset.dialogue.lineId).sort()).toEqual(
        [...allowedIds].sort(),
      )
      for (const asset of dialogue) {
        expect(allowedIds.has(asset.dialogue.lineId)).toBe(true)
        const line = getVoiceLines(locale).find(
          (candidate) => candidate.id === asset.dialogue.lineId,
        )!
        expect(asset.dialogue.captionSha256).toBe(line.captionSha256)
        for (const source of asset.sources)
          expect(source.src).toContain(`/audio/voice/${locale}/`)
      }
      const declarations = new Set(
        LOCALIZED_CHARACTER_VOICE_RECORDINGS[locale].map((line) => line.lineId),
      )
      const player = createVoicePlayer({ pack })
      for (const line of pack.lines)
        expect(player.hasRecording(line.id), line.id).toBe(
          declarations.has(line.id),
        )
      player.dispose()
    },
  )

  it.each(['es', 'de'] as const)(
    'keeps %s premium captions silent even though English voices exist',
    (locale) => {
      const pack = getLocalizedContentPack(locale)
      for (const id of PREMIUM_PULL_IDS) {
        const lines = getVoiceLines(locale).filter((line) =>
          line.id.startsWith(`pull.${id}.`),
        )
        expect(lines).toHaveLength(3)
        for (const line of lines) {
          expect(
            findDialogueAudioAssetForLine(pack.audio, {
              lineId: line.id,
              captionSha256: line.captionSha256,
            }),
          ).toBeUndefined()
        }
      }
      expect(
        validateContentPack({
          ...pack,
          audio: DEFAULT_CONTENT_PACK.audio,
        }).join(' '),
      ).toContain('not bound to a line')
    },
  )

  it.each(['es', 'de'] as const)(
    'shares %s nonverbal media without changing identities or visuals',
    (locale) => {
      const pack = getLocalizedContentPack(locale)
      const common = DEFAULT_CONTENT_PACK.audio.assets.filter(
        (asset) => asset.lane !== 'dialogue',
      )
      expect(common).toHaveLength(3)
      expect(
        pack.audio.assets.filter((asset) => asset.lane !== 'dialogue'),
      ).toEqual(common)
      for (const asset of common)
        expect(
          pack.audio.assets.find((candidate) => candidate.id === asset.id),
        ).toBe(asset)
      expect(pack.cueEntities).toBe(pack.pullCharacters)
      expect(
        pack.pullCharacters.map((character) => character.id).sort(),
      ).toEqual(pullOptions.map((pull) => pull.id).sort())
      for (const character of pack.pullCharacters) {
        const original = DEFAULT_CONTENT_PACK.pullCharacters.find(
          (candidate) => candidate.id === character.id,
        )!
        expect(character.name).toBe(original.name)
        expect(character.token.still).toBe(original.token.still)
        expect(character.noticeOverlay).toBe(original.noticeOverlay)
      }
      for (const state of CHARACTER_STATES) {
        const localized = pack.characters[0]!.states[state]
        const original = DEFAULT_CONTENT_PACK.characters[0]!.states[state]
        expect(localized.still).toBe(original.still)
        expect(localized.alt).not.toBe(original.alt)
      }
      for (const id of FREE_PULL_IDS) {
        const character = pack.pullCharacters.find(
          (candidate) => candidate.id === id,
        )!
        expect(character.token.alt).toContain(character.name)
        expect(character.token.alt.length).toBeGreaterThan(
          character.name.length,
        )
      }
    },
  )
})
