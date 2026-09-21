// Voice challenge tests — one capture generation survives references while stale work stays retired.

import { describe, expect, it } from 'vitest'
import type { ChallengeDefinition, GameEvent, LevelDefinition, PitchObservation, } from '../contracts'
import { createGlassGame } from '../core/game'
import type { GlassSound, GlassVoiceSession } from '../host'
import { createVoiceChallenge } from './voice-challenge'

const HOLD = {
  requiredSeconds: 0.1,
  toleranceCents: 75,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.1,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.05,
  maximumSampleAgeMs: 150,
} as const

interface Deferred {
  promise: Promise<void>
  resolve(): void
  reject(error: Error): void
}

function deferred(): Deferred {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

class FakeVoice implements GlassVoiceSession {
  startGate: Deferred | null = null
  latestObservation: PitchObservation | null = null
  stopCount = 0
  subscriptions = 0
  activeSubscriptions = 0
  readonly retained: Array<{
    listener: (observation: PitchObservation, nowMs: number) => void
    stopped?: () => void
    active: boolean
  }> = []

  async start(beforeCapture?: Promise<void>): Promise<void> {
    await beforeCapture
    await this.startGate?.promise
  }

  latest(): PitchObservation | null {
    return this.latestObservation
  }

  subscribe(
    listener: (observation: PitchObservation, nowMs: number) => void,
    stopped?: () => void,
  ): () => void {
    const subscription = { listener, stopped, active: true }
    this.retained.push(subscription)
    this.subscriptions++
    this.activeSubscriptions++
    return () => {
      if (!subscription.active) return
      subscription.active = false
      this.activeSubscriptions--
    }
  }

  emit(observation: PitchObservation, nowMs = observation.capturedAtMs): void {
    for (const subscription of this.retained)
      if (subscription.active) subscription.listener(observation, nowMs)
  }

  emitRetained(
    index: number,
    observation: PitchObservation,
    nowMs = observation.capturedAtMs,
  ): void {
    this.retained[index]?.listener(observation, nowMs)
  }

  stop(): void {
    this.stopCount++
  }
}

class FakeSound implements GlassSound {
  readonly references: number[] = []
  readonly patterns: Array<'gentle-wave' | undefined> = []
  readonly gates: Deferred[] = []
  shatterCount = 0
  disposeCount = 0

  async reference(midi: number, pattern?: 'gentle-wave'): Promise<void> {
    this.references.push(midi)
    this.patterns.push(pattern)
    const gate = this.gates.shift()
    if (gate !== undefined) await gate.promise
  }

  shatter(): void {
    this.shatterCount++
  }

  dispose(): void {
    this.disposeCount++
  }
}

function levelWith(challenge: ChallengeDefinition): LevelDefinition {
  return {
    id: 'voice-challenge-test',
    title: 'Voice challenge test',
    spawn: { position: { x: 0, y: 0, z: 0 }, facingYaw: 0 },
    platforms: [
      {
        id: 'floor',
        kind: 'deck',
        minX: -2,
        maxX: 2,
        minZ: -2,
        maxZ: 2,
        top: 0,
        thickness: 0.25,
        material: 'stone',
      },
    ],
    checkpoints: [
      {
        id: 'start',
        position: { x: 0, y: 0, z: 0 },
        facingYaw: 0,
        radius: 0.4,
      },
    ],
    breakables: [
      {
        id: 'vessel',
        label: 'Vessel',
        position: { x: 0, y: 0, z: 0.7 },
        anchor: { x: 0, y: 0, z: 0 },
        variant: 'goblet',
        optional: false,
        challenge,
      },
    ],
    exit: {
      minX: 1.5,
      maxX: 1.9,
      minZ: -0.3,
      maxZ: 0.3,
      top: 0,
      requiresCompleted: ['vessel'],
    },
    fallBelow: -2,
  }
}

function observation(
  sequence: number,
  midi: number | null,
  capturedAtMs: number,
  overrides: Partial<PitchObservation> = {},
): PitchObservation {
  return {
    sequence,
    captureSeconds: sequence * 0.025,
    capturedAtMs,
    midi,
    confidence: midi === null ? 0 : 0.9,
    ...overrides,
  }
}

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index++) await Promise.resolve()
}

