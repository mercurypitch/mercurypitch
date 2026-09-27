// Adventure melody session tests — durable setup precedes reference and only fresh core evidence can open a station.

import { describe, expect, it, vi } from 'vitest'
import { glassMelody } from '../content/melodies'
import type { GameEvent, LevelDefinition, PitchObservation, SavedProgress, } from '../contracts'
import { createGlassGame } from '../core/game'
import type { GlassSound, GlassVoiceSession } from '../host'
import { createMelodyAdventureChallenge } from './melody-adventure-challenge'
import type { MercMelodyReferenceFactory } from './merc-melody-reference'

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
}

function deferred(): Deferred {
  let resolve!: () => void
  const promise = new Promise<void>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

class FakeVoice implements GlassVoiceSession {
  listener?: (observation: PitchObservation, nowMs: number) => void
  stopped = false
  startError?: Error

  async start(beforeCapture?: Promise<void>): Promise<void> {
    await beforeCapture
    if (this.startError !== undefined) throw this.startError
  }

  latest(): PitchObservation | null {
    return null
  }

  subscribe(
    listener: (observation: PitchObservation, nowMs: number) => void,
  ): () => void {
    this.listener = listener
    return () => {
      this.listener = undefined
    }
  }

  emit(observation: PitchObservation, nowMs = observation.capturedAtMs): void {
    this.listener?.(observation, nowMs)
  }

  stop(): void {
    this.stopped = true
  }
}

class FakeSound implements GlassSound {
  readonly references: number[] = []
  gate?: Deferred
  referenceError?: Error
  shatters = 0
  disposed = false

  async reference(midi: number): Promise<void> {
    this.references.push(midi)
    await this.gate?.promise
    if (this.referenceError !== undefined) throw this.referenceError
  }

  shatter(): void {
    this.shatters++
  }

  dispose(): void {
    this.disposed = true
  }
}

const MELODY = glassMelody('sunlit-steps')

function level(): LevelDefinition {
  return {
    id: 'melody-adventure-test',
    title: 'Melody adventure test',
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
        id: 'first',
        label: 'First note',
        position: { x: 0, y: 0, z: 0.7 },
        anchor: { x: 0, y: 0, z: 0 },
        variant: 'goblet',
        optional: false,
        challenge: {
          kind: 'melody-anchor',
          lessonId: 'lesson',
          anchorId: 'sunlit-steps-home',
          reference: 'anchor-tone',
          step: { hold: HOLD },
        },
      },
      {
        id: 'second',
        label: 'Second note',
        position: { x: 0.3, y: 0, z: 0.7 },
        anchor: { x: 0, y: 0, z: 0 },
        variant: 'vase',
        optional: false,
        requiresCompleted: ['first'],
        challenge: {
          kind: 'melody-anchor',
          lessonId: 'lesson',
          anchorId: 'sunlit-steps-two',
          reference: 'anchor-tone',
          step: { hold: HOLD },
        },
      },
      {
        id: 'third',
        label: 'Third note',
        position: { x: 0.6, y: 0, z: 0.7 },
        anchor: { x: 0, y: 0, z: 0 },
        variant: 'vase',
        optional: false,
        requiresCompleted: ['second'],
        challenge: {
          kind: 'melody-anchor',
          lessonId: 'lesson',
          anchorId: 'sunlit-steps-four',
          reference: 'anchor-tone',
          step: { hold: HOLD },
        },
      },
      {
        id: 'fourth',
        label: 'Fourth note',
        position: { x: 0.9, y: 0, z: 0.7 },
        anchor: { x: 0, y: 0, z: 0 },
        variant: 'vase',
        optional: false,
        requiresCompleted: ['third'],
        challenge: {
          kind: 'melody-anchor',
          lessonId: 'lesson',
          anchorId: 'sunlit-steps-back-two',
          reference: 'anchor-tone',
          step: { hold: HOLD },
        },
      },
      {
        id: 'fifth',
        label: 'Fifth note',
        position: { x: 1.2, y: 0, z: 0.7 },
        anchor: { x: 0, y: 0, z: 0 },
        variant: 'goblet',
        optional: false,
        requiresCompleted: ['fourth'],
        challenge: {
          kind: 'melody-anchor',
          lessonId: 'lesson',
          anchorId: 'sunlit-steps-return',
          reference: 'anchor-tone',
          step: { hold: HOLD },
        },
      },
      {
        id: 'finale',
        label: 'Finale',
        position: { x: 1.8, y: 0, z: 1.8 },
        anchor: { x: 1.8, y: 0, z: 1.2 },
        variant: 'portrait',
        optional: false,
        requiresCompleted: ['fifth'],
        challenge: {
          kind: 'melody-contour',
          lessonId: 'lesson',
          reference: 'whole-melody',
        },
      },
    ],
    melodyLesson: {
      id: 'lesson',
      revision: 1,
      melody: MELODY,
      comfortableOffsetSemitones: 2,
      defaultPace: 1.25,
      allowedPaces: [0.8, 1, 1.25],
      allowedRange: { minimumMidi: 36, maximumMidi: 84 },
      judgePolicy: {},
      referenceProfileId: 'merc-encore-v6',
      stations: [
        { encounterId: 'first', anchorId: 'sunlit-steps-home' },
        { encounterId: 'second', anchorId: 'sunlit-steps-two' },
        { encounterId: 'third', anchorId: 'sunlit-steps-four' },
        { encounterId: 'fourth', anchorId: 'sunlit-steps-back-two' },
        { encounterId: 'fifth', anchorId: 'sunlit-steps-return' },
      ],
      finaleEncounterId: 'finale',
    },
    exit: {
      minX: 1.5,
      maxX: 1.9,
      minZ: -0.3,
      maxZ: 0.3,
      top: 0,
      requiresCompleted: ['finale'],
    },
    fallBelow: -2,
  }
}

