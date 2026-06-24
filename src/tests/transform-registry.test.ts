// ============================================================
// Transform Registry Tests
// ============================================================

import { beforeAll, describe, expect, it } from 'vitest'
import { getTransform, getTransforms, registerBuiltinTransforms, registerTransform, } from '@/lib/transform-registry'

describe('transform-registry', () => {
  beforeAll(() => {
    registerBuiltinTransforms()
  })

  it('registerTransform adds a descriptor', () => {
    const before = getTransforms().length
    registerTransform({
      id: 'test-transform',
      name: 'Test Transform',
      description: 'A test transform',
      category: 'spectral',
      version: '1.0.0',
      outputs: [{ id: 'test', name: 'Test Output', annotationType: 'value' }],
    })
    expect(getTransforms().length).toBeGreaterThan(before)
  })

  it('getTransforms filters by category', () => {
    const all = getTransforms()
    const spectral = getTransforms('spectral')
    const pitch = getTransforms('pitch')
    const time = getTransforms('time')
    const key = getTransforms('key')
    const structure = getTransforms('structure')

    expect(
      spectral.length +
        pitch.length +
        time.length +
        key.length +
        structure.length,
    ).toBeLessThanOrEqual(all.length)
    expect(spectral.every((t) => t.category === 'spectral')).toBe(true)
    expect(pitch.every((t) => t.category === 'pitch')).toBe(true)
    expect(time.every((t) => t.category === 'time')).toBe(true)
  })

  it('getTransform returns descriptor by ID', () => {
    const descriptor = getTransform('onset-detector')
    expect(descriptor).toBeDefined()
    expect(descriptor!.name).toBe('Onset & Beat Detector')
    expect(descriptor!.category).toBe('time')
  })

  it('getTransform returns undefined for unknown ID', () => {
    expect(getTransform('nonexistent-transform')).toBeUndefined()
  })

  it('descriptors have required fields', () => {
    const all = getTransforms()
    for (const t of all) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.category).toBeDefined()
      expect(t.version).toBeTruthy()
      expect(t.outputs.length).toBeGreaterThan(0)
    }
  })

  it('builds transforms with parameters', () => {
    const chordDetector = getTransform('chord-detector')
    expect(chordDetector).toBeDefined()
    expect(chordDetector!.minDuration).toBe(3)
    expect(chordDetector!.outputs[0].annotationType).toBe('instant')
  })
})
