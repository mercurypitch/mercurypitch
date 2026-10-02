// Runner session tests — microphone ownership, raw capture evidence and explicit interrupted recovery.
import { describe, expect, it, vi } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course'
import type { RunnerSessionFrame } from '../runner/session-contracts'
import type { RunnerCourseFixturePace } from './__fixtures__/runner-course'
import { runnerCourseFixture } from './__fixtures__/runner-course'
import { deferred, flush, runnerSessionHarness, } from './__fixtures__/runner-session'

const resumePacingVariants: readonly {
  name: string
  pace: RunnerCourseFixturePace
  checkpointSeconds: number
  checkpointBpm: number
}[] = [
  {
    name: 'current',
    pace: 'current',
    checkpointSeconds: 40,
    checkpointBpm: 108,
  },
  {
    name: 'learning',
    pace: 'learning',
    checkpointSeconds: 320 / 7,
    checkpointBpm: 96,
  },
]

describe('runner session readiness and clock', () => {
  it('keeps delayed continuous capture alive across faster presentation frames', async () => {
    const h = runnerSessionHarness(SINGING_CURRENT)
    h.session.setPresentationReady(true)
    await h.session.start()
    const startedAt = h.clock()
    const captureHopSeconds = 1024 / 48_000
    const deliveryLatencySeconds = 0.15
    const frameSeconds = 1 / 60
    let captureAt = startedAt + captureHopSeconds
    let frameAt = startedAt + frameSeconds
    const finishAt = startedAt + 0.9

    while (
      h.session.state().phase === 'readiness' &&
      Math.min(captureAt + deliveryLatencySeconds, frameAt) <= finishAt
    ) {
      if (frameAt <= captureAt + deliveryLatencySeconds) {
        h.tick(frameAt)
        frameAt += frameSeconds
      } else {
        h.emit(captureAt, 60, deliveryLatencySeconds)
        captureAt += captureHopSeconds
      }
    }

    expect(h.session.state()).toMatchObject({
      phase: 'count-in',
      readiness: null,
    })
    h.session.dispose()
  })

  it('reports readiness input and semantic pitch feedback with independent freshness', async () => {
    const h = runnerSessionHarness()
    await h.session.start()
    expect(h.session.state()).toMatchObject({
      readiness: {
        receivingInput: false,
        pitchFeedback: { state: 'neutral' },
      },
    })

    h.emit(h.clock() + 0.01, 61)
    expect(h.session.state()).toMatchObject({
      readiness: {
        receivingInput: true,
        fillProgress: 0,
        pitchFeedback: {
          state: 'wrong',
          observedMidi: 61,
          comparedTargetMidi: 60,
          errorCents: 100,
          correction: 'lower',
        },
      },
    })

    h.tick(h.clock() + h.course.voice.judge.maximumEvidenceGapSeconds + 0.001)
    expect(h.session.state()).toMatchObject({
      readiness: {
        receivingInput: true,
        fillProgress: 0,
        pitchFeedback: { state: 'neutral' },
      },
    })
    h.tick(
      h.clock() + h.course.voice.judge.maximumDeliveryLatencySeconds + 0.001,
    )
    expect(h.session.state()).toMatchObject({
      readiness: {
        receivingInput: false,
        pitchFeedback: { state: 'neutral' },
      },
    })

    h.emit(h.clock() + 0.01, null)
    expect(h.session.state()).toMatchObject({
      readiness: {
        receivingInput: true,
        fillProgress: 0,
        pitchFeedback: { state: 'neutral' },
      },
    })
    h.session.dispose()
  })

  it.each([48_000, 96_000])(
    'judges %i Hz capture callbacks immediately while presenting only on animation frames',
    async (sampleRate) => {
      const h = runnerSessionHarness()
      await h.running()
      const presentations = vi.fn()
      const targetEvents: string[] = []
      h.session.subscribe(({ events, presentation }) => {
        if (presentation === true) presentations()
        for (const event of events)
          if (event.type.startsWith('target-')) targetEvents.push(event.type)
      })
      const anchor = h.audio[0]!.anchor!
      const target = h.course.targets[0]!
      const hopSeconds = 1024 / sampleRate
      let courseSeconds = hopSeconds
      for (
        ;
        courseSeconds <= target.settleAfterCourseSeconds + hopSeconds;
        courseSeconds += hopSeconds
      )
        h.emit(anchor.audioStartSeconds + courseSeconds)

      expect(h.session.state().game.resolvedTargets[0]?.outcome).toBe('hit')
      expect(targetEvents).toEqual(['target-hit'])
      expect(h.host.saveRunnerProgress).toHaveBeenCalled()
      h.session.setMusicMuted(true)
      expect(h.session.input('lane-left')).toBe(true)
      expect(presentations).not.toHaveBeenCalled()
      expect(h.frames.size).toBe(1)
      h.courseTick(courseSeconds)
      expect(presentations).toHaveBeenCalledOnce()
      expect(targetEvents).toEqual(['target-hit'])
      h.session.dispose()
      expect(h.frames.size).toBe(0)
    },
  )

  it('presents checkpoint staging immediately and keeps later readiness on its animation frame', async () => {
    const h = runnerSessionHarness()
    const phases: string[] = []
    h.session.subscribe(({ state, presentation }) => {
      if (presentation === true) phases.push(state.phase)
    })
    h.session.setPresentationReady(true)
    await h.session.start()
    h.tick(h.clock() + 0.01)
    expect(phases).toEqual(['preparing', 'readiness'])
    h.ready()
    expect(h.session.state().phase).toBe('count-in')
    expect(phases).toEqual(['preparing', 'readiness'])
    const anchor = h.audio[0]!.anchor!
    h.tick(anchor.audioStartSeconds - 0.1)
    h.tick(anchor.audioStartSeconds)
    expect(phases).toEqual(['preparing', 'readiness', 'count-in', 'running'])
    h.session.pause()
    expect(h.frames.size).toBe(0)
    h.session.dispose()
  })

  it('opens one microphone only on Start, then requires fresh evidence and presentation readiness', async () => {
    const h = runnerSessionHarness()
    expect(h.host.createVoice).not.toHaveBeenCalled()
    const pending = h.session.start()
    expect(h.host.prepareVoiceGesture).toHaveBeenCalledOnce()
    expect(h.audio[0]!.unlock).toHaveBeenCalledOnce()
    expect(h.voices[0]!.start).toHaveBeenCalledOnce()
    await pending
    h.ready()
    expect(h.session.state().phase).toBe('readiness')
    expect(h.session.state().game.courseSeconds).toBe(0)
    h.tick(h.clock() + 1)
    expect(h.session.state().readiness?.fillProgress).toBe(0)
    h.session.setPresentationReady(true)
    expect(h.session.state().phase).toBe('readiness')
    h.ready()
    expect(h.session.state().phase).toBe('count-in')
    const anchor = h.audio[0]!.anchor!
    h.tick(anchor.audioStartSeconds - 0.1)
    expect(h.session.state().game.courseSeconds).toBe(0)
    h.tick(anchor.audioStartSeconds)
    expect(h.session.state().phase).toBe('running')
    expect(h.host.createVoice).toHaveBeenCalledOnce()
    h.courseTick(0.1)
    expect(h.session.state().game.courseSeconds).toBeCloseTo(0.1)
    h.session.dispose()
  })

  it('rejects old/future/duplicate readiness evidence and never fills from frame polling', async () => {
    const h = runnerSessionHarness()
    h.session.setPresentationReady(true)
    await h.session.start()
    h.emit(9)
    h.emit(10.1, 60, -0.01)
    h.emit(10.2, 60, 0.2)
    for (let i = 0; i < 20; i++) h.tick(10.5 + i / 100)
    expect(h.session.state().readiness).toMatchObject({
      fillProgress: 0,
      receivingInput: false,
      pitchFeedback: { state: 'neutral' },
    })
    h.ready()
    expect(h.session.state().phase).toBe('count-in')
    h.session.dispose()
  })

  it('judges capture time with bounded late delivery before advancing the settlement boundary', async () => {
    const h = runnerSessionHarness()
    await h.running()
    const target = h.course.targets[0]!,
      anchor = h.audio[0]!.anchor!
    for (let t = 0.05; t < target.onsetCourseSeconds; t += 0.05) h.courseTick(t)
    const results: string[] = []
    h.session.subscribe(({ events }) => {
      for (const event of events)
        if (event.type.startsWith('target-')) results.push(event.type)
    })
    for (
      let t = target.onsetCourseSeconds;
      t <= target.endCourseSeconds + 1e-8;
      t += 0.05
    )
      h.emit(anchor.audioStartSeconds + t, 60, 0.1)
    h.courseTick(target.settleAfterCourseSeconds + 0.001)
    expect(h.session.state().game.resolvedTargets[0]?.outcome).toBe('hit')
    expect(results).toEqual(['target-hit'])
    expect(h.host.createVoice).toHaveBeenCalledOnce()
    h.session.dispose()
  })

  it('ducks accompaniment for the next ordered charge note before its authored slot', async () => {
    const fixture = runnerCourseFixture()
    const scheduled = fixture.targets[0]!
    const midpoint =
      (scheduled.onsetCourseSeconds + scheduled.endCourseSeconds) / 2
    const chargeCourse = {
      ...fixture,
      targets: [
        {
          ...scheduled,
          completionPolicy: 'charge' as const,
          completionFingerprint: 'charge-session-test-v1',
          notes: [
            {
              ...scheduled.notes[0]!,
              endBeat:
                (scheduled.notes[0]!.startBeat + scheduled.notes[0]!.endBeat) /
                2,
              endCourseSeconds: midpoint,
              minimumReliableSeconds: 0.05,
            },
            {
              ...scheduled.notes[0]!,
              index: 1,
              startOffsetSemitones: 2,
              endOffsetSemitones: 2,
              startBeat:
                (scheduled.notes[0]!.startBeat + scheduled.notes[0]!.endBeat) /
                2,
              startCourseSeconds: midpoint,
              minimumReliableSeconds: 0.05,
            },
          ],
        },
      ],
    }
    const h = runnerSessionHarness(chargeCourse)
    await h.running()
    const anchor = h.audio[0]!.anchor!
    for (let time = 0.2; time < scheduled.onsetCourseSeconds; time += 0.2)
      h.courseTick(time)
    for (const offset of [0.01, 0.04, 0.07])
      h.emit(anchor.audioStartSeconds + scheduled.onsetCourseSeconds + offset)

    expect(h.session.state().game.activeTarget).toMatchObject({
      noteIndex: 1,
      currentTargetMidi: 62,
    })
    expect(scheduled.onsetCourseSeconds + 0.08).toBeLessThan(midpoint)
    h.emit(anchor.audioStartSeconds + scheduled.onsetCourseSeconds + 0.08, 62)
    expect(h.audio[0]!.setVoiceActive).toHaveBeenLastCalledWith(true)
    h.session.dispose()
  })

  it('publishes fresh feedback immediately, expires it on course time, and does not revive it after resume', async () => {
    const h = runnerSessionHarness()
    await h.running()
    const target = h.course.targets[0]!
    const captureCourseSeconds = target.onsetCourseSeconds + 0.05
    const anchor = h.audio[0]!.anchor!
    for (let time = 0.2; time < captureCourseSeconds; time += 0.2)
      h.courseTick(time)

    h.emit(anchor.audioStartSeconds + captureCourseSeconds)
    expect(h.session.state().game.activeTarget?.pitchFeedback).toMatchObject({
      state: 'accepted',
      observedMidi: 60,
      comparedTargetMidi: 60,
      correction: null,
    })

    h.courseTick(
      captureCourseSeconds +
        h.course.voice.judge.maximumEvidenceGapSeconds +
        0.02,
    )
    expect(h.session.state().game.activeTarget?.pitchFeedback.state).toBe(
      'neutral',
    )
    h.emit(h.clock() + 0.01)
    h.courseTick(
      h.session.state().game.courseSeconds +
        h.course.movement.fixedStepSeconds * 2,
    )
    expect(h.session.state().game.activeTarget?.pitchFeedback.state).toBe(
      'accepted',
    )

    h.session.pause()
    expect(h.session.state().game.activeTarget?.pitchFeedback.state).toBe(
      'neutral',
    )
    await h.session.resume()
    h.ready()
    h.tick(h.audio.at(-1)!.anchor!.audioStartSeconds)
    expect(h.session.state().game.activeTarget?.pitchFeedback.state).toBe(
      'neutral',
    )
    h.session.dispose()
  })

  it('keeps eligible feedback visible while the next capture waits for the fixed-step clock', async () => {
    const h = runnerSessionHarness()
    await h.running()
    const target = h.course.targets[0]!
    const anchor = h.audio[0]!.anchor!
    const step = h.course.movement.fixedStepSeconds
    const firstCapture = target.onsetCourseSeconds + 0.001
    for (let time = 0.2; time < firstCapture; time += 0.2) h.courseTick(time)

    h.emit(anchor.audioStartSeconds + firstCapture)
    expect(h.session.state().game.activeTarget?.pitchFeedback.state).toBe(
      'neutral',
    )
    h.courseTick(firstCapture + step)
    expect(h.session.state().game.activeTarget?.pitchFeedback.state).toBe(
      'accepted',
    )

    const futureCapture = firstCapture + step + 0.001
    h.emit(anchor.audioStartSeconds + futureCapture, 61)
    expect(h.session.state().game.activeTarget?.pitchFeedback.state).toBe(
      'accepted',
    )
    h.courseTick(futureCapture + step)
    expect(h.session.state().game.activeTarget?.pitchFeedback).toMatchObject({
      state: 'wrong',
      correction: 'lower',
    })
    h.session.dispose()
  })

  it('keeps music mute independent of capture, movement and progress', async () => {
    const h = runnerSessionHarness()
    await h.running()
    h.session.setMusicMuted(true)
    h.courseTick(0.1)
    expect(h.session.input('lane-left')).toBe(true)
    h.courseTick(0.2)
    expect(h.session.state().game.courseSeconds).toBeCloseTo(0.2)
    expect(h.session.state().game.player.lateralX).toBeLessThan(0)
    expect(h.voices[0]!.stop).not.toHaveBeenCalled()
    expect(h.audio[0]!.setMuted).toHaveBeenLastCalledWith(true)
    expect(h.preferences.get('runner-music-muted:v1')).toBe('true')
    h.session.dispose()
  })
})