const UNUSED_REFERENCES: MercMelodyReferenceFactory = {
  availability: () => ({ kind: 'guide', reason: 'shape' }),
  create: () => {
    throw new Error('Anchor tests must not create a whole-melody reference.')
  },
  dispose: () => undefined,
}

function observation(sequence: number, midi: number, capturedAtMs: number) {
  return {
    sequence,
    captureSeconds: sequence * 0.025,
    capturedAtMs,
    midi,
    confidence: 0.95,
  }
}

function calibrationObservation(
  sequence: number,
  midi: number | null,
  captureSeconds: number,
): PitchObservation {
  return {
    sequence,
    captureSeconds,
    capturedAtMs: 1_000 + captureSeconds * 1_000,
    midi,
    confidence: midi === null ? 0 : 0.95,
  }
}

function harness(
  saved?: SavedProgress,
  initialPreferences: Record<string, string> = {
    'comfortable-note': '60',
  },
) {
  const definition = level()
  const game = createGlassGame(definition, saved)
  for (let index = 0; index < 5; index++)
    game.step({ moveX: 0, moveZ: 0, jumpDown: false }, 1 / 60, index * 16)
  const voice = new FakeVoice()
  const sound = new FakeSound()
  const preferences = new Map(Object.entries(initialPreferences))
  const savedProgress: SavedProgress[] = []
  const events: GameEvent[] = []
  const onError = vi.fn()
  const snapshots: ReturnType<
    ReturnType<typeof createMelodyAdventureChallenge>['snapshot']
  >[] = []
  const order: string[] = []
  let clock = 1_000
  const controller = createMelodyAdventureChallenge({
    host: {
      assetUrl: (id) => id,
      createVoice: () => voice,
      createSound: () => sound,
      readPreference: (key) => preferences.get(key) ?? null,
      writePreference: (key, value) => preferences.set(key, value),
      saveProgress: (progress) => {
        order.push('save')
        savedProgress.push(progress)
      },
    },
    game,
    level: definition,
    canPlay: () => true,
    beforeCapture: () => Promise.resolve(),
    onChange: (snapshot) => snapshots.push(snapshot),
    onEvents: (batch) => events.push(...batch),
    onError,
    onPauseAudio: vi.fn(),
    onReleaseVoice: vi.fn(),
    createAttemptId: () => 'attempt-1',
    references: UNUSED_REFERENCES,
    now: () => clock,
  })
  const originalReference = sound.reference.bind(sound)
  sound.reference = async (midi) => {
    order.push(`reference:${midi}`)
    await originalReference(midi)
  }
  return {
    controller,
    game,
    voice,
    sound,
    snapshots,
    savedProgress,
    events,
    onError,
    order,
    preferences,
    setClock(next: number) {
      clock = next
    },
  }
}

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index++) await Promise.resolve()
}

