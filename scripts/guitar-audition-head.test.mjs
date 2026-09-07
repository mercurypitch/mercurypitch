// Developer audition head — pure transfer and actual graph-construction contracts.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { AUDITION_HEAD_PROFILES, AUDITION_HEAD_SETTINGS, auditionSoftClip, createAuditionCurve, createAuditionHead, getAuditionHeadSettings, } from './guitar-audition-head.mjs'

function createContext({ failShaper = false } = {}) {
  const created = []
  const make = (kind) => {
    const node = {
      kind,
      connections: [],
      disconnected: 0,
      gain: { value: 1 },
      frequency: { value: 350 },
      Q: { value: 1 },
      connect(destination) {
        this.connections.push(destination)
        return destination
      },
      disconnect() {
        this.connections = []
        this.disconnected++
      },
    }
    created.push(node)
    return node
  }
  return {
    created,
    sampleRate: 48000,
    destination: { kind: 'destination' },
    createGain: () => make('gain'),
    createBiquadFilter: () => make('filter'),
    createWaveShaper: () => {
      if (failShaper) throw new Error('injected shaper allocation failure')
      return make('shaper')
    },
  }
}

test('the original audition settings and lookup bytes remain the owner listening control', () => {
  assert.deepEqual(AUDITION_HEAD_SETTINGS, {
    curveLength: 4097,
    oversample: '4x',
    preampGain: 9,
    interstageGain: 2.5,
    powerDrive: 1.3,
    envelopeHz: 10,
    sagDepth: 0.22,
    outputGain: 0.3,
  })
  // Recorded before adding profiles, not calculated from a duplicate transfer.
  // Explicit little-endian packing keeps the original Float32 bytes portable.
  const originalHashes = {
    preamp: 'e115988674b883218149df710632957c03697bfd52e50823447bd48080aa1a43',
    interstage:
      '2592de4521f4e647ac53f77881046c6f64fc90d5946e0ddc502ec1464949cb00',
    power: 'd79440dad037acae243e86d07fa1b1a91be2384b4ac579885372044c523a3a42',
    rectify: 'b2250a539046de8cc8861964af998c814f68db2d5d22ebbb84c07e38534294a0',
    envelope:
      'bca0200debbe8c6fd6f6f3e89679d0e541ec530db042034fdad222e88c1decb5',
  }
  for (const [kind, expectedHash] of Object.entries(originalHashes)) {
    const curve = createAuditionCurve(kind)
    const bytes = new Uint8Array(curve.byteLength)
    const view = new DataView(bytes.buffer)
    curve.forEach((sample, index) => view.setFloat32(index * 4, sample, true))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash)
    assert.deepEqual(createAuditionCurve(kind, 'original'), curve)
  }
})

test('profile settings are immutable fixed recipes and reject unknown names before allocation', () => {
  assert.deepEqual(Object.keys(AUDITION_HEAD_PROFILES), [
    'original',
    'articulate',
    'tight',
  ])
  assert.ok(Object.isFrozen(AUDITION_HEAD_PROFILES))
  for (const profile of Object.keys(AUDITION_HEAD_PROFILES)) {
    const settings = getAuditionHeadSettings(profile)
    assert.equal(settings, AUDITION_HEAD_PROFILES[profile])
    assert.ok(Object.isFrozen(settings))
    assert.equal(settings.oversample, '4x')
    assert.ok(
      Object.entries(settings).every(
        ([key, value]) => key === 'oversample' || Number.isFinite(value),
      ),
    )
    assert.ok(settings.preampGain >= 1 && settings.preampGain <= 9)
    assert.ok(settings.interstageGain >= 1 && settings.interstageGain <= 2.5)
    assert.ok(settings.sagDepth >= 0 && settings.sagDepth <= 0.22)
    assert.ok(settings.preBassDb >= -6 && settings.preBassDb <= 0)
    assert.ok(settings.bodyDb >= 0 && settings.bodyDb <= 3)
  }
  for (const profile of ['unknown', 'constructor', '__proto__']) {
    const context = createContext()
    assert.throws(
      () => createAuditionHead(context, { profile }),
      /Unknown audition head profile/,
    )
    assert.throws(
      () => createAuditionCurve('power', profile),
      /Unknown audition head profile/,
    )
    assert.equal(context.created.length, 0)
  }
})

test('alternative clipping curves keep exact silence, monotonicity and bounded asymmetric saturation', () => {
  for (const profile of ['articulate', 'tight']) {
    for (const kind of ['preamp', 'interstage', 'power']) {
      const curve = createAuditionCurve(kind, profile)
      assert.equal(curve[(curve.length - 1) / 2], 0)
      assert.ok(
        curve.every((value) => Number.isFinite(value) && Math.abs(value) <= 1),
      )
      assert.ok(
        curve.every((value, index) => index === 0 || value >= curve[index - 1]),
      )
      assert.ok(curve[0] < -0.9 && curve.at(-1) > 0.9)
      assert.notDeepEqual(curve, createAuditionCurve(kind))
    }
    assert.deepEqual(
      createAuditionCurve('rectify', profile),
      createAuditionCurve('rectify'),
    )
    assert.deepEqual(
      createAuditionCurve('envelope', profile),
      createAuditionCurve('envelope'),
    )
  }
})

