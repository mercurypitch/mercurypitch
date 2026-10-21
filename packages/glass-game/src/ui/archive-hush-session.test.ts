// Archive Hush session tests — real coordination with controlled microphone and reference boundaries.
import { describe, expect, it } from 'vitest'
import type { PitchObservation } from '../contracts'
import type { GlassGameHost, GlassSound, GlassVoiceSession } from '../host'
import type { ArchiveHushRoom } from './archive-hush-session'
import { createArchiveHushSession } from './archive-hush-session'

function deferred() {
  let resolve!: () => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<void>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

async function settleMicrotasks(): Promise<void> {
  for (let step = 0; step < 3; step++) await Promise.resolve()
}

class FakeVoice implements GlassVoiceSession {
  startGate: ReturnType<typeof deferred> | null = null
  startCount = 0
  stopCount = 0
  active = false
  stopped = false
  stopOnSubscribe = false
  sequence = 0
  latestFrame: PitchObservation | null = null
  retained: Array<{
    listener(frame: PitchObservation, at: number): void
    stopped?(): void
    active: boolean
  }> = []
  async start(beforeCapture?: Promise<void>): Promise<void> {
    this.startCount++
    await beforeCapture
    await this.startGate?.promise
    this.active = !this.stopped
  }
  latest(): PitchObservation | null {
    return this.latestFrame
  }
  subscribe(
    listener: (frame: PitchObservation, at: number) => void,
    stopped?: () => void,
  ): () => void {
    const entry = { listener, stopped, active: true }
    this.retained.push(entry)
    if (this.stopOnSubscribe) stopped?.()
    return () => {
      entry.active = false
    }
  }
  emit(at: number, patch: Partial<PitchObservation> = {}): PitchObservation {
    const frame = {
      sequence: ++this.sequence,
      captureSeconds: at / 1000,
      capturedAtMs: at,
      midi: 57,
      confidence: 0.95,
      ...patch,
    }
    this.latestFrame = frame
    for (const entry of this.retained)
      if (entry.active) entry.listener(frame, at)
    return frame
  }
  interrupt(): void {
    this.active = false
    for (const entry of this.retained) if (entry.active) entry.stopped?.()
  }
  stop(): void {
    this.stopCount++
    this.active = false
    this.stopped = true
  }
}

class FakeSound implements GlassSound {
  gate: ReturnType<typeof deferred> | null = null
  references: number[] = []
  disposed = 0
  onReference?: () => void
  async reference(midi: number): Promise<void> {
    this.references.push(midi)
    this.onReference?.()
    await this.gate?.promise
  }
  shatter(): void {
    throw new Error('Hush must never shatter glass')
  }
  dispose(): void {
    this.disposed++
  }
}

const FIRST_ROOM: ArchiveHushRoom = {
  id: 'first',
  vesselIds: ['diadem', 'carafe', 'lotus'],
}
const SECOND_ROOM: ArchiveHushRoom = {
  id: 'second',
  vesselIds: ['bell', 'vase', 'chandelier', 'coupe'],
  curtainVesselIds: ['chandelier'],
}
const THIRD_ROOM: ArchiveHushRoom = {
  id: 'third',
  vesselIds: ['goblet', 'shell', 'mirror', 'bowl', 'decanter'],
  curtainVesselIds: ['mirror', 'bowl'],
}

function setup(
  stored: string | null = '57',
  room: ArchiveHushRoom = FIRST_ROOM,
) {
  let time = 1000
  let playable = true
  let reachable = true
  let released = 0
  const completed: string[] = []
  let onComplete: ((id: string) => void) | null = null
  let onRelease: (() => void) | null = null
  let beforeCaptureCount = 0
  let quietGate: ReturnType<typeof deferred> | null = null
  const preference = new Map<string, string>()
  if (stored !== null) preference.set('comfortable-note', stored)
  const created: FakeVoice[] = []
  const planned: FakeVoice[] = []
  const sounds: FakeSound[] = []
  const plannedSounds: FakeSound[] = []
  const changes: ReturnType<
    ReturnType<typeof createArchiveHushSession>['snapshot']
  >[] = []
  let changed: ((state: (typeof changes)[number]) => void) | null = null
  const host: GlassGameHost = {
    assetUrl: (id) => id,
    prepareVoiceGesture: () => ({ ready: Promise.resolve(true), release() {} }),
    createVoice: () => {
      const voice = planned.shift() ?? new FakeVoice()
      created.push(voice)
      return voice
    },
    createSound: () => {
      const sound = plannedSounds.shift() ?? new FakeSound()
      sounds.push(sound)
      return sound
    },
    loadProgress: () => null,
    saveProgress() {},
    readPreference: (key) => preference.get(key) ?? null,
    writePreference: (key, value) => {
      preference.set(key, value)
    },
    subscribeForeground: () => () => {},
    onExit() {},
  }
  const session = createArchiveHushSession({
    host,
    vesselIds: room.vesselIds,
    curtainVesselIds: room.curtainVesselIds,
    roomId: room.id,
    completed: room.completed,
    onComplete: (id) => {
      completed.push(id)
      onComplete?.(id)
    },
    canPlay: () => playable,
    canReach: () => reachable,
    beforeCapture: () => {
      beforeCaptureCount++
      return quietGate?.promise ?? Promise.resolve()
    },
    onReleaseVoice: () => {
      released++
      onRelease?.()
    },
    onChange: (state) => {
      changes.push(state)
      changed?.(state)
    },
    now: () => time,
  })
  const feed = (duration: number, patch: Partial<PitchObservation> = {}) => {
    for (let elapsed = 0; elapsed < duration; elapsed += 25) {
      time += 25
      created.at(-1)!.emit(time, patch)
      session.tick(time)
    }
  }
  return {
    session,
    completed,
    setOnComplete: (callback: (id: string) => void) => {
      onComplete = callback
    },
    setOnRelease: (callback: () => void) => {
      onRelease = callback
    },
    host,
    created,
    planned,
    sounds,
    plannedSounds,
    changes,
    preference,
    feed,
    time: () => time,
    setTime: (at: number) => {
      time = at
    },
    setOnChange: (listener: (state: (typeof changes)[number]) => void) => {
      changed = listener
    },
    setPlayable: (value: boolean) => {
      playable = value
    },
    setReachable: (value: boolean) => {
      reachable = value
    },
    setQuietGate: (value: ReturnType<typeof deferred>) => {
      quietGate = value
    },
    released: () => released,
    beforeCaptureCount: () => beforeCaptureCount,
  }
}

describe('Archive Hush voice ownership', () => {
  it('opens capture only in Start and calls start synchronously with the audio barrier', async () => {
    const fixture = setup()
    const quiet = deferred()
    fixture.setQuietGate(quiet)
    expect(fixture.created).toHaveLength(0)
    fixture.session.tick(1000)
    expect(fixture.created).toHaveLength(0)
    const starting = fixture.session.start()
    expect(fixture.created[0]!.startCount).toBe(1)
    expect(fixture.beforeCaptureCount()).toBe(1)
    expect(fixture.created[0]!.active).toBe(false)
    expect(fixture.session.snapshot().mode).toBe('permission')
    quiet.resolve()
    await starting
    expect(fixture.created[0]!.active).toBe(true)
    expect(fixture.session.snapshot().mode).toBe('listening')
  })

  it.each(['pause', 'reset', 'dispose'] as const)(
    'retires a late permission result after %s without reopening capture',
    async (action) => {
      const fixture = setup()
      const voice = new FakeVoice()
      voice.startGate = deferred()
      fixture.planned.push(voice)
      const starting = fixture.session.start()
      fixture.session[action]()
      voice.startGate.resolve()
      await starting
      expect(voice.active).toBe(false)
      expect(voice.retained).toEqual([])
      expect(fixture.released()).toBe(1)
      if (action !== 'dispose')
        expect(fixture.session.snapshot().mode).toBe(
          action === 'pause' ? 'paused' : 'off',
        )
      const count = fixture.changes.length
      fixture.session.dispose()
      expect(fixture.released()).toBe(1)
      expect(fixture.changes).toHaveLength(count)
    },
  )

  it.each(['pause', 'dispose', 'host-pause'] as const)(
    'does not open capture after a synchronous %s during the permission update',
    async (action) => {
      const fixture = setup()
      fixture.setOnChange((state) => {
        if (state.mode !== 'permission') return
        if (action === 'host-pause') fixture.setPlayable(false)
        else fixture.session[action]()
      })
      await fixture.session.start()
      expect(fixture.created).toHaveLength(0)
      expect(fixture.beforeCaptureCount()).toBe(0)
      expect(fixture.released()).toBe(0)
      if (action !== 'dispose')
        expect(fixture.session.snapshot().mode).toBe('paused')
    },
  )

  it('retires capture when the host pauses while permission is pending', async () => {
    const fixture = setup()
    const voice = new FakeVoice()
    voice.startGate = deferred()
    fixture.planned.push(voice)
    const starting = fixture.session.start()
    fixture.setPlayable(false)
    voice.startGate.resolve()
    await starting
    expect(fixture.session.snapshot().mode).toBe('paused')
    expect(voice.active).toBe(false)
    expect(fixture.released()).toBe(1)
    fixture.setPlayable(true)
    fixture.session.tick(1100)
    expect(fixture.created).toHaveLength(1)
  })

  it('handles permission rejection and retries only after another explicit Start', async () => {
    const fixture = setup()
    const voice = new FakeVoice()
    voice.startGate = deferred()
    fixture.planned.push(voice)
    const starting = fixture.session.start()
    voice.startGate.reject(new Error('NotAllowedError'))
    await starting
    expect(fixture.session.snapshot().mode).toBe('error')
    expect(voice.active).toBe(false)
    expect(fixture.released()).toBe(1)
    fixture.session.tick(5000)
    expect(fixture.created).toHaveLength(1)
    fixture.setTime(5000)
    await fixture.session.start()
    expect(fixture.created).toHaveLength(2)
    expect(fixture.session.snapshot().mode).toBe('listening')
  })

  it('releases a rejected pre-capture audio barrier without scoring', async () => {
    const fixture = setup()
    const quiet = deferred()
    fixture.setQuietGate(quiet)
    const starting = fixture.session.start()
    quiet.reject(new Error('Audio interrupted'))
    await starting
    expect(fixture.session.snapshot().mode).toBe('error')
    expect(fixture.session.snapshot().room.protectedIds).toEqual([])
    expect(fixture.created[0]!.active).toBe(false)
    expect(fixture.released()).toBe(1)
  })

  it('pauses on stopped capture and ignores retained callbacks from the retired generation', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(1100)
    const first = fixture.created[0]!
    first.interrupt()
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'paused',
      room: { protectedIds: ['diadem'] },
    })
    fixture.setTime(4000)
    await fixture.session.start()
    fixture.session.aim('carafe')
    for (let ms = 4050; ms <= 6050; ms += 50) {
      first.retained[0]!.listener(
        {
          sequence: ms,
          captureSeconds: ms / 1000,
          capturedAtMs: ms,
          midi: 57,
          confidence: 1,
        },
        ms,
      )
    }
    first.retained[0]!.stopped?.()
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'listening',
      room: { protectedIds: ['diadem'] },
    })
    fixture.feed(1100)
    expect(fixture.session.snapshot().room.protectedIds).toEqual([
      'diadem',
      'carafe',
    ])
    expect(fixture.released()).toBe(1)
  })

  it('detaches a synchronously stopped subscription', async () => {
    const fixture = setup()
    const voice = new FakeVoice()
    voice.stopOnSubscribe = true
    fixture.planned.push(voice)
    await fixture.session.start()
    expect(fixture.session.snapshot().mode).toBe('paused')
    expect(voice.retained[0]!.active).toBe(false)
    expect(voice.active).toBe(false)
    expect(fixture.released()).toBe(1)
  })
})