function harness(
  challenge: ChallengeDefinition,
  initialPreferences: Record<string, string> = {},
  suppliedVoices: FakeVoice[] = [new FakeVoice()],
  suppliedSounds: FakeSound[] = [new FakeSound()],
) {
  const level = levelWith(challenge)
  const game = createGlassGame(level)
  for (let index = 0; index < 5; index++)
    game.step({ moveX: 0, moveZ: 0, jumpDown: false }, 1 / 60, index * 16)
  expect(game.snapshot().nearbyBreakableId).toBe('vessel')
  const preferences = new Map(Object.entries(initialPreferences))
  const events: GameEvent[] = []
  const errors: string[] = []
  let canPlay = true
  let clock = 1000
  let voiceIndex = 0
  let soundIndex = 0
  const controller = createVoiceChallenge({
    host: {
      createVoice: () => suppliedVoices[voiceIndex++]!,
      createSound: () => suppliedSounds[soundIndex++]!,
      readPreference: (key) => preferences.get(key) ?? null,
      writePreference: (key, value) => preferences.set(key, value),
    },
    game,
    level,
    canPlay: () => canPlay,
    beforeCapture: () => Promise.resolve(),
    onChange: () => undefined,
    onEvents: (batch) => events.push(...batch),
    onError: (message) => errors.push(message),
    onPauseAudio: () => undefined,
    onReleaseVoice: () => undefined,
    now: () => clock,
  })
  return {
    controller,
    game,
    preferences,
    events,
    errors,
    voices: suppliedVoices,
    sounds: suppliedSounds,
    setCanPlay(value: boolean) {
      canPlay = value
    },
    setClock(value: number) {
      clock = value
    },
    emit(
      voice: FakeVoice,
      value: PitchObservation,
      observedAtMs = value.capturedAtMs,
    ) {
      clock = Math.max(clock, observedAtMs)
      voice.emit(value, observedAtMs)
    },
  }
}

const COMFORTABLE: ChallengeDefinition = {
  kind: 'hold',
  step: { target: 'comfortable', hold: HOLD },
}

const HIGH_HOLD: ChallengeDefinition = {
  kind: 'hold',
  step: { target: 'high', hold: HOLD },
}

const WAVE: ChallengeDefinition = {
  kind: 'settle-wave',
  step: { target: 'comfortable', hold: HOLD },
  wave: {
    requiredCycles: 2,
    minimumExcursionCents: 35,
    maximumExcursionCents: 225,
    minimumCycleSeconds: 0.3,
    maximumCycleSeconds: 2.5,
    minimumWaveSeconds: 1.2,
    maximumCentsPerSecond: 2400,
    smoothingSeconds: 0.045,
  },
}

const PAIR: ChallengeDefinition = {
  kind: 'ordered-pair',
  steps: [
    { target: 'low', hold: HOLD },
    { target: 'high', hold: HOLD },
  ],
  wrongOrder: 'reset',
}

function beginnerWaveCents(seconds: number): number {
  const anchors = [
    [0, 0],
    [0.35, 200],
    [0.7, 0],
    [1.05, -200],
    [1.4, 0],
    [1.75, 200],
    [2.1, 0],
    [2.45, -200],
    [2.8, 0],
  ] as const
  const after = anchors.findIndex(([at]) => at >= seconds)
  if (after <= 0) return anchors[Math.max(0, after)]?.[1] ?? 0
  const [fromTime, fromCents] = anchors[after - 1]
  const [toTime, toCents] = anchors[after]
  const mix = (seconds - fromTime) / (toTime - fromTime)
  return fromCents + (toCents - fromCents) * mix
}

