// Glass surfaces — glass casts no solid shadow, and the charge's glow adds to an authored glow instead of blanking it.
import { Color, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { GlassMaterial } from './glass-material'
import { applyStressGlow, castsSolidShadow, isGlassSurface, } from './glass-surfaces'

describe('glass surfaces', () => {
  it('counts transmissive and owned glass as glass', () => {
    expect(
      isGlassSurface(new MeshPhysicalMaterial({ transmission: 0.5 })),
    ).toBe(true)
    expect(isGlassSurface(new GlassMaterial())).toBe(true)
    expect(isGlassSurface(new MeshStandardMaterial())).toBe(false)
    expect(isGlassSurface(new MeshPhysicalMaterial({ transmission: 0 }))).toBe(
      false,
    )
  })

  it('casts a solid shadow only without glass', () => {
    const glass = new MeshPhysicalMaterial({ transmission: 0.9 })
    const gold = new MeshStandardMaterial({ metalness: 1 })
    expect(castsSolidShadow(gold)).toBe(true)
    expect(castsSolidShadow([gold, glass])).toBe(false)
    expect(castsSolidShadow(glass)).toBe(false)
  })

  it('keeps the stress colour and intensity on glass without its own glow', () => {
    const glass = new MeshPhysicalMaterial({ transmission: 0.9 })
    applyStressGlow(glass, 0x3fccbe, 0.4)
    expect(glass.emissive.getHex()).toBe(0x3fccbe)
    expect(glass.emissiveIntensity).toBe(0.4)
    applyStressGlow(glass, 0x3fccbe, 0)
    expect(glass.emissiveIntensity).toBe(0)
  })

  it('keeps an authored glow at rest and adds the stress glow to it', () => {
    const opal = new MeshPhysicalMaterial({
      transmission: 0.9,
      emissive: 0x404040,
      emissiveIntensity: 0.5,
    })
    const authored = opal.emissive.clone().multiplyScalar(0.5)
    applyStressGlow(opal, 0x3fccbe, 0)
    expect(opal.emissive.equals(authored)).toBe(true)
    expect(opal.emissiveIntensity).toBe(1)
    applyStressGlow(opal, 0x3fccbe, 1)
    const expected = authored.clone().add(new Color(0x3fccbe))
    expect(opal.emissive.r).toBeCloseTo(expected.r)
    expect(opal.emissive.b).toBeCloseTo(expected.b)
    applyStressGlow(opal, 0x3fccbe, 0)
    expect(opal.emissive.equals(authored)).toBe(true)
  })
})
