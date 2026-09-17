// A session-scoped drummer borrows the room graph and either scheduled score beats or one manual-tempo clock.
import { humanizeDrumEvents } from '@/features/drum-night/groove/groove-humanize'
import type { GuitarRoomDrumPlayerPort } from '@/features/guitar/backing/guitar-room-drum-player'
import { createLazyGuitarRoomDrumPlayer } from '@/features/guitar/backing/guitar-room-drum-player'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import { setGuitarSessionGainTarget } from '@/features/guitar/backing/guitar-session-audio-graph'
import { drumVoiceForMidi } from '@/lib/drum-voice-map'
import type { GuitarDrummerPerformanceHit } from '@/lib/guitar/recording-types'
import type { SessionBeatEvent, SessionBeatWindow, } from '@/lib/session-beat-clock'
import type { SessionDrummerSettings } from './session-drummer-pattern'
import { arrangeDrummerPhrase, drummerPattern } from './session-drummer-pattern'

export interface SessionDrummerEngineOptions {
  activateGraph(): Promise<GuitarSessionAudioGraph | null>
  onBar(bar: number): void
  onApplied(settings: SessionDrummerSettings): void
  onHit?(hit: GuitarDrummerPerformanceHit): void
  createPlayer?: typeof createLazyGuitarRoomDrumPlayer
}