describe('Archive Hush calibration and protection', () => {
  it('calibrates a steady comfortable note and saves the same target used by shields', async () => {
    const fixture = setup(null)
    await fixture.session.start()
    fixture.feed(500, { midi: 60.2 })
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'finding',
      target: null,
    })
    fixture.feed(25, { midi: 60.2 })
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'listening',
      target: 60,
      room: { protectedIds: [] },
    })
    expect(fixture.preference.get('comfortable-note')).toBe('60')
    fixture.feed(1200, { midi: 57 })
    expect(fixture.session.snapshot().room.protectedIds).toEqual([])
    fixture.feed(1100, { midi: 60 })
    expect(fixture.session.snapshot().room.protectedIds).toEqual(['diadem'])
  })

  it.each([
    ['low confidence', { confidence: 0.79 }],
    ['nonfinite confidence', { confidence: NaN }],
    ['unpitched capture', { midi: null }],
    ['out-of-range pitch', { midi: 90 }],
    ['invalid sequence', { sequence: NaN }],
  ])('cannot calibrate from %s', async (_reason, patch) => {
    const fixture = setup(null)
    await fixture.session.start()
    fixture.feed(1000, patch)
    expect(fixture.session.snapshot().target).toBeNull()
    expect(fixture.preference.has('comfortable-note')).toBe(false)
  })

  it('does not combine duplicate, reordered or separated observations into calibration', async () => {
    const fixture = setup(null)
    await fixture.session.start()
    fixture.feed(300)
    const voice = fixture.created[0]!
    const last = voice.latestFrame!
    for (let ms = 1325; ms <= 1400; ms += 25)
      voice.retained[0]!.listener(last, ms)
    voice.retained[0]!.listener({ ...last, sequence: last.sequence - 1 }, 1400)
    fixture.setTime(1425)
    fixture.feed(300)
    expect(fixture.session.snapshot().target).toBeNull()
    fixture.feed(250)
    expect(fixture.session.snapshot().target).toBe(57)
  })

  it('rejects drifting calibration even when adjacent notes differ only slightly', async () => {
    const fixture = setup(null)
    await fixture.session.start()
    for (let index = 0; index < 32; index++)
      fixture.feed(25, { midi: 57 + index * 0.1 })
    expect(fixture.session.snapshot().target).toBeNull()
    fixture.feed(550, { midi: 61 })
    expect(fixture.session.snapshot().target).toBe(61)
  })

  it('never calibrates from stale, future or pre-start captures', async () => {
    const fixture = setup(null)
    await fixture.session.start()
    const voice = fixture.created[0]!
    for (let ms = 1025; ms <= 1700; ms += 25) {
      voice.emit(ms, { capturedAtMs: 999 })
      voice.emit(ms, { capturedAtMs: ms - 151 })
      voice.emit(ms, { capturedAtMs: ms + 1000 })
    }
    expect(fixture.session.snapshot().target).toBeNull()
    fixture.setTime(1800)
    fixture.feed(550)
    expect(fixture.session.snapshot().target).toBe(57)
  })

  it.each([-151, 1000])(
    'clears partial humming when capture timestamp is invalid by %s ms',
    async (offset) => {
      const fixture = setup()
      await fixture.session.start()
      fixture.feed(500)
      expect(fixture.session.snapshot().room.holdProgress).toBeGreaterThan(0)
      const at = fixture.time() + 25
      fixture.setTime(at)
      fixture.created[0]!.emit(at, { capturedAtMs: at + offset })
      expect(fixture.session.snapshot()).toMatchObject({
        pitch: null,
        room: { holdProgress: 0, protectedIds: [] },
      })
      fixture.feed(600)
      expect(fixture.session.snapshot().room.protectedIds).toEqual([])
      fixture.feed(450)
      expect(fixture.session.snapshot().room.protectedIds).toEqual(['diadem'])
    },
  )

  it('does not count accelerated audio time as half a second of calibrated capture', async () => {
    const fixture = setup(null)
    await fixture.session.start()
    const voice = fixture.created[0]!
    for (let index = 1; index <= 20; index++)
      voice.emit(1000 + index * 5, { captureSeconds: index * 0.05 })
    expect(fixture.session.snapshot().target).toBeNull()
  })

  it('stops microphone capture after a complete protected cycle', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(1100)
    fixture.session.aim('carafe')
    fixture.feed(1100)
    fixture.session.ring()
    expect(fixture.session.snapshot().room.phase).toBe('telegraph')
    fixture.feed(3000, { midi: null })
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'complete',
      room: { phase: 'complete', missedIds: [] },
    })
    expect(fixture.created[0]!.active).toBe(false)
    expect(fixture.created[0]!.retained[0]!.active).toBe(false)
    expect(fixture.released()).toBe(1)
    await fixture.session.start()
    expect(fixture.created).toHaveLength(1)
  })

  it('samples the capture clock when the display host ticks without an older frame timestamp', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(1100)
    fixture.session.aim('carafe')
    fixture.feed(1100)
    fixture.session.ring()
    const voice = fixture.created[0]!
    for (let elapsed = 0; elapsed < 3000; elapsed += 25) {
      fixture.setTime(fixture.time() + 25)
      voice.emit(fixture.time(), { midi: null })
      fixture.session.tick()
    }
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'complete',
      room: { phase: 'complete', missedIds: [] },
    })
    expect(voice.active).toBe(false)
    expect(fixture.released()).toBe(1)
  })

  it('stops capture on a retry without shattering and resets only when asked', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(50, { midi: null })
    fixture.session.ring()
    fixture.feed(3000, { midi: null })
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'retry',
      room: { missedIds: ['diadem', 'carafe'] },
    })
    expect(fixture.created[0]!.active).toBe(false)
    fixture.session.reset()
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'off',
      target: 57,
      room: { attempt: 2, protectedIds: [] },
    })
    expect(fixture.created).toHaveLength(1)
    await fixture.session.start()
    expect(fixture.created).toHaveLength(2)
  })

  it('requires a reachable aim and clears partial credit after moving away', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(500)
    fixture.setReachable(false)
    fixture.session.aim('carafe')
    fixture.feed(50)
    expect(fixture.session.snapshot().room).toMatchObject({
      aimedId: null,
      holdProgress: 0,
      protectedIds: [],
    })
    fixture.setReachable(true)
    fixture.session.aim('carafe')
    fixture.feed(1100)
    expect(fixture.session.snapshot().room.protectedIds).toEqual(['carafe'])
  })

  it('keeps earned shields while changing the written target and clears partial humming', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(1100)
    fixture.session.aim('carafe')
    fixture.feed(400)
    fixture.session.changeNote()
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'finding',
      target: null,
      room: { protectedIds: ['diadem'], holdProgress: 0 },
    })
    fixture.feed(550, { midi: 60 })
    expect(fixture.session.snapshot().target).toBe(60)
    fixture.feed(1100, { midi: 57 })
    expect(fixture.session.snapshot().room.protectedIds).toEqual(['diadem'])
    fixture.feed(1100, { midi: 60 })
    expect(fixture.session.snapshot().room.protectedIds).toEqual([
      'diadem',
      'carafe',
    ])
    expect(fixture.created).toHaveLength(1)
  })

  it('waits for the cloche to settle before allowing the chime', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(50, { midi: null })
    fixture.session.moveCover('diadem')
    expect(fixture.session.snapshot().coverMoving).toBe(true)
    fixture.session.ring()
    expect(fixture.session.snapshot().room.phase).toBe('preparing')
    fixture.feed(475, { midi: null })
    fixture.session.ring()
    expect(fixture.session.snapshot().room.phase).toBe('preparing')
    fixture.feed(25, { midi: null })
    expect(fixture.session.snapshot().coverMoving).toBe(false)
    fixture.session.ring()
    expect(fixture.session.snapshot().room.phase).toBe('telegraph')
  })

  it('does not restart settling for an unchanged or invalid cover slot', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(50, { midi: null })
    fixture.session.moveCover('lotus')
    fixture.session.moveCover('invalid')
    expect(fixture.session.snapshot().coverMoving).toBe(false)
    fixture.session.ring()
    expect(fixture.session.snapshot().room.phase).toBe('telegraph')
  })
})