test('non-finite and extreme slope controls stay bounded and monotonic', () => {
  for (const slope of [NaN, Infinity, -Infinity, -100, 0, 1, 100]) {
    const samples = Array.from({ length: 201 }, (_, index) =>
      auditionSoftClip((index - 100) / 100, 0.45, slope),
    )
    assert.equal(samples[100], 0)
    assert.ok(
      samples.every(
        (sample) => Number.isFinite(sample) && Math.abs(sample) <= 1,
      ),
    )
    assert.ok(
      samples.every(
        (sample, index) => index === 0 || sample >= samples[index - 1],
      ),
    )
  }
})

test('soft clipping preserves silence and rejects non-finite input safely', () => {
  assert.equal(auditionSoftClip(0), 0)
  assert.deepEqual(
    [NaN, Infinity, -Infinity].map((value) => auditionSoftClip(value)),
    [0, 0, 0],
  )
})

test('soft clipping is finite, bounded and monotonic under extreme input', () => {
  const output = Array.from({ length: 2001 }, (_, i) =>
    auditionSoftClip((i - 1000) / 100),
  )

  assert.ok(
    output.every((value) => Number.isFinite(value) && Math.abs(value) <= 1),
  )
  assert.ok(
    output.every((value, index) => index === 0 || value >= output[index - 1]),
  )
  assert.ok(output[0] < -0.9 && output.at(-1) > 0.9)
})

test('soft clipping adds asymmetry without a zero-input DC offset', () => {
  assert.ok(Math.abs(auditionSoftClip(0.4) + auditionSoftClip(-0.4)) > 0.02)
  assert.equal(auditionSoftClip(0), 0)
  assert.ok(auditionSoftClip(0.1) > 0.25)
})

test('every lookup curve has an exact silent center and finite bounded values', () => {
  for (const kind of ['preamp', 'interstage', 'power', 'rectify', 'envelope']) {
    const curve = createAuditionCurve(kind)
    assert.equal(curve.length, AUDITION_HEAD_SETTINGS.curveLength)
    assert.equal(curve[(curve.length - 1) / 2], 0)
    assert.ok(
      curve.every((value) => Number.isFinite(value) && Math.abs(value) <= 1),
    )
  }
})

test('rectifier and envelope curves cannot increase sag past its fixed bound', () => {
  const rectifier = createAuditionCurve('rectify')
  const envelope = createAuditionCurve('envelope')
  const depth = AUDITION_HEAD_SETTINGS.sagDepth

  assert.equal(rectifier[0], 1)
  assert.equal(rectifier.at(-1), 1)
  assert.equal(envelope[0], 0)
  assert.equal(envelope.at(-1), 1)
  assert.ok(
    envelope.every(
      (value) => 1 - depth * value >= 0.78 && 1 - depth * value <= 1,
    ),
  )
  assert.throws(() => createAuditionCurve('unknown'), /Unknown audition curve/)
})

test('head routes the fixed-gain serial stages to its output without a destination connection', () => {
  const context = createContext()
  const head = createAuditionHead(context, { sag: false })
  const serial = []
  let current = head.input
  while (current !== head.output && serial.length < 30) {
    serial.push(current)
    assert.equal(current.connections.length, 1)
    current = current.connections[0]
  }

  assert.equal(current, head.output)
  assert.equal(head.input.gain.value, 1)
  assert.equal(head.output.gain.value, 0.3)
  assert.deepEqual(
    serial
      .filter((node) => node.kind === 'shaper')
      .map((node) => node.oversample),
    ['4x', '4x', '4x'],
  )
  assert.ok(serial.some((node) => node.gain.value === 9))
  assert.ok(serial.some((node) => node.gain.value === 2.5))
  assert.ok(serial.filter((node) => node.kind === 'filter').length >= 5)
  assert.ok(
    head.nodes.every(
      (node) => node.connections.includes(context.destination) === false,
    ),
  )
  assert.equal(head.output.connections.length, 0)
  assert.equal(head.nodes.length, 16)
  assert.deepEqual(
    serial
      .filter((node) => node.kind === 'filter')
      .map((node) => [node.type, node.frequency.value, node.Q.value]),
    [
      ['highpass', 70, Math.SQRT1_2],
      ['lowpass', 6500, Math.SQRT1_2],
      ['highpass', 100, Math.SQRT1_2],
      ['lowpass', 4300, Math.SQRT1_2],
      ['highpass', 35, Math.SQRT1_2],
      ['highpass', 25, Math.SQRT1_2],
      ['lowpass', 8500, Math.SQRT1_2],
    ],
  )
  assert.deepEqual(
    serial
      .filter((node) => node.kind === 'gain')
      .map((node) => node.gain.value),
    [1, 9, 2.5, 1, 1.3],
  )
})