describe('runner interruption and cancellation', () => {
  it.each(['capture', 'input'] as const)(
    'accepts %s after a legal catch-up interval with a fractional fixed-step remainder',
    async (kind) => {
      const h = runnerSessionHarness()
      await h.running()
      const anchor = h.audio[0]!.anchor!
      for (let frame = 1; frame <= 25; frame++) h.courseTick(frame * 0.2)
      h.courseTick(5.249)
      expect(h.session.state().game.courseSeconds).toBeCloseTo(5.2416667)
      if (kind === 'capture') {
        h.emit(anchor.audioStartSeconds + 5.499, 60)
        expect(h.session.state().game.activeTarget?.pitchFeedback.state).toBe(
          'neutral',
        )
      } else {
        h.setAudioTime(anchor.audioStartSeconds + 5.499)
        expect(h.session.input('lane-left')).toBe(true)
      }
      expect(h.session.state().phase).toBe('running')
      expect(h.session.state().game.courseSeconds).toBeCloseTo(5.4916667)
      if (kind === 'capture') {
        h.courseTick(5.51)
        expect(
          h.session.state().game.activeTarget?.pitchFeedback,
        ).toMatchObject({ state: 'accepted', errorCents: 0 })
      }
      h.courseTick(5.8)
      expect(h.session.state().phase).toBe('recovering')
      expect(h.frames.size).toBe(0)
      h.session.dispose()
    },
  )

  it('honors synchronous presentation cancellation before opening any resources', async () => {
    const h = runnerSessionHarness()
    h.session.subscribe(({ state }) => {
      if (state.phase === 'preparing') h.session.pause('renderer-unavailable')
    })
    await h.session.start()
    expect(h.session.state().phase).toBe('paused')
    expect(h.host.createVoice).not.toHaveBeenCalled()
    expect(h.host.createRunnerAudio).not.toHaveBeenCalled()
    h.session.dispose()
  })

  it('rejects a gesture that arrives after an excessive clock gap before the next frame', async () => {
    const h = runnerSessionHarness()
    await h.running()
    h.setAudioTime(h.clock() + 2)
    expect(h.session.input('jump')).toBe(false)
    expect(h.session.state().phase).toBe('recovering')
    expect(h.session.state().game.player.grounded).toBe(true)
    h.session.dispose()
  })

  it.each(resumePacingVariants)(
    'resumes the $name pace at the last checkpoint with its tempo and restarts at beat zero on request',
    async ({ pace, checkpointSeconds, checkpointBpm }) => {
      const h = runnerSessionHarness(runnerCourseFixture(pace))
      await h.running()
      for (let t = 0.2; t < checkpointSeconds + 0.4; t += 0.2) h.courseTick(t)
      h.session.pause()
      await h.session.resume()
      h.ready()
      const schedule = h.audio.at(-1)!.anchor!
      expect(schedule.courseStartSeconds).toBeCloseTo(checkpointSeconds, 12)
      expect(schedule.secondsPerBeat).toBe(60 / checkpointBpm)
      h.tick(schedule.audioStartSeconds)
      expect(h.session.state().game.courseSeconds).toBeCloseTo(
        checkpointSeconds,
        12,
      )
      expect(h.session.state().game.resolvedTargets).toHaveLength(1)
      await h.session.restart()
      h.ready()
      h.tick(h.audio.at(-1)!.anchor!.audioStartSeconds)
      expect(h.session.state().game.courseSeconds).toBe(0)
      expect(h.session.state().game.resolvedTargets).toEqual([])
      h.session.dispose()
    },
  )

  it('cleans a successful late takeover after cancellation and coalesces takeover requests', async () => {
    const h = runnerSessionHarness()
    h.setPermission(Promise.reject({ kind: 'held-elsewhere' }))
    await h.session.start()
    expect(h.session.state().error?.microphoneIssue?.action).toBe('take-over')
    const moved = deferred<boolean>()
    vi.mocked(h.host.takeOverMicrophone!).mockReturnValue(moved.promise)
    const first = h.session.takeOverMicrophone!()
    await h.session.takeOverMicrophone!()
    expect(h.host.takeOverMicrophone).toHaveBeenCalledOnce()
    h.session.dispose()
    moved.resolve(true)
    await first
    expect(h.host.releaseUnusedMicrophoneTakeover).toHaveBeenCalledOnce()
    expect(h.host.createVoice).toHaveBeenCalledOnce()
    expect(h.session.state().phase).toBe('disposed')
  })

  it('starts readiness after explicit takeover and returns a failed unused claim', async () => {
    const h = runnerSessionHarness()
    h.setPermission(Promise.reject({ kind: 'held-elsewhere' }))
    await h.session.start()
    h.setPermission(Promise.resolve())
    await h.session.takeOverMicrophone!()
    expect(h.session.state().phase).toBe('readiness')
    expect(h.host.releaseUnusedMicrophoneTakeover).not.toHaveBeenCalled()
    h.session.pause()
    h.setPermission(Promise.reject({ kind: 'held-elsewhere' }))
    await h.session.resume()
    h.setPermission(Promise.reject({ kind: 'no-device' }))
    await h.session.takeOverMicrophone!()
    expect(h.session.state().error?.microphoneIssue?.kind).toBe('no-device')
    expect(h.host.releaseUnusedMicrophoneTakeover).toHaveBeenCalledOnce()
    h.session.dispose()
  })

  it.each(['microphone', 'audio', 'background', 'presentation'] as const)(
    'closes on %s interruption and resumes only from a new gesture',
    async (reason) => {
      const h = runnerSessionHarness()
      await h.running()
      const oldEpoch = h.session.state().game.epoch
      if (reason === 'microphone') h.voices[0]!.interrupt()
      if (reason === 'audio') h.audio[0]!.interrupt()
      if (reason === 'background') h.foreground(false)
      if (reason === 'presentation') h.session.setPresentationReady(false)
      expect(h.session.state().phase).toBe('paused')
      expect(h.session.state().microphone).toBe('closed')
      expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
      expect(h.audio[0]!.dispose).toHaveBeenCalledOnce()
      expect(h.frames.size).toBe(0)
      h.foreground(true)
      h.session.setPresentationReady(true)
      expect(h.host.createVoice).toHaveBeenCalledOnce()
      await h.session.resume()
      h.ready()
      h.tick(h.audio.at(-1)!.anchor!.audioStartSeconds)
      expect(h.session.state().phase).toBe('running')
      expect(h.session.state().game.epoch).not.toBe(oldEpoch)
      h.emit(h.clock() + 0.01, 60, 0, h.voices[0]!)
      expect(h.session.state().game.courseSeconds).toBe(0)
      h.session.dispose()
    },
  )

  it('recovers from a large clock gap without accepting an action or simulating catch-up', async () => {
    const h = runnerSessionHarness()
    await h.running()
    h.courseTick(2)
    expect(h.session.state().phase).toBe('recovering')
    expect(h.session.state().game.courseSeconds).toBe(0)
    expect(h.session.input('jump')).toBe(false)
    expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
    h.session.dispose()
  })

  it('suppresses late microphone completion after disposal and newer starts', async () => {
    const h = runnerSessionHarness(),
      gate = deferred<undefined>()
    h.setPermission(gate.promise)
    const old = h.session.start()
    h.session.pause()
    h.setPermission(Promise.resolve())
    await h.session.resume()
    gate.resolve(undefined)
    await old
    expect(h.session.state().phase).toBe('readiness')
    expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
    expect(h.voices[1]!.stop).not.toHaveBeenCalled()
    h.session.dispose()
    expect(h.voices[1]!.stop).toHaveBeenCalledOnce()
    expect(h.frames.size).toBe(0)
  })

  it('waits for a cancelled reference tail before enabling readiness capture', async () => {
    const h = runnerSessionHarness()
    h.holdAudioRelease()
    const reference = h.session.hearReference()
    await flush()
    expect(h.host.createVoice).not.toHaveBeenCalled()
    const start = h.session.start()
    await flush()
    expect(h.voices[0]!.detectorReady).toBe(false)
    expect(h.session.state().phase).toBe('preparing')
    h.audio[0]!.release()
    await reference
    await start
    expect(h.voices[0]!.detectorReady).toBe(true)
    expect(h.session.state().phase).toBe('readiness')
    h.session.dispose()
    h.audio[1]!.release()
  })

  it('fans each event batch to subscribers once and closes capture at finite completion', async () => {
    const h = runnerSessionHarness()
    await h.running()
    const first = vi.fn(),
      second = vi.fn()
    h.session.subscribe(({ events }) => {
      if (events.length) first(events)
    })
    h.session.subscribe(({ events }) => {
      if (events.length) second(events)
    })
    for (let t = 0.2; t < h.course.lengthCourseSeconds; t += 0.2)
      h.courseTick(t)
    h.courseTick(h.course.lengthCourseSeconds)
    expect(h.session.state().phase).toBe('finished')
    h.foreground(false)
    h.foreground(true)
    expect(h.session.state().phase).toBe('finished')
    expect(first.mock.calls).toEqual(second.mock.calls)
    expect(
      first.mock.calls
        .flatMap(([events]) => events)
        .filter((event) => event.type === 'course-finished'),
    ).toHaveLength(1)
    expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
    expect(h.host.saveRunnerProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: true }),
    )
    h.session.dispose()
  })

  it.each(['capture', 'input', 'frame'] as const)(
    'publishes the finished snapshot once when %s reaches the course end before the queued frame',
    async (trigger) => {
      const h = runnerSessionHarness()
      await h.running()
      const terminalFrames: RunnerSessionFrame[] = []
      h.session.subscribe((next) => {
        if (next.state.phase === 'finished') terminalFrames.push(next)
      })
      const beforeEnd = h.course.lengthCourseSeconds - 0.1
      for (let time = 0.2; time < beforeEnd; time += 0.2) h.courseTick(time)
      h.courseTick(beforeEnd)
      expect(h.frames.size).toBe(1)
      const endAudioSeconds =
        h.audio[0]!.anchor!.audioStartSeconds + h.course.lengthCourseSeconds

      if (trigger === 'capture') h.emit(endAudioSeconds, null)
      else if (trigger === 'input') {
        h.setAudioTime(endAudioSeconds)
        h.session.input('jump')
      } else h.courseTick(h.course.lengthCourseSeconds)

      expect(h.session.state()).toMatchObject({
        phase: 'finished',
        microphone: 'closed',
        game: {
          status: 'finished',
          courseSeconds: h.course.lengthCourseSeconds,
        },
      })
      expect(terminalFrames).toHaveLength(1)
      expect(terminalFrames[0]).toMatchObject({
        presentation: true,
        state: { phase: 'finished', game: { status: 'finished' } },
      })
      expect(
        terminalFrames[0]!.events.filter(
          (event) => event.type === 'course-finished',
        ),
      ).toHaveLength(1)
      expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
      expect(h.audio[0]!.dispose).toHaveBeenCalledOnce()
      expect(h.frames.size).toBe(0)
      expect(h.host.saveRunnerProgress).toHaveBeenLastCalledWith(
        expect.objectContaining({ completed: true }),
      )

      h.emit(endAudioSeconds + 0.01, null)
      h.tick(endAudioSeconds + 0.01)
      expect(terminalFrames).toHaveLength(1)
      h.session.dispose()
    },
  )

  it.each(['capture', 'input', 'frame'] as const)(
    'publishes recovery once when %s detects a clock gap before the queued frame',
    async (trigger) => {
      const h = runnerSessionHarness()
      await h.running()
      const terminalFrames: RunnerSessionFrame[] = []
      h.session.subscribe((next) => {
        if (next.state.phase === 'recovering') terminalFrames.push(next)
      })
      const stalledAudioSeconds = h.clock() + 2

      if (trigger === 'capture') h.emit(stalledAudioSeconds, null)
      else if (trigger === 'input') {
        h.setAudioTime(stalledAudioSeconds)
        h.session.input('jump')
      } else h.tick(stalledAudioSeconds)

      expect(h.session.state()).toMatchObject({
        phase: 'recovering',
        microphone: 'closed',
        game: { status: 'recovering' },
      })
      expect(terminalFrames).toHaveLength(1)
      expect(terminalFrames[0]).toMatchObject({
        presentation: true,
        state: { phase: 'recovering', game: { status: 'recovering' } },
      })
      expect(
        terminalFrames[0]!.events.filter(
          (event) => event.type === 'recovery-required',
        ),
      ).toHaveLength(1)
      expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
      expect(h.audio[0]!.dispose).toHaveBeenCalledOnce()
      expect(h.frames.size).toBe(0)

      h.emit(stalledAudioSeconds + 0.01, null)
      h.tick(stalledAudioSeconds + 0.01)
      expect(terminalFrames).toHaveLength(1)
      h.session.dispose()
    },
  )
})