describe('Archive Hush interruption and reference fences', () => {
  it.each(['stale', '500ms stall'] as const)(
    'pauses a telegraph for %s and requires manual fresh resume',
    async (reason) => {
      const fixture = setup()
      await fixture.session.start()
      fixture.feed(50, { midi: null })
      fixture.session.ring()
      fixture.feed(500, { midi: null })
      fixture.setTime(fixture.time() + (reason === 'stale' ? 200 : 500))
      if (reason === '500ms stall')
        fixture.created[0]!.emit(fixture.time(), { midi: null })
      fixture.session.tick(fixture.time())
      expect(fixture.session.snapshot()).toMatchObject({
        mode: 'paused',
        room: { phase: 'paused', telegraphRemainingSeconds: 3 },
      })
      expect(fixture.created[0]!.active).toBe(false)
      fixture.setTime(10_000)
      fixture.session.tick(fixture.time())
      expect(fixture.created).toHaveLength(1)
      await fixture.session.start()
      fixture.session.tick(fixture.time() + 50)
      expect(fixture.session.snapshot().room.telegraphRemainingSeconds).toBe(3)
      fixture.feed(3000, { midi: null })
      expect(fixture.session.snapshot().mode).toBe('listening')
      fixture.feed(25, { midi: null })
      expect(fixture.session.snapshot().mode).toBe('retry')
    },
  )

  it('pauses finding, listening and reference when the host becomes unavailable', async () => {
    for (const stage of ['finding', 'listening', 'reference']) {
      const fixture = setup(stage === 'finding' ? null : '57')
      await fixture.session.start()
      const sound = new FakeSound()
      sound.gate = deferred()
      fixture.plannedSounds.push(sound)
      const hearing =
        stage === 'reference' ? fixture.session.hear() : Promise.resolve()
      fixture.setPlayable(false)
      fixture.session.tick(fixture.time())
      expect(fixture.session.snapshot().mode).toBe('paused')
      expect(fixture.created[0]!.active).toBe(false)
      sound.gate.resolve()
      await hearing
      fixture.setPlayable(true)
      fixture.session.tick(fixture.time() + 5000)
      expect(fixture.session.snapshot().mode).toBe('paused')
      expect(fixture.created).toHaveLength(1)
    }
  })

  it('ignores all reference capture and requires fresh post-tail evidence before shielding or ringing', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(500)
    const sound = new FakeSound()
    sound.gate = deferred()
    fixture.plannedSounds.push(sound)
    const hearing = fixture.session.hear()
    expect(sound.references).toEqual([57])
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'reference',
      room: { holdProgress: 0 },
    })
    fixture.feed(3000)
    expect(fixture.session.snapshot().room.protectedIds).toEqual([])
    const tailEnd = fixture.time()
    sound.gate.resolve()
    await hearing
    fixture.session.ring()
    expect(fixture.session.snapshot().room.phase).toBe('preparing')
    fixture.created[0]!.emit(tailEnd + 10, { capturedAtMs: tailEnd })
    fixture.session.ring()
    expect(fixture.session.snapshot().room.phase).toBe('preparing')
    fixture.feed(1000)
    expect(fixture.session.snapshot().room.protectedIds).toEqual([])
    fixture.feed(25)
    expect(fixture.session.snapshot().room.protectedIds).toEqual(['diadem'])
    expect(fixture.created).toHaveLength(1)
  })

  it('retires a late reference result without reviving a paused session', async () => {
    const fixture = setup()
    await fixture.session.start()
    const sound = new FakeSound()
    sound.gate = deferred()
    fixture.plannedSounds.push(sound)
    const hearing = fixture.session.hear()
    fixture.session.pause()
    sound.gate.resolve()
    await hearing
    expect(fixture.session.snapshot().mode).toBe('paused')
    expect(sound.disposed).toBe(1)
    expect(fixture.created[0]!.active).toBe(false)
    expect(fixture.released()).toBe(1)
  })

  it('releases capture when the reference fails', async () => {
    const fixture = setup()
    await fixture.session.start()
    const sound = new FakeSound()
    sound.gate = deferred()
    fixture.plannedSounds.push(sound)
    const hearing = fixture.session.hear()
    sound.gate.reject(new Error('Reference suspended'))
    await hearing
    expect(fixture.session.snapshot().mode).toBe('paused')
    expect(fixture.created[0]!.active).toBe(false)
    expect(fixture.released()).toBe(1)
  })

  it('times out missing initial capture without an automatic microphone restart', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.setTime(3001)
    fixture.session.tick(fixture.time())
    expect(fixture.session.snapshot().mode).toBe('paused')
    expect(fixture.created[0]!.active).toBe(false)
    fixture.session.tick(20_000)
    expect(fixture.created).toHaveLength(1)
  })

  it('plays the result chime only after capture is stopped and subscriptions are released', async () => {
    const fixture = setup()
    await fixture.session.start()
    const sound = new FakeSound()
    sound.gate = deferred()
    let atChime: {
      captureActive: boolean
      subscribed: boolean
      released: number
    } | null = null
    sound.onReference = () => {
      atChime = {
        captureActive: fixture.created[0]!.active,
        subscribed: fixture.created[0]!.retained[0]!.active,
        released: fixture.released(),
      }
    }
    fixture.plannedSounds.push(sound)
    fixture.feed(50, { midi: null })
    fixture.session.ring()
    fixture.feed(3000, { midi: null })
    expect(sound.references).toEqual([69])
    expect(atChime).toEqual({
      captureActive: false,
      subscribed: false,
      released: 1,
    })
    expect(fixture.session.snapshot().mode).toBe('retry')
    sound.gate.resolve()
    await settleMicrotasks()
    expect(sound.disposed).toBe(1)
  })

  it('fences a cancelled result chime tail before immediate retry calibration', async () => {
    const fixture = setup()
    await fixture.session.start()
    const sound = new FakeSound()
    sound.gate = deferred()
    fixture.plannedSounds.push(sound)
    fixture.feed(50, { midi: null })
    fixture.session.ring()
    fixture.feed(3000, { midi: null })
    fixture.session.reset()
    expect(sound.disposed).toBe(1)
    await fixture.session.start()
    fixture.session.changeNote()
    fixture.feed(250, { midi: 69 })
    expect(fixture.session.snapshot().target).toBeNull()
    fixture.feed(550, { midi: 60 })
    expect(fixture.session.snapshot().target).toBe(60)
    sound.gate.resolve()
    await settleMicrotasks()
    expect(fixture.session.snapshot().mode).toBe('listening')
    expect(fixture.created[1]!.active).toBe(true)
    expect(sound.disposed).toBe(1)
  })

  it('handles result output rejection without changing the outcome or reopening capture', async () => {
    const fixture = setup()
    await fixture.session.start()
    const sound = new FakeSound()
    sound.gate = deferred()
    fixture.plannedSounds.push(sound)
    fixture.feed(50, { midi: null })
    fixture.session.ring()
    fixture.feed(3000, { midi: null })
    sound.gate.reject(new Error('Output interrupted'))
    await settleMicrotasks()
    expect(fixture.session.snapshot().mode).toBe('retry')
    expect(fixture.created[0]!.active).toBe(false)
    expect(sound.disposed).toBe(1)
  })

  it('cancels result audio on a host pause while retaining the completed outcome', async () => {
    const fixture = setup()
    await fixture.session.start()
    const sound = new FakeSound()
    sound.gate = deferred()
    fixture.plannedSounds.push(sound)
    fixture.feed(50, { midi: null })
    fixture.session.ring()
    fixture.feed(3000, { midi: null })
    fixture.setPlayable(false)
    fixture.session.tick(fixture.time())
    expect(fixture.session.snapshot().mode).toBe('retry')
    expect(sound.disposed).toBe(1)
    sound.gate.resolve()
    await settleMicrotasks()
    expect(fixture.created).toHaveLength(1)
  })
})