test('articulate and tight cut bass before the first clipper and restore body only after the last', () => {
  for (const profile of ['articulate', 'tight']) {
    const context = createContext()
    const settings = getAuditionHeadSettings(profile)
    const head = createAuditionHead(context, { profile, sag: false })
    const serial = [head.input]
    while (serial.at(-1) !== head.output && serial.length < 30) {
      assert.equal(serial.at(-1).connections.length, 1)
      serial.push(serial.at(-1).connections[0])
    }
    assert.equal(serial.at(-1), head.output)
    assert.equal(serial.length, head.nodes.length)
    assert.equal(head.nodes.length, 19)
    const shapers = serial.filter((node) => node.kind === 'shaper')
    assert.equal(shapers.length, 3)
    assert.deepEqual(
      shapers.map((node) => node.oversample),
      ['4x', '4x', '4x'],
    )
    assert.deepEqual(
      shapers.map((node) => node.curve),
      ['preamp', 'interstage', 'power'].map((kind) =>
        createAuditionCurve(kind, profile),
      ),
    )
    const shelves = serial.filter((node) => node.type === 'lowshelf')
    assert.deepEqual(
      shelves.map((node) => [node.frequency.value, node.gain.value]),
      [
        [220, settings.preBassDb],
        [180, settings.bodyDb],
      ],
    )
    assert.ok(serial.indexOf(shelves[0]) < serial.indexOf(shapers[0]))
    assert.ok(serial.indexOf(shelves[1]) > serial.indexOf(shapers[2]))
    const fizz = serial.find((node) => node.type === 'peaking')
    assert.ok(serial.indexOf(fizz) > serial.indexOf(shapers[2]))
    assert.equal(fizz.gain.value, settings.fizzDb)
    assert.equal(fizz.frequency.value, settings.fizzHz)
    assert.deepEqual(
      serial
        .filter((node) => node.kind === 'gain')
        .map((node) => node.gain.value),
      [
        1,
        settings.preampGain,
        settings.interstageGain,
        1,
        settings.powerDrive,
        0.3,
      ],
    )
    assert.ok(
      head.nodes.every(
        (node) => node.connections.includes(context.destination) === false,
      ),
    )
    head.dispose()
    head.dispose()
    assert.ok(context.created.every((node) => node.disconnected === 1))
  }
})

test('each profile uses its declared bounded sag depth without allocating sources or a dry path', () => {
  for (const profile of Object.keys(AUDITION_HEAD_PROFILES)) {
    const head = createAuditionHead(createContext(), { profile })
    const negative = head.nodes.filter(
      (node) => node.kind === 'gain' && node.gain.value < 0,
    )
    assert.equal(negative.length, 1)
    assert.equal(
      negative[0].gain.value,
      -getAuditionHeadSettings(profile).sagDepth,
    )
    assert.equal(head.input.connections.length, 1)
    assert.equal(head.output.connections.length, 0)
    assert.equal(head.nodes.filter((node) => node.kind === 'shaper').length, 5)
    assert.equal(head.nodes.length, profile === 'original' ? 20 : 23)
    head.dispose()
    assert.ok(head.nodes.every((node) => node.disconnected === 1))
  }
})

test('sag branches a rectified slow envelope into power attenuation rather than an audio feedback loop', () => {
  const context = createContext()
  const head = createAuditionHead(context)
  const negative = head.nodes.find(
    (node) => node.kind === 'gain' && node.gain.value < 0,
  )
  const power = head.nodes.find(
    (node) => negative.connections.includes(node.gain) === true,
  )
  const smoothing = head.nodes.find(
    (node) => node.kind === 'filter' && node.frequency.value === 10,
  )
  const clamp = smoothing.connections[0]

  assert.equal(negative.gain.value, -0.22)
  assert.equal(power.gain.value, 1)
  assert.equal(smoothing.type, 'lowpass')
  assert.equal(smoothing.Q.value, 0.5)
  assert.deepEqual(clamp.curve, createAuditionCurve('envelope'))
  assert.deepEqual(clamp.connections, [negative])
  assert.deepEqual(negative.connections, [power.gain])
  assert.ok(
    head.nodes.every((node) => node.connections.includes(head.input) === false),
  )
  assert.ok(head.nodes.some((node) => node.connections.length === 2))
})

test('sag-off does not allocate a hidden envelope branch', () => {
  const head = createAuditionHead(createContext(), { sag: false })

  assert.equal(head.nodes.filter((node) => node.kind === 'shaper').length, 3)
  assert.equal(head.nodes.filter((node) => node.gain.value < 0).length, 0)
})

test('dispose disconnects every owned node exactly once including modulation', () => {
  const context = createContext()
  const head = createAuditionHead(context)

  head.dispose()
  head.dispose()

  assert.equal(head.nodes.length, context.created.length)
  assert.ok(
    context.created.every(
      (node) => node.disconnected === 1 && node.connections.length === 0,
    ),
  )
})

test('construction failure releases partially allocated nodes', () => {
  const context = createContext({ failShaper: true })

  assert.throws(
    () => createAuditionHead(context),
    /injected shaper allocation failure/,
  )

  assert.ok(context.created.length > 0)
  assert.ok(context.created.every((node) => node.disconnected === 1))
})
