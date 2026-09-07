// ============================================================
// Guitar studio head tests pin audition endpoints and graph ownership.
// ============================================================

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { GuitarStudioHeadCurve, GuitarStudioHeadOptions, GuitarStudioHeadProfile, } from './guitar-studio-head'
import { createGuitarStudioHead, createGuitarStudioHeadCurve, getGuitarStudioHeadProfile, normalizeGuitarStudioHeadOptions, shapeGuitarStudioHead, } from './guitar-studio-head'

const heavy: GuitarStudioHeadOptions = { head: 'heavy', character: 0 }
const articulate: GuitarStudioHeadOptions = { head: 'definition', character: 0 }
const tight: GuitarStudioHeadOptions = { head: 'definition', character: 1 }
const lead: GuitarStudioHeadOptions = { head: 'lead', character: 1 }
const clippingKinds: GuitarStudioHeadCurve[] = ['preamp', 'interstage', 'power']

class FakeParam {
  value = 1
}

class FakeNode {
  readonly connections: (FakeNode | FakeParam)[] = []
  disconnected = 0
  readonly gain = new FakeParam()
  readonly frequency = new FakeParam()
  readonly Q = new FakeParam()
  type: BiquadFilterType = 'lowpass'
  curve: Float32Array<ArrayBuffer> | null = null
  oversample: OverSampleType = 'none'

  constructor(
    readonly kind: 'gain' | 'filter' | 'shaper',
    readonly beforeConnect: () => void,
  ) {}

  connect(destination: FakeNode | FakeParam): FakeNode | FakeParam {
    this.beforeConnect()
    this.connections.push(destination)
    return destination
  }

  disconnect(): void {
    this.disconnected++
    this.connections.length = 0
  }
}

function createContext(
  sampleRate = 48000,
  { failAllocation = -1, failConnection = -1 } = {},
) {
  const created: FakeNode[] = []
  let connections = 0
  const make = (kind: FakeNode['kind']): FakeNode => {
    if (created.length === failAllocation) throw new Error('Allocation failed')
    const node = new FakeNode(kind, () => {
      if (connections++ === failConnection) throw new Error('Connection failed')
    })
    created.push(node)
    return node
  }
  const context = {
    sampleRate,
    createGain: () => make('gain'),
    createBiquadFilter: () => make('filter'),
    createWaveShaper: () => make('shaper'),
  } as unknown as BaseAudioContext
  return { context, created }
}

function serialNodes(input: FakeNode, output: FakeNode): FakeNode[] {
  const serial = [input]
  while (serial.at(-1) !== output && serial.length < 30) {
    const next = serial.at(-1)?.connections[0]
    expect(next).toBeInstanceOf(FakeNode)
    serial.push(next as FakeNode)
  }
  expect(serial.at(-1)).toBe(output)
  return serial
}