export function createSessionDrummerEngine(
  options: SessionDrummerEngineOptions,
) {
  let graph: GuitarSessionAudioGraph | null = null
  let output: GainNode | null = null
  let player: GuitarRoomDrumPlayerPort | null = null
  let settings: SessionDrummerSettings | null = null
  let pending: SessionDrummerSettings | null = null
  let hits: ReturnType<typeof arrangeDrummerPhrase> = []
  let armed = false
  let disposed = false
  let generation = 0
  let lastIteration = -1
  let interval: ReturnType<typeof setInterval> | null = null
  const uiTimers = new Set<ReturnType<typeof setTimeout>>()

  const silence = () => {
    if (interval !== null) clearInterval(interval)
    interval = null
    for (const timer of uiTimers) clearTimeout(timer)
    uiTimers.clear()
    if (output && graph)
      setGuitarSessionGainTarget(output.gain, 0, graph.context.currentTime)
    player?.panic()
  }
  const apply = (next: SessionDrummerSettings) => {
    settings = next
    pending = null
    hits = arrangeDrummerPhrase(next)
    player?.setKit(next.kitId)
    void player
      ?.prewarm?.(
        hits.map((hit) => ({ gmKey: hit.gmKey, velocity: hit.velocity })),
      )
      .catch(() => undefined)
    options.onApplied(next)
  }
  const schedule = (window: SessionBeatWindow) => {
    if (!armed || !settings || !graph || !output || !player) return
    if (
      pending &&
      (Number.isInteger(window.startBeat / 4) ||
        window.iteration !== lastIteration)
    )
      apply(pending)
    lastIteration = window.iteration
    const config = settings
    const phraseBeats = config.bars * 4
    const startTime = window.timeAtBeat(window.startBeat)
    setGuitarSessionGainTarget(
      output.gain,
      config.level,
      Math.max(graph.context.currentTime, startTime),
    )
    const selected: Array<(typeof hits)[number]> = []
    for (
      let cycle = Math.floor(window.startBeat / phraseBeats) * phraseBeats;
      cycle < window.endBeat;
      cycle += phraseBeats
    ) {
      for (const hit of hits) {
        const beat = hit.beat + cycle
        if (beat >= window.startBeat && beat < window.endBeat)
          selected.push({ ...hit, beat })
      }
    }
    const tempoBpm = 60 / (window.timeAtBeat(window.startBeat + 1) - startTime)
    const shaped = humanizeDrumEvents(
      selected.map((hit) => ({
        articulation: drumVoiceForMidi(hit.gmKey) ?? 'snare',
        bar: 0,
        step: (hit.beat % 4) * 4,
        velocity: hit.velocity,
      })),
      {
        style: drummerPattern(config.patternId).style,
        intensity: 0,
        seed: 7,
        tempoBpm,
        locked: true,
      },
    )
    selected.forEach((hit, index) => {
      const at = window.timeAtBeat(hit.beat) + shaped[index].timeOffsetMs / 1000
      // Never backfill after a suspended tab or stalled scheduler.
      if (at < graph!.context.currentTime - 0.015) return
      const scheduledAt = Math.max(graph!.context.currentTime, at)
      const outcome = player!.trigger({
        gmKey: hit.gmKey,
        velocity: shaped[index].velocity,
        atContextTime: scheduledAt,
        lane: 'authored',
        sourceId: `session-drummer:${generation}:${window.iteration}:${hit.beat}:${hit.gmKey}`,
      })
      if (outcome !== 'dropped' && outcome !== 'unmapped')
        options.onHit?.({
          contextTime: scheduledAt,
          gmKey: hit.gmKey,
          velocity: shaped[index].velocity,
          kitId: config.kitId,
          level: config.level,
        })
    })
    const operation = generation
    const timer = setTimeout(
      () => {
        uiTimers.delete(timer)
        if (!disposed && armed && operation === generation)
          options.onBar(Math.floor(window.startBeat / 4) % config.bars)
      },
      Math.max(0, (startTime - graph.context.currentTime) * 1000),
    )
    uiTimers.add(timer)
  }
  const stop = () => {
    generation++
    armed = false
    lastIteration = -1
    pending = null
    silence()
  }
  return {
    async start(
      next: SessionDrummerSettings,
      followScore: boolean,
    ): Promise<boolean> {
      stop()
      const operation = generation
      const activated = await options.activateGraph()
      if (disposed || operation !== generation || !activated) return false
      if (graph && graph !== activated)
        throw new Error('The drummer audio output changed. Reopen the room.')
      graph = activated
      if (!output) {
        output = graph.context.createGain()
        output.gain.value = 0
        output.connect(graph.buses.drums)
        player = (options.createPlayer ?? createLazyGuitarRoomDrumPlayer)({
          getAudioContext: () => graph?.context ?? null,
          getOutput: () => output,
          kitId: next.kitId,
        })
      }
      player!.setKit(next.kitId)
      const ready = await player!.activate()
      if (disposed || operation !== generation || !ready) return false
      apply(next)
      armed = true
      if (!followScore) {
        let beat = 0
        let at = graph.context.currentTime + 0.09
        const tick = () => {
          if (!armed || !graph || !settings) return
          const now = graph.context.currentTime
          // A long background stall skips elapsed beats instead of emitting a burst.
          if (at < now - 0.1) {
            const skipped = Math.ceil(((now - at) * settings.tempoBpm) / 60)
            beat += skipped
            at += (skipped * 60) / settings.tempoBpm
          }
          while (at <= now + 0.12) {
            if (pending && beat % 4 === 0) apply(pending)
            const beatSeconds = 60 / settings.tempoBpm
            const from = beat
            const origin = at
            schedule({
              kind: 'beat',
              startBeat: from,
              endBeat: from + 1,
              iteration: 0,
              timeAtBeat: (value) => origin + (value - from) * beatSeconds,
            })
            beat++
            at += beatSeconds
          }
        }
        tick()
        interval = setInterval(tick, 25)
      }
      return true
    },
    accept(event: SessionBeatEvent) {
      if (event.kind === 'stop') silence()
      else schedule(event)
    },
    update(next: SessionDrummerSettings) {
      if (armed) pending = next
      else apply(next)
    },
    setLevel(level: number) {
      if (settings) settings = { ...settings, level }
      if (pending) pending = { ...pending, level }
      if (output && graph)
        setGuitarSessionGainTarget(
          output.gain,
          armed ? level : 0,
          graph.context.currentTime,
        )
    },
    snapshot: () => player?.snapshot?.() ?? null,
    stop,
    async dispose() {
      disposed = true
      stop()
      await player?.dispose()
      // The shared player's panic releases its voices asynchronously. Keep our
      // output connected through that short tail instead of cutting the ramp.
      const retiredOutput = output
      setTimeout(() => retiredOutput?.disconnect(), 80)
      // The host owns its graph/context. Never close or dispose it here.
    },
  }
}
