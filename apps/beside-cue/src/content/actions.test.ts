// ============================================================
// Side B action tests — durable identity and truthful requirements
// ============================================================

import { describe, expect, it } from 'vitest'
import { ACTION_DEFINITIONS, ACTION_KINDS, ACTION_REQUIREMENTS, CUSTOM_PULL_ACTIONS, findActionDefinition, findActionDefinitionByLegacyValue, resolveActionDefinition, } from './actions'

describe('Side B action registry', () => {
  it('gives every definition a unique stable id unrelated to visible copy', () => {
    const ids = ACTION_DEFINITIONS.map((action) => action.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const action of ACTION_DEFINITIONS) {
      expect(action.id).toMatch(/^bside[.][a-z0-9-]+$/u)
      expect(action.id).not.toBe(action.label)
      expect(action.label.trim().length).toBeGreaterThan(0)
    }
  })

  it('keeps the provider-neutral execution seam wider than current content', () => {
    expect(ACTION_KINDS).toEqual([
      'plain',
      'quiet-timer',
      'guided-audio',
      'external-activity',
    ])
    expect(ACTION_REQUIREMENTS).toEqual([
      'timer',
      'audio-output',
      'external-navigation',
      'network',
      'microphone',
      'haptics',
    ])
    expect(new Set(ACTION_DEFINITIONS.map((action) => action.kind))).toEqual(
      new Set(['plain', 'quiet-timer']),
    )
  })

  it('requires a timer only for definitions that declare a quiet timer', () => {
    for (const action of ACTION_DEFINITIONS) {
      const durationMinutes =
        'durationMinutes' in action ? action.durationMinutes : undefined
      if (action.kind === 'quiet-timer') {
        expect(action.requires).toEqual(['timer'])
        expect(durationMinutes).toBeGreaterThan(0)
      } else {
        expect(action.kind).toBe('plain')
        expect(action.requires).toEqual([])
        expect(durationMinutes).toBeUndefined()
      }
    }
  })

  it('resolves stable ids before supporting V1 copy migration', () => {
    expect(findActionDefinition('bside.guitar-riff')?.label).toBe(
      'Play one guitar riff.',
    )
    expect(findActionDefinitionByLegacyValue('Play one guitar riff')?.id).toBe(
      'bside.guitar-riff',
    )
    expect(resolveActionDefinition('Play one guitar riff.')?.id).toBe(
      'bside.guitar-riff',
    )
    expect(resolveActionDefinition('Something I wrote myself')).toBeUndefined()
  })

  it('gives custom Pull starters stable ids while leaving free text open', () => {
    expect(CUSTOM_PULL_ACTIONS.map((action) => action.id)).toEqual([
      'bside.step-outside',
      'bside.fill-water',
      'bside.begin-tiny-part',
    ])
    expect(CUSTOM_PULL_ACTIONS.every((action) => action.label.length > 0)).toBe(
      true,
    )
  })
})
