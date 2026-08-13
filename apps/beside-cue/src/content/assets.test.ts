import { describe, expect, it } from 'vitest'
import type { AssetSlot } from './assets'
import { assetUrls, resolveAsset } from './assets'

const still: AssetSlot = { still: '/a/still.webp', alt: 'A still.' }

const everything: AssetSlot = {
  ...still,
  frames: { urls: ['/a/f1.webp', '/a/f2.webp'], fps: 12, loop: false },
  video: '/a/clip.webm',
  model: '/a/character.glb',
}

describe('asset tiers', () => {
  it('falls back to the still when a slot has nothing else', () => {
    const resolved = resolveAsset(still, { reducedMotion: false })

    expect(resolved.tier).toBe('still')
    expect(resolved.still).toBe('/a/still.webp')
    expect(resolved.alt).toBe('A still.')
  })

  it('prefers video over frames when both exist', () => {
    const resolved = resolveAsset(everything, { reducedMotion: false })

    expect(resolved.tier).toBe('video')
    expect(resolved.video).toBe('/a/clip.webm')
  })

  it('uses frames when there is no video', () => {
    const { video: _video, model: _model, ...slot } = everything
    const resolved = resolveAsset(slot, { reducedMotion: false })

    expect(resolved.tier).toBe('frames')
    expect(resolved.frames?.urls).toHaveLength(2)
  })

  it('gives a still to anyone who asked for less motion', () => {
    // Not a quality setting: a request for reduced motion outranks every tier
    // the slot happens to carry.
    const resolved = resolveAsset(everything, { reducedMotion: true })

    expect(resolved.tier).toBe('still')
    expect(resolved.heldBack).toBe('reduced-motion')
    expect(resolved.video).toBeUndefined()
    expect(resolved.frames).toBeUndefined()
  })

  it('honours a ceiling so one surface can stay calmer than another', () => {
    const resolved = resolveAsset(everything, {
      reducedMotion: false,
      ceiling: 'frames',
    })

    expect(resolved.tier).toBe('frames')
    expect(resolved.video).toBeUndefined()
  })

  it('drops to the still when the ceiling excludes every richer tier', () => {
    const resolved = resolveAsset(everything, {
      reducedMotion: false,
      ceiling: 'still',
    })

    expect(resolved.tier).toBe('still')
    expect(resolved.heldBack).toBe('ceiling')
  })

  it('never selects the model tier, and says why', () => {
    // The GLB slot is reserved data. Selecting it would mean claiming a
    // renderer this app has deliberately not shipped.
    const resolved = resolveAsset(
      { ...still, model: '/a/character.glb' },
      { reducedMotion: false },
    )

    expect(resolved.tier).toBe('still')
    expect(resolved.heldBack).toBe('no-renderer')
  })

  it('ignores an empty frame sequence', () => {
    const resolved = resolveAsset(
      { ...still, frames: { urls: [], fps: 12, loop: true } },
      { reducedMotion: false },
    )

    expect(resolved.tier).toBe('still')
  })

  it('lists every file a slot could request, richest first', () => {
    expect(assetUrls(everything)).toEqual([
      '/a/character.glb',
      '/a/clip.webm',
      '/a/f1.webp',
      '/a/f2.webp',
      '/a/still.webp',
    ])
  })
})