describe('Archive Hush room ownership', () => {
  const complete = (fixture: ReturnType<typeof setup>, room = FIRST_ROOM) => {
    fixture.session.aim(room.vesselIds[0]!)
    fixture.feed(1100)
    fixture.session.aim(room.vesselIds[1]!)
    fixture.feed(1100)
    fixture.session.setCurtainClosed(true)
    fixture.session.ring()
    fixture.feed(3000, { midi: null })
  }

  it.each([FIRST_ROOM, SECOND_ROOM, THIRD_ROOM])(
    'completes $id only once and stays quiet on completed revisits',
    async (room) => {
      const fixture = setup('57', room)
      await fixture.session.start()
      complete(fixture, room)
      expect(fixture.completed).toEqual([room.id])
      expect(fixture.session.snapshot()).toMatchObject({
        roomId: room.id,
        mode: 'complete',
        room: { phase: 'complete', missedIds: [] },
      })
      expect(fixture.created[0]!.active).toBe(false)
      fixture.session.reset()
      await fixture.session.start()
      fixture.session.tick(fixture.time() + 5000)
      expect(fixture.created).toHaveLength(1)
      fixture.session.configureRoom({ ...FIRST_ROOM, id: 'another' })
      fixture.session.configureRoom(room)
      await fixture.session.start()
      expect(fixture.session.snapshot().mode).toBe('complete')
      expect(fixture.created).toHaveLength(1)
      expect(fixture.completed).toEqual([room.id])
    },
  )

  it('does not award a room whose curtain was left open', async () => {
    const fixture = setup('57', THIRD_ROOM)
    await fixture.session.start()
    fixture.feed(1100)
    fixture.session.aim('shell')
    fixture.feed(1100)
    fixture.session.ring()
    fixture.session.setCurtainClosed(true)
    fixture.session.moveCover('mirror')
    fixture.feed(3000, { midi: null })
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'retry',
      room: {
        curtainClosed: false,
        coveredId: 'decanter',
        missedIds: ['mirror', 'bowl'],
      },
    })
    expect(fixture.completed).toEqual([])
    fixture.session.reset()
    await fixture.session.start()
    // A disposed result chime must finish its existing 250 ms tail first.
    fixture.feed(250, { midi: null })
    complete(fixture, THIRD_ROOM)
    expect(fixture.completed).toEqual(['third'])
  })

  it('retires old capture and clears partial room state without restarting on entry', async () => {
    const fixture = setup('57', SECOND_ROOM)
    await fixture.session.start()
    fixture.feed(1100)
    fixture.session.aim('vase')
    fixture.feed(500)
    fixture.session.moveCover('bell')
    fixture.session.setCurtainClosed(true)
    const oldVoice = fixture.created[0]!
    fixture.session.configureRoom(THIRD_ROOM)
    expect(oldVoice.active).toBe(false)
    expect(oldVoice.retained[0]!.active).toBe(false)
    expect(fixture.session.snapshot()).toMatchObject({
      roomId: 'third',
      mode: 'off',
      target: 57,
      coverMoving: false,
      room: {
        protectedIds: [],
        coveredId: 'decanter',
        curtainClosed: false,
        holdProgress: 0,
      },
    })
    fixture.session.tick(fixture.time() + 1000)
    expect(fixture.created).toHaveLength(1)
    await fixture.session.start()
    for (let index = 1; index <= 50; index++) {
      const at = fixture.time() + index * 25
      oldVoice.retained[0]!.listener(
        {
          sequence: 1000 + index,
          captureSeconds: at / 1000,
          capturedAtMs: at,
          midi: 57,
          confidence: 1,
        },
        at,
      )
    }
    oldVoice.retained[0]!.stopped?.()
    expect(fixture.session.snapshot()).toMatchObject({
      mode: 'listening',
      room: { protectedIds: [] },
    })
    fixture.feed(1100)
    expect(fixture.session.snapshot().room.protectedIds).toEqual(['goblet'])
  })

  it('ignores an old permission resolution after entering another room', async () => {
    const fixture = setup()
    const oldVoice = new FakeVoice()
    oldVoice.startGate = deferred()
    fixture.planned.push(oldVoice)
    const starting = fixture.session.start()
    fixture.session.configureRoom(SECOND_ROOM)
    await fixture.session.start()
    oldVoice.startGate.resolve()
    await starting
    expect(oldVoice.active).toBe(false)
    expect(oldVoice.retained).toEqual([])
    expect(fixture.created[1]!.active).toBe(true)
    expect(fixture.session.snapshot()).toMatchObject({
      roomId: 'second',
      mode: 'listening',
    })
  })

  it('fences retired reference tails and ignores their late promises in a new room', async () => {
    const fixture = setup()
    await fixture.session.start()
    const oldSound = new FakeSound()
    oldSound.gate = deferred()
    fixture.plannedSounds.push(oldSound)
    const hearing = fixture.session.hear()
    fixture.session.configureRoom(SECOND_ROOM)
    expect(oldSound.disposed).toBe(1)
    await fixture.session.start()
    fixture.feed(250)
    expect(fixture.session.snapshot().room.holdProgress).toBe(0)
    fixture.feed(550)
    expect(fixture.session.snapshot().room.protectedIds).toEqual([])
    oldSound.gate.resolve()
    await hearing
    expect(fixture.session.snapshot()).toMatchObject({
      roomId: 'second',
      mode: 'listening',
    })
    fixture.feed(475)
    expect(fixture.session.snapshot().room.protectedIds).toEqual(['bell'])
    expect(oldSound.disposed).toBe(1)
  })

  it('invalidates outcome audio before a new room starts capture', async () => {
    const fixture = setup()
    await fixture.session.start()
    const sound = new FakeSound()
    sound.gate = deferred()
    fixture.plannedSounds.push(sound)
    complete(fixture)
    fixture.session.configureRoom(SECOND_ROOM)
    expect(sound.disposed).toBe(1)
    await fixture.session.start()
    fixture.feed(250, { midi: 69 })
    expect(fixture.session.snapshot().room.protectedIds).toEqual([])
    sound.gate.resolve()
    await settleMicrotasks()
    expect(fixture.session.snapshot()).toMatchObject({
      roomId: 'second',
      mode: 'listening',
    })
    expect(fixture.created[1]!.active).toBe(true)
    expect(fixture.completed).toEqual(['first'])
    expect(sound.disposed).toBe(1)
  })

  it('restarts an interrupted curtain-room chime only after explicit fresh resume', async () => {
    const fixture = setup('57', SECOND_ROOM)
    await fixture.session.start()
    fixture.feed(1100)
    fixture.session.aim('vase')
    fixture.feed(1100)
    fixture.session.setCurtainClosed(true)
    fixture.session.ring()
    fixture.feed(500, { midi: null })
    fixture.session.pause()
    fixture.session.setCurtainClosed(false)
    expect(fixture.session.snapshot().room).toMatchObject({
      curtainClosed: true,
      protectedIds: ['bell', 'vase'],
      telegraphRemainingSeconds: 3,
    })
    fixture.setTime(fixture.time() + 5000)
    fixture.session.tick(fixture.time())
    expect(fixture.completed).toEqual([])
    await fixture.session.start()
    fixture.feed(3000, { midi: null })
    expect(fixture.completed).toEqual([])
    fixture.feed(25, { midi: null })
    expect(fixture.completed).toEqual(['second'])
  })

  it('preserves the last comfortable note when leaving during unfinished recalibration', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.session.changeNote()
    fixture.feed(300, { midi: 60 })
    expect(fixture.session.snapshot().target).toBeNull()
    fixture.session.configureRoom(SECOND_ROOM)
    expect(fixture.session.snapshot().target).toBe(57)
    await fixture.session.start()
    expect(fixture.session.snapshot().mode).toBe('listening')
    fixture.feed(1100)
    expect(fixture.session.snapshot().room.protectedIds).toEqual(['bell'])
  })

  it('does not recreate capture or lose partial progress for equivalent descriptors', async () => {
    const fixture = setup('57', SECOND_ROOM)
    await fixture.session.start()
    fixture.feed(500)
    const before = fixture.session.snapshot()
    fixture.session.configureRoom({
      ...SECOND_ROOM,
      vesselIds: [...SECOND_ROOM.vesselIds],
      curtainVesselIds: [...SECOND_ROOM.curtainVesselIds!],
    })
    expect(fixture.session.snapshot()).toEqual(before)
    expect(fixture.released()).toBe(0)
    fixture.feed(550)
    expect(fixture.session.snapshot().room.protectedIds).toEqual(['bell'])
  })

  it('loads completion for the same room and treats completed initial visits as resting', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.feed(500)
    fixture.session.configureRoom({ ...FIRST_ROOM, completed: true })
    expect(fixture.created[0]!.active).toBe(false)
    expect(fixture.session.snapshot()).toMatchObject({
      roomId: 'first',
      mode: 'complete',
      room: { phase: 'complete' },
    })
    fixture.session.reset()
    await fixture.session.start()
    expect(fixture.created).toHaveLength(1)
    expect(fixture.completed).toEqual([])
    const revisit = setup('57', { ...THIRD_ROOM, completed: true })
    await revisit.session.start()
    revisit.session.tick(2000)
    revisit.session.reset()
    expect(revisit.created).toHaveLength(0)
    expect(revisit.session.snapshot().mode).toBe('complete')
    expect(revisit.completed).toEqual([])
  })

  it('does not play or apply the old result after completion synchronously enters a new room', async () => {
    const fixture = setup()
    fixture.setOnComplete(() => fixture.session.configureRoom(SECOND_ROOM))
    await fixture.session.start()
    complete(fixture)
    expect(fixture.completed).toEqual(['first'])
    expect(fixture.session.snapshot()).toMatchObject({
      roomId: 'second',
      mode: 'off',
      room: { protectedIds: [] },
    })
    expect(fixture.sounds).toHaveLength(0)
    expect(fixture.created).toHaveLength(1)
  })

  it('lets a newer room change during capture release win without reviving the older transition', async () => {
    const fixture = setup()
    await fixture.session.start()
    fixture.setOnRelease(() => fixture.session.configureRoom(THIRD_ROOM))
    fixture.session.configureRoom(SECOND_ROOM)
    expect(fixture.session.snapshot()).toMatchObject({
      roomId: 'third',
      mode: 'off',
    })
    expect(fixture.created[0]!.active).toBe(false)
  })

  it('rejects invalid room content without retiring working capture', async () => {
    const fixture = setup()
    await fixture.session.start()
    expect(() =>
      fixture.session.configureRoom({
        ...SECOND_ROOM,
        curtainVesselIds: ['foreign'],
      }),
    ).toThrow()
    expect(fixture.session.snapshot()).toMatchObject({
      roomId: 'first',
      mode: 'listening',
    })
    expect(fixture.created[0]!.active).toBe(true)
    expect(fixture.released()).toBe(0)
  })
})
