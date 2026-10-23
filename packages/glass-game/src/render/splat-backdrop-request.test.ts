// Splat backdrop request — only well-formed development queries ask for splats.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SPLAT_BACKDROP_SEED, parseSplatBackdropRequest, } from './splat-backdrop-request'

const parse = (search: string) =>
  parseSplatBackdropRequest(new URLSearchParams(search))

describe('parseSplatBackdropRequest', () => {
  it('draws nothing without a splats parameter', () => {
    expect(parse('layout=cloudway')).toBeUndefined()
  })

  it('reads a procedural world and its seed', () => {
    expect(parse('splats=procedural')).toEqual({
      kind: 'procedural',
      seed: DEFAULT_SPLAT_BACKDROP_SEED,
    })
    expect(parse('splats=procedural&splatsSeed=42')).toEqual({
      kind: 'procedural',
      seed: 42,
    })
  })

  it('rejects a seed that is not a whole number in range', () => {
    expect(parse('splats=procedural&splatsSeed=1.5')).toBeUndefined()
    expect(parse('splats=procedural&splatsSeed=-3')).toBeUndefined()
    expect(parse('splats=procedural&splatsSeed=nope')).toBeUndefined()
  })

  it('accepts same-site paths and https splat files', () => {
    expect(parse('splats=/worlds/cloudway-lod.rad')).toEqual({
      kind: 'url',
      url: '/worlds/cloudway-lod.rad',
      scale: 1,
      offsetY: 0,
    })
    expect(
      parse('splats=https://cdn.example.com/w.spz&splatsScale=2.5&splatsY=-4'),
    ).toEqual({
      kind: 'url',
      url: 'https://cdn.example.com/w.spz',
      scale: 2.5,
      offsetY: -4,
    })
    expect(parse('splats=../games/worlds/a.ply?v=2')?.kind).toBe('url')
  })

  it('refuses other schemes, protocol-relative hosts and other file types', () => {
    expect(parse('splats=http://example.com/w.spz')).toBeUndefined()
    expect(parse('splats=//example.com/w.spz')).toBeUndefined()
    expect(parse('splats=javascript:alert(1).spz')).toBeUndefined()
    expect(parse('splats=/worlds/readme.txt')).toBeUndefined()
  })

  it('refuses repeated parameters and out-of-range placement', () => {
    expect(parse('splats=procedural&splats=/a.spz')).toBeUndefined()
    expect(parse('splats=/a.spz&splatsScale=0')).toBeUndefined()
    expect(parse('splats=/a.spz&splatsY=9000')).toBeUndefined()
    expect(parse(`splats=/${'a'.repeat(2050)}.spz`)).toBeUndefined()
  })
})