describe('studio head profiles', () => {
  it('normalizes invalid character to tight and clamps finite values at exact endpoints', () => {
    for (const value of [undefined, NaN, Infinity, -Infinity])
      expect(normalizeGuitarStudioHeadOptions({ character: value })).toEqual(
        tight,
      )
    expect(normalizeGuitarStudioHeadOptions({ character: -4 })).toEqual(
      articulate,
    )
    expect(normalizeGuitarStudioHeadOptions({ character: 4 })).toEqual(tight)
    expect(normalizeGuitarStudioHeadOptions(heavy)).toEqual(heavy)
    expect(normalizeGuitarStudioHeadOptions(lead)).toEqual(lead)
    expect(Object.isFrozen(normalizeGuitarStudioHeadOptions(tight))).toBe(true)
  })

  it('retains every heavy recipe coefficient and ignores its unused character control', () => {
    const profile = getGuitarStudioHeadProfile(heavy)
    expect(profile).toEqual({
      curveLength: 4097,
      oversample: '4x',
      preampGain: 9,
      interstageGain: 2.5,
      powerDrive: 1.3,
      envelopeHz: 10,
      sagDepth: 0.22,
      outputGain: 0.3,
      inputHighpassHz: 70,
      inputLowpassHz: 6500,
      preampSlope: 2.7,
      preampAsymmetry: 0.35,
      couplingHz: 100,
      interstageLowpassHz: 4300,
      interstageSlope: 2.7,
      interstageAsymmetry: -0.2,
      powerCouplingHz: 35,
      powerSlope: 2.7,
      powerAsymmetry: 0.12,
      outputHighpassHz: 25,
      outputLowpassHz: 8500,
      preBassHz: 220,
      preBassDb: 0,
      bodyHz: 180,
      bodyDb: 0,
      fizzHz: 3200,
      fizzQ: 0.8,
      fizzDb: 0,
    })
    expect(getGuitarStudioHeadProfile({ head: 'heavy', character: 1 })).toBe(
      profile,
    )
    expect(Object.isFrozen(profile)).toBe(true)
  })

  it('retains all articulate and tight changes without rounding endpoint coefficients', () => {
    const original = getGuitarStudioHeadProfile(heavy)
    expect(getGuitarStudioHeadProfile(articulate)).toEqual({
      ...original,
      preampGain: 5.5,
      interstageGain: 1.45,
      powerDrive: 1.05,
      preampSlope: 2.35,
      preampAsymmetry: 0.15,
      interstageSlope: 1.55,
      interstageAsymmetry: -0.06,
      powerSlope: 1.2,
      powerAsymmetry: 0.02,
      inputHighpassHz: 75,
      couplingHz: 95,
      interstageLowpassHz: 4500,
      outputLowpassHz: 7500,
      preBassDb: -4,
      bodyDb: 2.5,
      fizzDb: -2.5,
      sagDepth: 0.1,
    })
    expect(getGuitarStudioHeadProfile(tight)).toEqual({
      ...original,
      preampGain: 8,
      interstageGain: 1.8,
      powerDrive: 1.1,
      preampSlope: 2.5,
      preampAsymmetry: 0.2,
      interstageSlope: 1.65,
      interstageAsymmetry: -0.08,
      powerSlope: 1.25,
      powerAsymmetry: 0.04,
      inputHighpassHz: 85,
      couplingHz: 110,
      interstageLowpassHz: 4600,
      outputLowpassHz: 7600,
      preBassDb: -6,
      bodyDb: 3,
      fizzHz: 3400,
      fizzQ: 0.85,
      fizzDb: -2,
      sagDepth: 0.08,
    })
  })

  it('interpolates every numeric field while preserving fixed curve size and oversampling', () => {
    const start = getGuitarStudioHeadProfile(articulate)
    const end = getGuitarStudioHeadProfile(tight)
    for (const character of [0.01, 0.25, 0.5, 0.75, 0.99]) {
      const profile = getGuitarStudioHeadProfile({
        head: 'definition',
        character,
      })
      for (const key of Object.keys(
        start,
      ) as (keyof GuitarStudioHeadProfile)[]) {
        const a = start[key]
        const b = end[key]
        if (typeof a === 'number' && typeof b === 'number') {
          expect(profile[key]).toBe(a + (b - a) * character)
          expect(profile[key]).toBeGreaterThanOrEqual(Math.min(a, b))
          expect(profile[key]).toBeLessThanOrEqual(Math.max(a, b))
        } else expect(profile[key]).toBe(a)
      }
      expect(profile.curveLength).toBe(4097)
      expect(profile.oversample).toBe('4x')
      expect(profile.outputGain).toBe(0.3)
      expect(Object.isFrozen(profile)).toBe(true)
    }
    expect(
      getGuitarStudioHeadProfile({ head: 'definition', character: 0.5 })
        .preampGain,
    ).toBe(6.75)
  })

  it('gives Lead more early saturation, gentler final clipping and its own post-drive mid voicing', () => {
    const profile = getGuitarStudioHeadProfile(lead)
    const rhythm = getGuitarStudioHeadProfile(tight)
    const strong = getGuitarStudioHeadProfile(heavy)
    expect(profile.preampGain).toBeGreaterThan(strong.preampGain)
    expect(profile.powerSlope).toBeLessThan(strong.powerSlope)
    expect(profile.outputGain).toBeLessThan(rhythm.outputGain)
    expect(profile.preBassDb).toBeLessThan(0)
    expect(profile.fizzDb).toBeLessThan(rhythm.fizzDb)
    expect(profile.outputLowpassHz).toBeLessThan(rhythm.outputLowpassHz)
    expect(profile.midVoicing).toEqual({
      frequencyHz: 1200,
      q: 0.7,
      gainDb: 3,
    })
    expect(getGuitarStudioHeadProfile({ head: 'lead', character: 0 })).toBe(
      profile,
    )
    expect(Object.isFrozen(profile)).toBe(true)
    expect(Object.isFrozen(profile.midVoicing)).toBe(true)
    for (const kind of clippingKinds)
      expect(createGuitarStudioHeadCurve(kind, profile)).not.toEqual(
        createGuitarStudioHeadCurve(kind, rhythm),
      )
  })
})

