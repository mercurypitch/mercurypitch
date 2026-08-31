// ============================================================
// Pull catalog tests — neutral anchors and structured Side B choices
// ============================================================

import { describe, expect, it } from 'vitest'
import { ACTION_DEFINITIONS } from './actions'
import { BUILT_IN_PULL_IDS, canonicalPullId, findPullOption, pullOptions, } from './pulls'

describe('Pull catalog', () => {
  it('keeps the approved six canonical ids and public labels', () => {
    expect(pullOptions.map((option) => option.id)).toEqual(BUILT_IN_PULL_IDS)
    expect(pullOptions.map((option) => option.label)).toEqual([
      'Endless scrolling',
      'Automatic snacking',
      'Familiar ritual',
      'Familiar break',
      'One-tap convenience',
      'Putting it off',
    ])
    expect(pullOptions.map((option) => option.defaultSideAText)).toEqual([
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

  it('gives every built-in Side B choice one stable identity', () => {
    const ids = pullOptions.flatMap((option) =>
      option.bSideSuggestions.map((suggestion) => suggestion.id),
    )

    expect(ids).toHaveLength(18)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('offers structured neutral contexts for every built-in Pull', () => {
    const anchors = pullOptions.flatMap((option) => option.anchorSuggestions)

    expect(anchors).toHaveLength(18)
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
})
