// ============================================================
// Pull catalog tests — neutral anchors and structured Side B choices
// ============================================================

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACTION_DEFINITIONS } from './actions'
import { PREMIUM_PULL_IDS, PREMIUM_PULL_LINES } from './premium-pulls'
import { BUILT_IN_PULL_IDS, canonicalPullId, canSelectPull, findPullOption, FREE_PULL_IDS, freePullOptions, isPremiumPull, pullOptions, } from './pulls'
import { findCanonicalVoiceLine } from './voice-lines'

describe('Pull catalog', () => {
  it('shares every premium beat with the canonical registry without changing access', () => {
    expect(PREMIUM_PULL_LINES.map((line) => line.id)).toEqual(
      PREMIUM_PULL_IDS.flatMap((id) =>
        ['meet', 'present', 'recede'].map((kind) => `pull.${id}.${kind}`),
      ),
    )
    for (const line of PREMIUM_PULL_LINES) {
      expect(line).toBe(findCanonicalVoiceLine(line.id))
      expect(findPullOption(line.speakerId)?.access).toBe('pro')
      expect(canSelectPull(line.speakerId, false)).toBe(false)
      expect(canSelectPull(line.speakerId, true)).toBe(true)
    }
  })

  it('keeps all 24 premium recording captions aligned with the output document', () => {
    const document = readFileSync(
      `${process.cwd()}/docs/premium-pull-voice-recording-pack-2026-09-05.md`,
      'utf8',
    )
    expect(PREMIUM_PULL_LINES).toHaveLength(24)
    expect(new Set(PREMIUM_PULL_LINES.map((line) => line.id)).size).toBe(24)
    for (const line of PREMIUM_PULL_LINES) {
      const row = document
        .split('\n')
        .map((candidate) => candidate.split('|').map((cell) => cell.trim()))
        .find((cells) => cells[1] === `\`${line.id}\``)
      expect(row?.[3], line.id).toBe(line.text)
    }
  })
  it('keeps the approved six canonical ids and public labels', () => {
    expect(pullOptions.map((option) => option.id)).toEqual(BUILT_IN_PULL_IDS)
    expect(freePullOptions.map((option) => option.id)).toEqual(FREE_PULL_IDS)
    expect(freePullOptions.map((option) => option.label)).toEqual([
      'Endless scrolling',
      'Automatic snacking',
      'Familiar ritual',
      'Familiar break',
      'One-tap convenience',
      'Putting it off',
    ])
    expect(freePullOptions.map((option) => option.defaultSideAText)).toEqual([
      'Keep scrolling',
      'Reach for a snack automatically',
      'Follow the usual ritual',
      'Take the familiar pause',
      'Choose the one-tap option',
      'Put off beginning',
    ])
  })

  it('derives the V1 string view from canonical action definitions', () => {
    for (const option of pullOptions) {
      expect(option.suggestions).toEqual(
        option.bSideSuggestions.map((suggestion) => suggestion.label),
      )
      expect(option.bSideSuggestions).toHaveLength(3)
      for (const suggestion of option.bSideSuggestions) {
        expect(ACTION_DEFINITIONS).toContain(suggestion)
      }
    }
  })

  it('preserves the original eighteen action identities, reused by the extra cast', () => {
    const ids = freePullOptions.flatMap((option) =>
      option.bSideSuggestions.map((suggestion) => suggestion.id),
    )

    expect(ids).toHaveLength(18)
    expect(new Set(ids).size).toBe(ids.length)
    for (const option of pullOptions) {
      const optionIds = option.bSideSuggestions.map((action) => action.id)
      expect(new Set(optionIds).size).toBe(3)
      expect(
        optionIds.every((id) =>
          ACTION_DEFINITIONS.some((action) => action.id === id),
        ),
      ).toBe(true)
    }
  })

  it('offers structured neutral contexts for every built-in Pull', () => {
    const anchors = pullOptions.flatMap((option) => option.anchorSuggestions)

    expect(anchors).toHaveLength(42)
    expect(new Set(anchors.map((anchor) => anchor.id)).size).toBe(
      anchors.length,
    )
    for (const option of pullOptions) {
      expect(option.anchorSuggestions).toHaveLength(3)
      expect(
        option.anchorSuggestions.every((anchor) => anchor.text.length > 0),
      ).toBe(true)
    }

    expect(anchors.map((anchor) => anchor.text).join('\n')).not.toMatch(
      /diagnos|addict|failure|weak|bad/iu,
    )
  })

  it('references the stable Meet line for every Pull preview', () => {
    for (const option of pullOptions) {
      expect(option.previewLineId).toBe(`pull.${option.id}.meet`)
    }
  })

  it('resolves legacy ids but leaves custom Pulls free-form', () => {
    expect(canonicalPullId('alcohol-ritual')).toBe('familiar-ritual')
    expect(findPullOption('smoking-vaping')?.id).toBe('two-minute-pause')
    expect(findPullOption('takeaway')?.id).toBe('one-tap-convenience')
    expect(findPullOption('custom')).toBeUndefined()
    expect(findPullOption(undefined)).toBeUndefined()
  })

  it('keeps exactly six originals and custom free, and fails closed for unknown access', () => {
    expect(pullOptions.filter((option) => !isPremiumPull(option))).toHaveLength(
      6,
    )
    expect(
      pullOptions.filter(isPremiumPull).map((option) => option.id),
    ).toEqual(PREMIUM_PULL_IDS)
    for (const id of [
      ...FREE_PULL_IDS,
      'custom',
      'alcohol-ritual',
      'smoking-vaping',
      'takeaway',
    ]) {
      expect(canSelectPull(id, false)).toBe(true)
    }
    for (const id of PREMIUM_PULL_IDS) {
      expect(canSelectPull(id, false)).toBe(false)
      expect(canSelectPull(id, true)).toBe(true)
    }
    expect(canSelectPull(undefined, true)).toBe(false)
    expect(canSelectPull('missing', true)).toBe(false)
    expect(
      canSelectPull('the-tape', false, [
        { ...freePullOptions[0]!, id: 'the-tape' },
      ]),
    ).toBe(false)
  })
})