describe('adventure melody challenge', () => {
  it('opens first-station setup without capture and saves root 58 before its reference', async () => {
    const fixture = harness()

    fixture.controller.open('first')
    expect(fixture.controller.snapshot()).toMatchObject({
      mode: 'setup',
      comfortableMidi: 60,
      rootMidi: 58,
      pace: 1.25,
    })
    expect(fixture.voice.listener).toBeUndefined()

    await fixture.controller.begin()

    expect(fixture.order).toEqual(['save', 'reference:58'])
    expect(fixture.savedProgress[0]).toMatchObject({
      version: 3,
      melodyAttempt: {
        attemptId: 'attempt-1',
        comfortableMidi: 60,
        rootMidi: 58,
        pace: 1.25,
      },
    })
    expect(fixture.controller.snapshot().mode).toBe('singing')
  })

  it('rejects reference-time frames and opens the station only from later core evidence', async () => {
    const fixture = harness()
    const gate = deferred()
    fixture.sound.gate = gate
    fixture.controller.open('first')
    const started = fixture.controller.begin()
    await flush()
    expect(fixture.controller.snapshot().mode).toBe('reference')

    for (let sequence = 1; sequence <= 8; sequence++)
      fixture.voice.emit(observation(sequence, 58, 1_000 + sequence * 25))
    expect(fixture.events).toEqual([])
    expect(fixture.game.snapshot().completedBreakableIds).toEqual([])

    fixture.setClock(2_000)
    gate.resolve()
    await started
    for (let sequence = 10; sequence <= 16; sequence++)
      fixture.voice.emit(observation(sequence, 58, 2_000 + sequence * 25))

    expect(fixture.events.some((event) => event.type === 'break')).toBe(true)
    expect(fixture.game.snapshot().completedBreakableIds).toEqual(['first'])
  })

  it('auto-starts a restored later station and requires a fresh route to retune', async () => {
    const bootstrap = createGlassGame(level())
    expect(
      bootstrap.configureMelodyAttempt({
        attemptId: 'restored-attempt',
        comfortableMidi: 60,
        pace: 1.25,
      }).ok,
    ).toBe(true)
    const saved = {
      ...bootstrap.saveProgress(),
      completedBreakableIds: ['first'],
    }
    const fixture = harness(saved)

    fixture.controller.open('second')
    await flush()

    expect(fixture.voice.listener).toBeTypeOf('function')
    expect(fixture.controller.snapshot().mode).toBe('singing')
    expect(fixture.sound.references).toEqual([60])

    fixture.controller.changeKey()
    expect(fixture.controller.snapshot()).toMatchObject({
      mode: 'setup',
      frozen: true,
      needsFreshAttempt: true,
    })
    expect(fixture.game.snapshot().melodyAttempt?.attemptId).toBe(
      'restored-attempt',
    )
    fixture.controller.setPace(1)
    expect(fixture.controller.snapshot().pace).toBe(1.25)
    expect(fixture.preferences.has('melody-pace:lesson')).toBe(false)
  })

  it('retires a cancelled reference so its late completion cannot reopen capture', async () => {
    const fixture = harness()
    const gate = deferred()
    fixture.sound.gate = gate
    fixture.controller.open('first')
    const started = fixture.controller.begin()
    await flush()

    fixture.controller.cancel()
    gate.resolve()
    await started

    expect(fixture.controller.snapshot().mode).toBe('off')
    expect(fixture.voice.stopped).toBe(true)
    expect(fixture.game.snapshot().activeEncounter).toBeNull()
  })

  it('unpauses after mic rejection and allows the station to reopen', async () => {
    const fixture = harness()
    fixture.voice.startError = new Error('permission denied')
    fixture.controller.open('first')

    await fixture.controller.begin()

    expect(fixture.controller.snapshot().mode).toBe('off')
    expect(fixture.game.snapshot().paused).toBe(false)
    expect(fixture.onError).toHaveBeenCalledOnce()

    fixture.voice.startError = undefined
    fixture.controller.open('first')
    expect(fixture.controller.snapshot().mode).toBe('setup')
  })

  it('unpauses after reference rejection and can retry from a clean session', async () => {
    const fixture = harness()
    fixture.sound.referenceError = new Error('audio unavailable')
    fixture.controller.open('first')

    await fixture.controller.begin()

    expect(fixture.controller.snapshot().mode).toBe('off')
    expect(fixture.game.snapshot()).toMatchObject({
      paused: false,
      activeEncounter: null,
    })
    expect(fixture.voice.stopped).toBe(true)

    fixture.sound.referenceError = undefined
    fixture.controller.open('first')
    await fixture.controller.begin()
    expect(fixture.controller.snapshot().mode).toBe('singing')
  })

  it('replays through the existing capture session and cancel still releases it', async () => {
    const fixture = harness()
    fixture.controller.open('first')
    await fixture.controller.begin()
    expect(fixture.sound.references).toEqual([58])

    await fixture.controller.replay()

    expect(fixture.sound.references).toEqual([58, 58])
    expect(fixture.voice.stopped).toBe(false)
    expect(fixture.game.snapshot().activeEncounter?.id).toBe('first')

    fixture.controller.cancel()
    expect(fixture.voice.stopped).toBe(true)
    expect(fixture.game.snapshot().activeEncounter).toBeNull()
  })

  it('finds a fresh key from sustained capture and saves it before playback', async () => {
    const fixture = harness(undefined, {})
    fixture.controller.open('first')
    await fixture.controller.begin()
    expect(fixture.controller.snapshot()).toMatchObject({
      mode: 'finding',
      comfortableMidi: null,
    })

    for (let sequence = 1; sequence <= 12; sequence++) {
      const frame = calibrationObservation(sequence, 60, sequence * 0.05)
      fixture.voice.emit(frame)
    }
    await flush()

    expect(fixture.order).toEqual(['save', 'reference:58'])
    expect(fixture.controller.snapshot()).toMatchObject({
      mode: 'singing',
      comfortableMidi: 60,
      rootMidi: 58,
    })
    expect(fixture.preferences.get('comfortable-note')).toBe('60')
  })

  it('requires a new sustained run after gaps, drift, or silence', async () => {
    const fixture = harness(undefined, {})
    fixture.controller.open('first')
    await fixture.controller.begin()
    let sequence = 0
    let captureSeconds = 0
    const emit = (midi: number | null, advance = 0.05): void => {
      sequence++
      captureSeconds += advance
      fixture.voice.emit(calibrationObservation(sequence, midi, captureSeconds))
    }

    for (let index = 0; index < 8; index++) emit(60)
    emit(60, 0.2)
    for (let index = 0; index < 5; index++) emit(60)
    emit(62)
    for (let index = 0; index < 5; index++) emit(62)
    emit(null)
    for (let index = 0; index < 11; index++) emit(60)

    expect(fixture.controller.snapshot().mode).toBe('finding')
    expect(fixture.savedProgress).toEqual([])

    emit(60)
    await flush()
    expect(fixture.controller.snapshot()).toMatchObject({
      mode: 'singing',
      comfortableMidi: 60,
    })
  })

  it('rejects a steady key whose phrase would overflow the supported range', async () => {
    const fixture = harness(undefined, {})
    fixture.controller.open('first')
    await fixture.controller.begin()

    for (let sequence = 1; sequence <= 12; sequence++)
      fixture.voice.emit(calibrationObservation(sequence, 36, sequence * 0.05))
    await flush()

    expect(fixture.controller.snapshot()).toMatchObject({
      mode: 'finding',
      comfortableMidi: null,
      message: 'Try another easy middle note.',
    })
    expect(fixture.savedProgress).toEqual([])

    for (let sequence = 13; sequence <= 24; sequence++)
      fixture.voice.emit(calibrationObservation(sequence, 60, sequence * 0.05))
    await flush()
    expect(fixture.controller.snapshot()).toMatchObject({
      mode: 'singing',
      rootMidi: 58,
    })
  })

  it('falls back from an invalid stored pace and accepts only an allowed choice', async () => {
    const fixture = harness(undefined, {
      'comfortable-note': '60',
      'melody-pace:lesson': '1.1',
    })
    fixture.controller.open('first')

    expect(fixture.controller.snapshot().pace).toBe(1.25)
    fixture.controller.setPace(1)
    expect(fixture.controller.snapshot().pace).toBe(1)
    expect(fixture.preferences.get('melody-pace:lesson')).toBe('1')

    fixture.controller.setPace(1.1)
    expect(fixture.controller.snapshot().pace).toBe(1)
    await fixture.controller.begin()
    expect(fixture.savedProgress[0]?.melodyAttempt?.pace).toBe(1)
  })
})