describe('studio head transfer curves', () => {
  // SHA-256 of the already-auditioned Float32 LUT bytes, not a copied DSP implementation.
  it.each([
    [
      heavy,
      [
        'e115988674b883218149df710632957c03697bfd52e50823447bd48080aa1a43',
        '2592de4521f4e647ac53f77881046c6f64fc90d5946e0ddc502ec1464949cb00',
        'd79440dad037acae243e86d07fa1b1a91be2384b4ac579885372044c523a3a42',
      ],
    ],
    [
      articulate,
      [
        'ac5d4663727a983f6b50af8ed31fcc2a4be69f733021d83d6fe40b88358e1644',
        '03bd3e4b7e92a6cd7a34b5ae795faf086870917b05c6aaf85f12a4469f263af8',
        '284e0b2c4c17703481c291fb681f15d84e627619bfaf8af22dd5d92821eda4ea',
      ],
    ],
    [
      tight,
      [
        '6ce02fbc115f0c3ce4fa7eb3a84d894bff3e3f6a136c889f9de04898077528af',
        '56e3563f29f057beb84aa1bdc7feb60b8716c3fc15b025a45fb267d536507533',
        '67e8321dfb26dccc47c3dffdea400fbafa57cb4a8a8497c0cfa6fa7974eb2519',
      ],
    ],
  ] as const)(
    'keeps endpoint %o clipping LUTs byte-identical',
    (options, hashes) => {
      const profile = getGuitarStudioHeadProfile(options)
      for (const [index, kind] of clippingKinds.entries()) {
        const curve = createGuitarStudioHeadCurve(kind, profile)
        const bytes = new Uint8Array(curve.byteLength)
        const view = new DataView(bytes.buffer)
        curve.forEach((value, frame) => view.setFloat32(frame * 4, value, true))
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(
          hashes[index],
        )
      }
    },
  )

  it('preserves exact silence and monotonic bounded clipping throughout the character range', () => {
    for (const options of [
      heavy,
      lead,
      ...[0, 0.1, 0.5, 0.9, 1].map((character) => ({
        head: 'definition' as const,
        character,
      })),
    ]) {
      const profile = getGuitarStudioHeadProfile(options)
      for (const kind of clippingKinds) {
        const curve = createGuitarStudioHeadCurve(kind, profile)
        expect(curve[2048]).toBe(0)
        expect(
          curve.every(
            (value) => Number.isFinite(value) && Math.abs(value) <= 1,
          ),
        ).toBe(true)
        expect(
          curve.every(
            (value, index) => index === 0 || value >= curve[index - 1],
          ),
        ).toBe(true)
        expect(curve[0]).toBeLessThan(-0.9)
        expect(curve.at(-1)).toBeGreaterThan(0.9)
      }
    }
    expect(shapeGuitarStudioHead(0)).toBe(0)
    for (const invalid of [NaN, Infinity, -Infinity])
      expect(shapeGuitarStudioHead(invalid)).toBe(0)
  })

  it('keeps envelope modulation nonnegative and within the profile sag bound', () => {
    for (const options of [heavy, articulate, tight, lead]) {
      const profile = getGuitarStudioHeadProfile(options)
      const rectifier = createGuitarStudioHeadCurve('rectify', profile)
      const envelope = createGuitarStudioHeadCurve('envelope', profile)
      expect(rectifier[0]).toBe(1)
      expect(rectifier[2048]).toBe(0)
      expect(rectifier.at(-1)).toBe(1)
      expect(envelope[0]).toBe(0)
      expect(envelope[2048]).toBe(0)
      expect(envelope.at(-1)).toBe(1)
      expect(
        envelope.every(
          (value) =>
            1 - profile.sagDepth * value >= 1 - profile.sagDepth &&
            1 - profile.sagDepth * value <= 1,
        ),
      ).toBe(true)
    }
  })
})