describe('voice challenge controller', () => {
  it('keeps the wave demonstration out of evidence and breaks only after fresh settling and waves', async () => {
    const voice = new FakeVoice()
    const sound = new FakeSound()
    const gate = deferred()
    sound.gates.push(gate)
    const test = harness(WAVE, { 'comfortable-note': '57' }, [voice], [sound])
    const pending = test.controller.start('vessel')
    await flush()
    expect(sound.patterns).toEqual(['gentle-wave'])
    for (let i = 0; i < 140; i++)
      test.emit(
        voice,
        observation(
          i,
          57 + 0.7 * Math.sin(i * 0.025 * 2 * Math.PI),
          1025 + i * 25,
        ),
      )
    expect(test.events).toEqual([])
    gate.resolve()
    await pending
    for (let i = 140; i <= 144; i++)
      test.emit(voice, observation(i, 57, 1025 + i * 25))
    expect(test.controller.snapshot()).toMatchObject({
      stepIndex: 1,
      message: 'Sway twice, then return.',
    })
    expect(test.events.some((event) => event.type === 'break')).toBe(false)
    for (let i = 145; i < 270; i++)
      test.emit(
        voice,
        observation(
          i,
          57 + 0.7 * Math.sin((i - 145) * 0.025 * 2 * Math.PI),
          1025 + i * 25,
        ),
      )
    expect(test.events.filter((event) => event.type === 'break')).toEqual([
      { type: 'break', id: 'vessel' },
    ])
  })

  it('breaks on a deliberate whole-tone wave with a brief pitch dropout and latches before trailing silence', async () => {
    const test = harness(WAVE, { 'comfortable-note': '57' })
    await test.controller.start('vessel')
    for (let sequence = 0; sequence <= 4; sequence++)
      test.emit(test.voices[0], observation(sequence, 57, 1025 + sequence * 25))
    expect(test.controller.snapshot().stepIndex).toBe(1)

    for (let sample = 0; sample <= 112; sample++) {
      const sequence = sample + 5
      const seconds = sample * 0.025
      const midi =
        sample === 52 || sample === 53
          ? null
          : 57 + beginnerWaveCents(seconds) / 100
      test.emit(
        test.voices[0],
        observation(sequence, midi, 1025 + sequence * 25),
      )
      if (sample === 98) {
        expect(
          Math.round((test.game.snapshot().activeEncounter?.charge ?? 0) * 100),
        ).toBe(98)
        expect(test.events.some((event) => event.type === 'break')).toBe(false)
      }
    }

    expect(test.events.filter((event) => event.type === 'break')).toEqual([
      { type: 'break', id: 'vessel' },
    ])
    expect(test.game.saveProgress().completedBreakableIds).toEqual(['vessel'])
    test.emit(test.voices[0], observation(118, null, 3975))
    expect(test.game.saveProgress().completedBreakableIds).toEqual(['vessel'])
    expect(test.events.filter((event) => event.type === 'break')).toHaveLength(
      1,
    )
    test.controller.completeBreak()
    expect(test.sounds[0].shatterCount).toBe(1)
  })

  it('cancels a settled wave and ignores its retained microphone callback', async () => {
    const test = harness(WAVE, { 'comfortable-note': '57' })
    await test.controller.start('vessel')
    for (let i = 0; i <= 4; i++)
      test.emit(test.voices[0], observation(i, 57, 1025 + i * 25))
    expect(test.controller.snapshot().stepIndex).toBe(1)
    test.controller.cancel()
    for (let i = 5; i < 160; i++)
      test.voices[0].emitRetained(
        0,
        observation(
          i,
          57 + 0.7 * Math.sin(i * 0.025 * 2 * Math.PI),
          1025 + i * 25,
        ),
      )
    expect(test.game.snapshot().activeEncounter).toBeNull()
    expect(test.game.saveProgress().completedBreakableIds).toEqual([])
    expect(test.events.some((event) => event.type === 'break')).toBe(false)
  })

  it('preserves the stored comfortable-note hold flow and break contract', async () => {
    const test = harness(COMFORTABLE, { 'comfortable-note': '57' })
    await test.controller.start('vessel')

    expect(test.controller.snapshot()).toMatchObject({
      mode: 'singing',
      target: 57,
      encounterId: 'vessel',
      pair: false,
    })
    expect(test.sounds[0].references).toEqual([57])
    for (let sequence = 0; sequence <= 4; sequence++)
      test.emit(test.voices[0], observation(sequence, 57, 1025 + sequence * 25))
    expect(test.events).toEqual([{ type: 'break', id: 'vessel' }])
    test.controller.completeBreak()
    expect(test.controller.snapshot().mode).toBe('off')
    expect(test.sounds[0].shatterCount).toBe(1)
  })

  it('uses only fresh monotonic evidence for comfortable-note calibration', async () => {
    const test = harness(COMFORTABLE)
    await test.controller.start('vessel')
    expect(test.controller.snapshot().message).toBe('Hum a comfortable note.')

    for (let sequence = 0; sequence < 20; sequence++)
      test.emit(
        test.voices[0],
        observation(sequence, 57, 0),
        1000 + sequence * 25,
      )
    expect(test.controller.snapshot().mode).toBe('finding')
    for (let sequence = 20; sequence <= 38; sequence++) {
      const capturedAtMs = 1000 + sequence * 25
      test.emit(test.voices[0], observation(sequence, 57.1, capturedAtMs))
    }
    await flush()
    expect(test.preferences.get('comfortable-note')).toBe('57')
    expect(test.controller.snapshot().mode).toBe('singing')
  })

  it('collects low before high, stores low alone, and gently rejects overlapping bands', async () => {
    const test = harness(PAIR)
    await test.controller.start('vessel')
    expect(test.controller.snapshot().findingTarget).toBe('low')

    for (let sequence = 0; sequence <= 18; sequence++)
      test.emit(test.voices[0], observation(sequence, 57, 1000 + sequence * 25))
    await flush()
    expect(test.controller.snapshot().findingTarget).toBe('high')
    expect(JSON.parse(test.preferences.get('comfortable-pair')!)).toEqual({
      version: 1,
      low: 57,
    })

    for (let sequence = 19; sequence <= 37; sequence++)
      test.emit(test.voices[0], observation(sequence, 58, 1000 + sequence * 25))
    await flush()
    expect(test.controller.snapshot()).toMatchObject({
      mode: 'finding',
      findingTarget: 'high',
      message: 'Choose a clearly different comfortable high note.',
    })
    expect(JSON.parse(test.preferences.get('comfortable-pair')!)).toEqual({
      version: 1,
      low: 57,
    })

    for (let sequence = 38; sequence <= 56; sequence++)
      test.emit(test.voices[0], observation(sequence, 60, 1000 + sequence * 25))
    await flush()
    expect(JSON.parse(test.preferences.get('comfortable-pair')!)).toEqual({
      version: 1,
      low: 57,
      high: 60,
    })
    expect(test.sounds[0].references).toEqual([57, 60])
    expect(test.controller.snapshot().mode).toBe('singing')
  })

  it('collects low before high even when the first visited encounter asks for high', async () => {
    const test = harness(HIGH_HOLD)
    await test.controller.start('vessel')
    expect(test.controller.snapshot()).toMatchObject({
      mode: 'finding',
      findingTarget: 'low',
    })

    for (let sequence = 0; sequence <= 18; sequence++)
      test.emit(test.voices[0], observation(sequence, 57, 1000 + sequence * 25))
    await flush()
    expect(test.controller.snapshot()).toMatchObject({
      mode: 'finding',
      findingTarget: 'high',
    })
  })

  it('downgrades a saved pair whose tolerance bands overlap', () => {
    const test = harness(PAIR, {
      'comfortable-pair': JSON.stringify({ version: 1, low: 57, high: 58 }),
    })
    expect(JSON.parse(test.preferences.get('comfortable-pair')!)).toEqual({
      version: 1,
      low: 57,
    })
  })

  it('surfaces a safe retry after a stabilized reversed pair, then completes low to high', async () => {
    const test = harness(PAIR, {
      'comfortable-pair': JSON.stringify({ version: 1, low: 57, high: 60 }),
    })
    await test.controller.start('vessel')

    for (let sequence = 0; sequence <= 4; sequence++)
      test.emit(test.voices[0], observation(sequence, 60, 1025 + sequence * 25))
    expect(test.events).toContainEqual({
      type: 'challenge-reset',
      id: 'vessel',
      reason: 'wrong-order',
    })
    expect(test.controller.snapshot()).toMatchObject({
      mode: 'singing',
      stepIndex: 0,
      message: 'Try the lower note again.',
      hint: 'Start with the lower note again; take your time.',
    })

    for (let sequence = 5; sequence <= 9; sequence++)
      test.emit(test.voices[0], observation(sequence, 57, 1025 + sequence * 25))
    expect(test.controller.snapshot()).toMatchObject({
      stepIndex: 1,
      message: 'Sing the higher note.',
    })
    for (let sequence = 10; sequence <= 14; sequence++)
      test.emit(test.voices[0], observation(sequence, 60, 1025 + sequence * 25))
    expect(test.events).toContainEqual({ type: 'break', id: 'vessel' })
  })

  it('does not resurrect after late permission or reference completion', async () => {
    const permissionVoice = new FakeVoice()
    permissionVoice.startGate = deferred()
    const permission = harness(COMFORTABLE, { 'comfortable-note': '57' }, [
      permissionVoice,
    ])
    const pendingPermission = permission.controller.start('vessel')
    await flush()
    permission.controller.cancel()
    permissionVoice.startGate.resolve()
    await pendingPermission
    expect(permission.controller.snapshot().mode).toBe('off')
    expect(permissionVoice.subscriptions).toBe(0)
    expect(permission.game.snapshot().paused).toBe(false)

    const referenceVoice = new FakeVoice()
    const referenceSound = new FakeSound()
    const referenceGate = deferred()
    referenceSound.gates.push(referenceGate)
    const reference = harness(
      COMFORTABLE,
      { 'comfortable-note': '57' },
      [referenceVoice],
      [referenceSound],
    )
    const pendingReference = reference.controller.start('vessel')
    await flush()
    expect(reference.controller.snapshot().mode).toBe('reference')
    reference.controller.cancel()
    referenceGate.resolve()
    await pendingReference
    expect(reference.controller.snapshot().mode).toBe('off')
    expect(reference.game.snapshot().activeEncounter).toBeNull()
  })

  it('rejects a retained callback from an older session', async () => {
    const first = new FakeVoice()
    const second = new FakeVoice()
    const test = harness(
      COMFORTABLE,
      { 'comfortable-note': '57' },
      [first, second],
      [new FakeSound(), new FakeSound()],
    )
    await test.controller.start('vessel')
    test.controller.cancel()
    await test.controller.start('vessel')
    expect(first.activeSubscriptions).toBe(0)
    expect(second.activeSubscriptions).toBe(1)

    for (let sequence = 0; sequence <= 4; sequence++)
      first.emitRetained(0, observation(sequence, 57, 1025 + sequence * 25))
    expect(test.game.snapshot().activeEncounter?.charge).toBe(0)
    expect(test.events).toEqual([])
  })

  it('rejects a delayed frame captured before the final reference quiet boundary', async () => {
    const voice = new FakeVoice()
    const sound = new FakeSound()
    const gate = deferred()
    sound.gates.push(gate)
    const test = harness(
      COMFORTABLE,
      { 'comfortable-note': '57' },
      [voice],
      [sound],
    )
    const pending = test.controller.start('vessel')
    await flush()
    const delayed = observation(100, 57, 1090)
    test.setClock(1100)
    gate.resolve()
    await pending

    test.emit(voice, delayed, 1110)
    for (let sequence = 101; sequence <= 104; sequence++)
      test.emit(voice, observation(sequence, 57, 1100 + (sequence - 100) * 25))
    expect(test.events).toEqual([])
    expect(test.game.snapshot().activeEncounter?.charge).toBeCloseTo(0.75)
    test.emit(voice, observation(105, 57, 1225))
    expect(test.events).toContainEqual({ type: 'break', id: 'vessel' })
  })

  it('replays a partial pair through the same microphone and clears its core step', async () => {
    const test = harness(PAIR, {
      'comfortable-pair': JSON.stringify({ version: 1, low: 57, high: 60 }),
    })
    await test.controller.start('vessel')
    for (let sequence = 0; sequence <= 4; sequence++)
      test.emit(test.voices[0], observation(sequence, 57, 1025 + sequence * 25))
    expect(test.controller.snapshot().stepIndex).toBe(1)

    await test.controller.replay()
    expect(test.voices[0].subscriptions).toBe(1)
    expect(test.voices[0].activeSubscriptions).toBe(1)
    expect(test.sounds[0].references).toEqual([57, 60, 57, 60])
    expect(test.controller.snapshot()).toMatchObject({
      mode: 'singing',
      stepIndex: 0,
      stepCharge: 0,
    })
    expect(test.game.saveProgress().completedBreakableIds).toEqual([])
  })

  it('cleans up and unpauses when a session factory throws', async () => {
    const level = levelWith(COMFORTABLE)
    const game = createGlassGame(level)
    for (let index = 0; index < 5; index++)
      game.step({ moveX: 0, moveZ: 0, jumpDown: false }, 1 / 60, index * 16)
    const errors: string[] = []
    const controller = createVoiceChallenge({
      host: {
        createVoice: () => {
          throw new Error('factory failed')
        },
        createSound: () => new FakeSound(),
        readPreference: () => '57',
        writePreference: () => undefined,
      },
      game,
      level,
      canPlay: () => true,
      beforeCapture: () => Promise.resolve(),
      onChange: () => undefined,
      onEvents: () => undefined,
      onError: (message) => errors.push(message),
      onPauseAudio: () => undefined,
      onReleaseVoice: () => undefined,
    })
    await controller.start('vessel')
    expect(controller.snapshot().mode).toBe('off')
    expect(game.snapshot().paused).toBe(false)
    expect(errors).toHaveLength(1)
  })

  it('stops an acquired voice when the sound factory throws', async () => {
    const level = levelWith(COMFORTABLE)
    const game = createGlassGame(level)
    for (let index = 0; index < 5; index++)
      game.step({ moveX: 0, moveZ: 0, jumpDown: false }, 1 / 60, index * 16)
    const voice = new FakeVoice()
    const controller = createVoiceChallenge({
      host: {
        createVoice: () => voice,
        createSound: () => {
          throw new Error('factory failed')
        },
        readPreference: (key) => (key === 'comfortable-note' ? '57' : null),
        writePreference: () => undefined,
      },
      game,
      level,
      canPlay: () => true,
      beforeCapture: () => Promise.resolve(),
      onChange: () => undefined,
      onEvents: () => undefined,
      onError: () => undefined,
      onPauseAudio: () => undefined,
      onReleaseVoice: () => undefined,
    })
    await controller.start('vessel')
    expect(controller.snapshot().mode).toBe('off')
    expect(game.snapshot().paused).toBe(false)
    expect(voice.stopCount).toBe(1)
  })

  it('cancels partial pair progress without saving it when the outer session pauses', async () => {
    const test = harness(PAIR, {
      'comfortable-pair': JSON.stringify({ version: 1, low: 57, high: 60 }),
    })
    await test.controller.start('vessel')
    for (let sequence = 0; sequence <= 4; sequence++)
      test.emit(test.voices[0], observation(sequence, 57, 1025 + sequence * 25))
    test.setCanPlay(false)
    test.game.setPaused(true)
    test.controller.cancel()
    expect(test.game.snapshot().activeEncounter).toBeNull()
    expect(test.game.snapshot().paused).toBe(true)
    expect(test.game.saveProgress().completedBreakableIds).toEqual([])
  })
})