describe('studio head graph', () => {
  it.each([44100, 48000])(
    'preserves audited graph routing and safe frequencies at %d Hz',
    (rate) => {
      for (const options of [heavy, articulate, tight, lead]) {
        const { context, created } = createContext(rate)
        const stage = createGuitarStudioHead(context, options)
        const profile = getGuitarStudioHeadProfile(options)
        const serial = serialNodes(
          stage.input as unknown as FakeNode,
          stage.output as unknown as FakeNode,
        )
        const shapers = serial.filter((node) => node.kind === 'shaper')
        const filters = serial.filter((node) => node.kind === 'filter')
        const shelves = filters.filter((node) => node.type === 'lowshelf')
        const extraMid = profile.midVoicing === undefined ? 0 : 1
        expect(created).toHaveLength(
          (options.head === 'heavy' ? 20 : 23) + extraMid,
        )
        expect(serial).toHaveLength(
          (options.head === 'heavy' ? 16 : 19) + extraMid,
        )
        expect(stage.input.gain.value).toBe(1)
        expect(stage.output.gain.value).toBe(profile.outputGain)
        expect(shapers.map((node) => node.oversample)).toEqual([
          '4x',
          '4x',
          '4x',
        ])
        expect(shapers.map((node) => node.curve)).toEqual(
          clippingKinds.map((kind) =>
            createGuitarStudioHeadCurve(kind, profile),
          ),
        )
        expect(
          serial
            .filter((node) => node.kind === 'gain')
            .map((node) => node.gain.value),
        ).toEqual([
          1,
          profile.preampGain,
          profile.interstageGain,
          1,
          profile.powerDrive,
          profile.outputGain,
        ])
        expect(
          filters
            .filter((node) => node.type === 'highpass')
            .map((node) => node.frequency.value),
        ).toEqual([
          profile.inputHighpassHz,
          profile.couplingHz,
          profile.powerCouplingHz,
          profile.outputHighpassHz,
        ])
        expect(
          filters
            .filter((node) => node.type === 'lowpass')
            .map((node) => node.frequency.value),
        ).toEqual([
          profile.inputLowpassHz,
          profile.interstageLowpassHz,
          profile.outputLowpassHz,
        ])
        expect(
          created
            .filter((node) => node.kind === 'filter')
            .every(
              (node) =>
                node.frequency.value > 0 && node.frequency.value <= rate * 0.45,
            ),
        ).toBe(true)
        if (options.head === 'heavy') expect(shelves).toHaveLength(0)
        else {
          expect(
            shelves.map((node) => [node.frequency.value, node.gain.value]),
          ).toEqual([
            [220, profile.preBassDb],
            [180, profile.bodyDb],
          ])
          expect(serial.indexOf(shelves[0])).toBeLessThan(
            serial.indexOf(shapers[0]),
          )
          expect(serial.indexOf(shelves[1])).toBeGreaterThan(
            serial.indexOf(shapers[2]),
          )
          expect(
            filters.find(
              (node) =>
                node.type === 'peaking' &&
                node.frequency.value === profile.fizzHz,
            )?.gain.value,
          ).toBe(profile.fizzDb)
        }
        if (profile.midVoicing !== undefined) {
          const mid = filters.find(
            (node) => node.frequency.value === profile.midVoicing?.frequencyHz,
          )!
          expect(mid.type).toBe('peaking')
          expect(mid.gain.value).toBe(profile.midVoicing.gainDb)
          expect(mid.Q.value).toBe(profile.midVoicing.q)
          expect(serial.indexOf(mid)).toBeGreaterThan(
            serial.indexOf(shapers[2]),
          )
        }
        const depth = created.find(
          (node) => node.kind === 'gain' && node.gain.value < 0,
        )
        expect(depth?.gain.value).toBe(-profile.sagDepth)
        expect(depth?.connections).toEqual([
          serial[serial.indexOf(shapers[2]) - 2].gain,
        ])
        const envelope = created.find(
          (node) =>
            node.kind === 'filter' &&
            node.frequency.value === profile.envelopeHz,
        )
        expect(envelope?.Q.value).toBe(0.5)
        expect(shapers[1].connections).toHaveLength(2)
        expect((stage.output as unknown as FakeNode).connections).toHaveLength(
          0,
        )
        expect(
          created.some((node) =>
            node.connections.includes(stage.input as unknown as FakeNode),
          ),
        ).toBe(false)
        expect(Object.isFrozen(stage.nodes)).toBe(true)
        stage.dispose()
        stage.dispose()
        expect(
          created.every(
            (node) => node.disconnected === 1 && node.connections.length === 0,
          ),
        ).toBe(true)
      }
    },
  )

  it('does not share writable lookup tables or mutate the caller options between graphs', () => {
    const options: GuitarStudioHeadOptions = {
      head: 'definition',
      character: 0.5,
    }
    const first = createContext()
    const second = createContext()
    const a = createGuitarStudioHead(first.context, options)
    const b = createGuitarStudioHead(second.context, options)
    const firstCurve = first.created.find(
      (node) => node.kind === 'shaper',
    )?.curve
    const secondCurve = second.created.find(
      (node) => node.kind === 'shaper',
    )?.curve
    expect(firstCurve).toEqual(secondCurve)
    expect(firstCurve).not.toBe(secondCurve)
    expect(options).toEqual({ head: 'definition', character: 0.5 })
    a.dispose()
    b.dispose()
  })

  it.each([
    { failAllocation: 5 },
    { failAllocation: 22 },
    { failConnection: 3 },
    { failConnection: 21 },
  ])('disconnects every partially allocated node when %o fails', (failure) => {
    const { context, created } = createContext(48000, failure)
    expect(() => createGuitarStudioHead(context, tight)).toThrow(/failed/)
    expect(created.length).toBeGreaterThan(0)
    expect(
      created.every(
        (node) => node.disconnected === 1 && node.connections.length === 0,
      ),
    ).toBe(true)
  })
})
