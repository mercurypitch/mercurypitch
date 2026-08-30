// ============================================================
// Merc's Journey — the first playable slice (game-design.md Part 2).
//
// A side-scrolling stage driven entirely by pitch (voice = joystick):
//   climb 3 note-platforms → shatter the gate pane → cross the melody
//   bridge over the void (glass steps, sung in order, crack if you
//   linger) → land the goal ledge → charge the final wall until it
//   bursts. Silence = rest on the platform under you; resting where
//   nothing holds you = the fall → game over → retry from the
//   checkpoint ledge.
//
// Every tunable lives in journey-config.ts (JOURNEY_CONFIG) — nothing
// here hard-codes game feel.
// ============================================================

import { midiToNoteNameOctave, playTargetHum } from '@irchiinnuss/pitch-engine'
import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, Show, untrack } from 'solid-js'
import './pitch-assets'
import './journey.css'
import { createSingDriver } from './drivers/sing'
import { createTapDriver } from './drivers/tap'
import type { InteractionDriver } from './drivers/types'
import { JOURNEY_CONFIG } from './journey-config'
import { compileLevel } from './levels/compile'
import type { GameFeel } from './levels/feel'
import { applyFeel } from './levels/feel'
import type { LevelDef } from './levels/types'
import type { Boss, Node, Pane, Platform, WhisperZone } from './world-types'

const MIC_ID = 'journey-proto'
const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

type Phase = 'intro' | 'ground' | 'play' | 'cue' | 'fallen' | 'done'

export const JourneyPrototype: Component<{
  /** Hardcoded stages: 'journey' = chapter 1 (flow), 'trials' = the Jump
   * Trials tryout (platformer). Ignored when `level` is set. */
  variant?: 'journey' | 'trials'
  /** A melody level compiled at runtime (songs are levels). */
  level?: LevelDef
  /** Play mode for `level` — overrides the level's own default. */
  control?: 'flow' | 'platformer' | 'rhythm'
  /** Range setting: semitones to sit the song lower/higher (levels only). */
  rangeBias?: number
}> = (props) => {
  const mode = (): 'flow' | 'platformer' | 'rhythm' =>
    props.level !== undefined
      ? (props.control ?? props.level.control ?? 'flow')
      : (props.variant ?? 'journey') === 'trials'
        ? 'platformer'
        : 'flow'
  const isTrials = (): boolean => mode() === 'platformer'
  const isRhythm = (): boolean => mode() === 'rhythm'
  const [phase, setPhase] = createSignal<Phase>('intro')
  const [micError, setMicError] = createSignal<string | null>(null)
  const [hint, setHint] = createSignal('')
  const [cueText, setCueText] = createSignal('')
  const [soundOn, setSoundOn] = createSignal(true)
  const [humOn, setHumOn] = createSignal(true)

  let canvas!: HTMLCanvasElement
  let raf = 0
  /** The controller: today always the sing driver (voice pitch). Tap and
   * listen drivers slot in behind the same interface. */
  let driver: InteractionDriver | null = null
  /** Per-stage game feel: buildStage merges this level's `feel` overlay
   * over the defaults — every C.* read below is a per-level tunable. */
  let C: GameFeel = JOURNEY_CONFIG

  // --- world state ---
  let groundMidi = 0
  let platforms: Platform[] = []
  let panes: Pane[] = []
  let nodes: Node[] = []
  let activeIdx = 0
  /** node index of the last checkpoint landed (-1 = none) */
  let lastCheckpointIdx = -1
  let zones: WhisperZone[] = []
  let boss: Boss | null = null
  let camX = 0
  /** Vertical pan (Jump Trials): world-y fraction subtracted at draw time.
   * 0 = baseline framing; negative pans the view up with Merc. */
  let camY = 0
  let worldMax = 42

  let mercWX = 1.6
  let mercY = 0.8
  let falling = false
  let fallenMs = 0
  let rescueMs = 0
  let sinkMs = 0
  let pitchHist: { t: number; midi: number }[] = []
  let rawMidiNow: number | null = null
  let ghost: { wx: number; y: number }[] = []
  let arpeggioTimers: number[] = []
  // platformer (Jump Trials) state
  const keys = { left: false, right: false }
  let jumpVy = 0
  let coyoteLeftMs = 0
  // rhythm (tap) state: the road scrolls at tempo after the count-in
  let rhythmStartAt = 0
  let rhythmSpeed = 2 // world units / s
  let rhythmBpm = C.tap.bpmDefault

  /** Ground note persistence: sing calibration writes it; tap play (no
   * mic) reads it back so songs sit where this voice last sang. */
  const GROUND_KEY = 'beside-cue:games:last-ground'
  const readStoredGround = (): number => {
    try {
      const v = Number(window.localStorage.getItem(GROUND_KEY))
      return Number.isFinite(v) && v > 24 && v < 96 ? v : 57
    } catch {
      return 57
    }
  }
  let trail: { wx: number; y: number }[] = []
  let puff: { x: number; y: number; vx: number; vy: number; r: number }[] = []
  let puffT = -1

  // voice-edge hardening + rest state
  let voicedStreak = 0
  let unvoicedMs = 0
  let shownMidi: number | null = null
  let restIdx: number | null = null
  let groundSamples: { t: number; midi: number }[] = []

  const img = (src: string): HTMLImageElement => {
    const el = new Image()
    el.src = src
    return el
  }
  // Painterly world: parallax layers, material tiles, Merc pose sprites
  // (merc-lumen sheet). Poses stretch/lean in code — liquid droplet physics.
  const art = {
    sky: img('games/journey/sky-far.webp'),
    nebula: img('games/journey/nebula-mid.webp'),
    dust: img('games/journey/dust-near.webp'),
    crystal: img('games/journey/crystal-tex.webp'),
    stone: img('games/journey/stone-tex.webp'),
    mercIdle: img('games/journey/merc-idle.webp'),
    mercListening: img('games/journey/merc-listening.webp'),
    mercCelebrate: img('games/journey/merc-celebrate.webp'),
    mercSinging: img('games/journey/merc-singing.webp'),
  }
  const patterns: {
    crystal: CanvasPattern | null
    stone: CanvasPattern | null
  } = { crystal: null, stone: null }
  let prevMercY = 0.8
  let prevMercWX = 1.6
  let mercVy = 0 // canvas fractions / s (smoothed)
  let mercVx = 0 // world units / s (smoothed)
  let beads: { x: number; y: number; vx: number; vy: number; r: number }[] = []

  const voicedMidi = (): number | null => {
    return driver?.latestPitch()?.midi ?? null
  }

  // pitch window (semitone offsets rel. ground) — per-stage: melody
  // levels derive it from the melody's range at compile time
  let winLo: number = C.view.windowLoOffset
  let winHi: number = C.view.windowHiOffset

  const yFor = (midi: number): number => {
    const lo = groundMidi + winLo
    const hi = groundMidi + winHi
    return 1 - (midi - lo) / (hi - lo)
  }

  const note = (off: number): string => midiToNoteNameOctave(groundMidi + off)

  // the note the player should sing right now — null when there is no
  // pitch target (hidden door stays secret, whisper is about loudness)
  const objectiveMidi = (): number | null => {
    if (activeIdx >= nodes.length) return null
    const n = nodes[activeIdx]
    if (n.t === 'land') return n.p.midi
    if (n.t === 'pane') return n.pane.kind === 'hidden' ? null : n.pane.midi
    if (n.t === 'boss') {
      const alive = n.boss.crystals.filter((c) => !c.broken)
      if (alive.length === 0) return null
      const charging = alive.reduce((a, c) => (c.res > a.res ? c : a))
      if (charging.res > 0.04) return charging.midi
      const sm = shownMidi
      if (sm !== null) {
        return alive.reduce((a, c) =>
          Math.abs(c.midi - sm) < Math.abs(a.midi - sm) ? c : a,
        ).midi
      }
      return alive[0].midi
    }
    return null
  }

  // where Merc should hover during the boss: under the crystal his voice
  // is charging (else the one nearest his sung note), not arena center
  const bossTargetWX = (b: Boss): number => {
    if (!C.boss.trackCharging) return b.cx
    const alive = b.crystals.filter((c) => !c.broken)
    if (alive.length === 0) return b.cx
    const charging = alive.reduce((a, c) => (c.res > a.res ? c : a))
    if (charging.res > 0.04) return charging.wx
    const sm = shownMidi
    if (sm !== null) {
      return alive.reduce((a, c) =>
        Math.abs(c.midi - sm) < Math.abs(a.midi - sm) ? c : a,
      ).wx
    }
    return b.cx
  }

  const buildWorld = (): void => {
    worldMax = 42
    const P = (
      midi: number,
      x0: number,
      x1: number,
      kind: 'stone' | 'glass',
      extra?: Partial<Platform>,
    ): Platform => ({
      midi,
      x0,
      x1,
      kind,
      lit: false,
      dwell: 0,
      integrity: 1,
      broken: false,
      respawnMs: 0,
      ...extra,
    })
    const g = groundMidi
    const ground = P(g, 0.5, 3, 'stone', { lit: true, dwell: 9999 })
    const p1 = P(g + 2, 3, 5.5, 'glass')
    // p2 reaches under the gate's approach spot (pane 9.2 − approachBack)
    // so a breath while charging the gate always finds stone below.
    const p2 = P(g + 4, 5.5, 8.6, 'stone')
    const ledge = P(g + 2, 8.7, 10.3, 'stone')
    const [s1, s2, s3] = C.bridge.stepOffsets
    const step1 = P(g + s1, 11, 12.5, 'glass', { hum: true })
    const step2 = P(g + s2, 12.7, 14.2, 'glass', { hum: true })
    const step3 = P(g + s3, 14.4, 15.9, 'glass', { hum: true })
    const goal = P(g + 3, 16.1, 17.3, 'stone')

    // Act C — the melodic stairway: a literal scale, climbed in order
    const stairs = C.stairway.stepOffsets.map((off, i) =>
      P(g + off, 19.6 + i * 1.5, 20.8 + i * 1.5, i === 2 ? 'glass' : 'stone', {
        hum: C.stairway.hum,
      }),
    )
    const stairTop = P(g + 7, 27.3, 28.8, 'stone')

    // Act D — the whisper passage floor (stone: resting is safe, noise isn't)
    const hushA = P(g + 5, 29.2, 31.2, 'stone')
    const hushB = P(g + 4, 31.4, 33.4, 'stone')
    // reaches under the hidden door's approach spot (36.2 − approachBack)
    const hushExit = P(g + 5, 33.8, 35.7, 'stone')

    // Act F — the chandelier arena floor
    const arena = P(g + 3, 37, 41.2, 'stone')

    platforms = [
      ground,
      p1,
      p2,
      ledge,
      step1,
      step2,
      step3,
      goal,
      ...stairs,
      stairTop,
      hushA,
      hushB,
      hushExit,
      arena,
    ]

    const mkPane = (wx: number, midi: number, kind: Pane['kind']): Pane => ({
      wx,
      midi,
      kind,
      res: 0,
      burstT: -1,
      reveal: 0,
      shards: [],
    })
    const gate = mkPane(9.2, g + 6, 'gate')
    const wall = mkPane(17.8, g + 6, 'wall')
    // Act E — the hidden door: its note is a secret; sweep for it
    const door = mkPane(36.2, g + 8, 'hidden')
    panes = [gate, wall, door]

    const hush: WhisperZone = {
      x0: 29,
      x1: 33.6,
      gx: 31.3,
      gyMidi: g + 8,
      stir: 0,
      woken: false,
      wokenMs: 0,
    }
    zones = [hush]

    boss = {
      cx: 39.1,
      cleared: false,
      shards: [],
      crystals: C.boss.crystalOffsets.map((off, i) => ({
        midi: g + off,
        wx: 38 + i * 1.1,
        res: 0,
        broken: false,
        brokenMs: 0,
      })),
    }

    nodes = [
      {
        t: 'land',
        p: p1,
        hint: `Slide up to ${note(2)} — careful, it's icy glass.`,
      },
      { t: 'land', p: p2, hint: `Higher — hold ${note(4)} to land.` },
      {
        t: 'pane',
        pane: gate,
        hint: `The gate rings at ${note(6)}. Hold its note.`,
      },
      {
        t: 'land',
        p: ledge,
        hint: 'Land the ledge — a safe checkpoint.',
        checkpoint: true,
      },
      {
        t: 'land',
        p: step1,
        hint: 'The bridge: sing each step to cross the void.',
      },
      {
        t: 'land',
        p: step2,
        hint: 'Next step — keep moving, glass never waits.',
      },
      { t: 'land', p: step3, hint: 'Last step of the bridge.' },
      { t: 'land', p: goal, hint: 'Solid ground. Breathe.' },
      {
        t: 'pane',
        pane: wall,
        hint: `The wall. ${note(6)}, held until it gives.`,
      },
      ...stairs.map(
        (s, i): Node => ({
          t: 'land',
          p: s,
          hint:
            i === 0
              ? `A stairway of notes. Start at ${note(C.stairway.stepOffsets[0])} and climb the scale.`
              : `Next stair: ${midiToNoteNameOctave(s.midi)}.`,
        }),
      ),
      {
        t: 'land',
        p: stairTop,
        hint: 'The top of the scale — a safe place to breathe.',
        checkpoint: true,
      },
      {
        t: 'whisper',
        z: hush,
        hint: 'Something sleeps here. Cross singing SOFTLY — loud voices wake it.',
      },
      {
        t: 'land',
        p: hushExit,
        hint: 'Past the sleeper. Rest a moment.',
        checkpoint: true,
      },
      {
        t: 'pane',
        pane: door,
        hint: 'A silent door. Sweep your voice slowly — it glows when you are close.',
      },
      {
        t: 'boss',
        boss,
        hint: 'The Chandelier: break every crystal before the first re-anneals.',
      },
    ]
    lastCheckpointIdx = -1
    activeIdx = -1
    advanceTo(0)
    mercWX = 1.6
    mercY = yFor(g) - 0.035
    camX = 0
    camY = 0
    trail = []
    ghost = []
    falling = false
    fallenMs = 0
    rescueMs = 0
    sinkMs = 0
    pitchHist = []
    restIdx = null
  }

  // Jump Trials: a short platformer tryout — keys walk, the voice leaps.
  // Gap widths grow with the interval to the next note.
  const buildTrialsWorld = (): void => {
    worldMax = 23.5
    const P = (
      midi: number,
      x0: number,
      x1: number,
      kind: 'stone' | 'glass',
      extra?: Partial<Platform>,
    ): Platform => ({
      midi,
      x0,
      x1,
      kind,
      lit: false,
      dwell: 0,
      integrity: 1,
      broken: false,
      respawnMs: 0,
      ...extra,
    })
    const g = groundMidi
    const ground = P(g, 0.5, 4, 'stone', { lit: true, dwell: 9999 })
    const t1 = P(g + 2, 5.2, 6.7, 'stone')
    const t2 = P(g + 4, 8, 9.5, 'stone')
    const t3 = P(g + 3, 10.8, 12.3, 'stone')
    const t4 = P(g + 5, 13.7, 15.2, 'stone')
    const t5 = P(g + 7, 16.8, 18.3, 'stone')
    const goal = P(g + 4, 20.3, 22.3, 'stone')
    platforms = [ground, t1, t2, t3, t4, t5, goal]

    const gate: Pane = {
      wx: 19.5,
      midi: g + 6,
      kind: 'gate',
      res: 0,
      burstT: -1,
      reveal: 0,
      shards: [],
    }
    panes = [gate]
    zones = []
    boss = null

    nodes = [
      {
        t: 'land',
        p: t1,
        hint: `Walk to the edge, then sing ${note(2)} to leap across.`,
      },
      {
        t: 'land',
        p: t2,
        hint: `Higher ledge, higher note — ${note(4)}.`,
      },
      {
        t: 'land',
        p: t3,
        hint: `Down a step: ${note(3)}. A lower note is a smaller leap.`,
        checkpoint: true,
      },
      { t: 'land', p: t4, hint: `Up again — ${note(5)}.` },
      {
        t: 'land',
        p: t5,
        hint: `The big one: ${note(7)}. Hold it to glide the gap.`,
      },
      {
        t: 'pane',
        pane: gate,
        hint: `The gate rings at ${note(6)}. Stand and hold its note.`,
      },
      { t: 'land', p: goal, hint: 'Last leap. Land it and breathe.' },
    ]
    lastCheckpointIdx = -1
    activeIdx = -1
    advanceTo(0)
    mercWX = 1.4
    mercY = yFor(g) - 0.035
    restIdx = 0
    camX = 0
    camY = 0
    trail = []
    ghost = []
    falling = false
    fallenMs = 0
    rescueMs = 0
    sinkMs = 0
    jumpVy = 0
    coyoteLeftMs = C.control.coyoteMs
    pitchHist = []
  }

  const buildLevelStage = (level: LevelDef): void => {
    const cs = compileLevel(level, {
      mode: mode(),
      groundMidi,
      rangeBias: props.rangeBias ?? 0,
      feel: C,
    })
    const firstMelody = level.segments.find((s) => s.type === 'melody')
    rhythmBpm =
      (firstMelody?.type === 'melody' ? firstMelody.melody.bpm : undefined) ??
      C.tap.bpmDefault
    rhythmSpeed = C.melody.unitsPerBeat.rhythm * (rhythmBpm / 60)
    platforms = cs.platforms
    panes = cs.panes
    nodes = cs.nodes
    worldMax = cs.worldMax
    winLo = cs.windowLo
    winHi = cs.windowHi
    zones = []
    boss = null
    lastCheckpointIdx = -1
    activeIdx = -1
    advanceTo(0)
    mercWX = cs.startX
    mercY = yFor(cs.platforms[0].midi) - 0.035
    restIdx = 0
    camX = 0
    camY = 0
    trail = []
    ghost = []
    falling = false
    fallenMs = 0
    rescueMs = 0
    sinkMs = 0
    jumpVy = 0
    coyoteLeftMs = C.control.coyoteMs
    pitchHist = []
  }

  const buildStage = (): void => {
    C = applyFeel(props.level?.feel)
    winLo = C.view.windowLoOffset
    winHi = C.view.windowHiOffset
    if (props.level !== undefined) buildLevelStage(props.level)
    else if (isTrials()) buildTrialsWorld()
    else buildWorld()
  }

  const hum = (midi: number, secs: number): void => {
    const ctx = driver?.ctx() ?? null
    if (ctx !== null && untrack(() => soundOn() && humOn())) {
      playTargetHum(ctx, midiToHz(midi), secs)
    }
  }

  const advanceTo = (idx: number): void => {
    activeIdx = idx
    if (idx >= nodes.length) {
      setPhase('done')
      return
    }
    const n = nodes[idx]
    setHint(n.hint)
    if (n.t === 'boss' && C.sound.bossArpeggio && phase() === 'play') {
      // the chandelier introduces itself: freeze the world in a thought
      // bubble while its crystals hum their notes as an arpeggio
      setCueText(
        'The chandelier rings three notes — listen. Break every crystal before the first re-anneals!',
      )
      setPhase('cue')
      arpeggioTimers.forEach((t) => window.clearTimeout(t))
      arpeggioTimers = n.boss.crystals.map((c, i) =>
        window.setTimeout(
          () => hum(c.midi, C.sound.arpeggioNoteSec),
          400 + i * C.sound.arpeggioGapMs,
        ),
      )
      return
    }
    if (isRhythm()) return // rhythm hums the note on the tap itself
    if (n.t === 'land' && (n.p.hum === true || C.sound.humOnObjective)) {
      hum(n.p.midi, C.sound.humSeconds)
    } else if (
      n.t === 'pane' &&
      n.pane.kind !== 'hidden' &&
      C.sound.humOnObjective
    ) {
      hum(n.pane.midi, C.sound.humSeconds)
    }
  }

  const burstPane = (pane: Pane): void => {
    pane.burstT = 0
    const gy = yFor(pane.midi)
    pane.shards = Array.from({ length: 26 }, (_, i) => ({
      x: pane.wx,
      y: gy,
      vx: (Math.cos((i / 26) * 6.283) * (0.5 + (i % 5) * 0.13)) / 2.2,
      vy: (Math.sin((i / 26) * 6.283) * (0.5 + (i % 3) * 0.2)) / 2.2 - 0.25,
      r: 2 + (i % 4) * 2,
    }))
  }

  const resumeFromCue = (): void => {
    arpeggioTimers.forEach((t) => window.clearTimeout(t))
    arpeggioTimers = []
    setPhase('play')
  }

  const retry = (): void => {
    if (lastCheckpointIdx >= 0) {
      // reset every stateful thing the nodes after the checkpoint touch
      for (let i = lastCheckpointIdx + 1; i < nodes.length; i++) {
        const n = nodes[i]
        if (n.t === 'land') {
          n.p.lit = false
          n.p.dwell = 0
          n.p.integrity = 1
          n.p.broken = false
        } else if (n.t === 'pane') {
          n.pane.res = 0
          n.pane.burstT = -1
          n.pane.reveal = 0
          n.pane.shards = []
        } else if (n.t === 'whisper') {
          n.z.stir = 0
          n.z.woken = false
          n.z.wokenMs = 0
        } else {
          for (const c of n.boss.crystals) {
            c.res = 0
            c.broken = false
            c.brokenMs = 0
          }
          n.boss.cleared = false
          n.boss.shards = []
        }
      }
      const cp = nodes[lastCheckpointIdx] as Extract<Node, { t: 'land' }>
      mercWX = (cp.p.x0 + cp.p.x1) / 2
      mercY = yFor(cp.p.midi) - 0.035
      falling = false
      fallenMs = 0
      rescueMs = 0
      sinkMs = 0
      pitchHist = []
      restIdx = null
      shownMidi = null
      advanceTo(lastCheckpointIdx + 1)
    } else {
      buildStage()
    }
    setPhase('play')
  }

  const start = async (): Promise<void> => {
    setMicError(null)
    if (isRhythm()) {
      // tap play needs no microphone: the clock is the instrument
      driver = createTapDriver()
      await driver.start()
      groundMidi = readStoredGround()
      buildStage()
      beginCountIn()
      setPhase('play')
      return
    }
    try {
      driver = createSingDriver(MIC_ID)
      await driver.start()
      setPhase('ground')
    } catch {
      setMicError('Microphone unavailable — check permissions and retry.')
    }
  }

  /** Rhythm count-in: the first note ticks countInBeats times, then the
   * road starts moving. */
  const beginCountIn = (): void => {
    const beatMs = 60000 / rhythmBpm
    rhythmStartAt = performance.now() + C.tap.countInBeats * beatMs
    const first = nodes[0]
    const tickMidi = first?.t === 'land' ? first.p.midi : groundMidi
    arpeggioTimers.forEach((t) => window.clearTimeout(t))
    arpeggioTimers = Array.from({ length: C.tap.countInBeats }, (_, i) =>
      window.setTimeout(() => hum(tickMidi, 0.18), i * beatMs),
    )
    setHint('Count-in… then tap anywhere as Merc crosses each slab.')
  }

  let last = 0
  const tick = (now: number): void => {
    raf = requestAnimationFrame(tick)
    const dt = last === 0 ? 16 : Math.min(48, now - last)
    last = now
    const p = phase()

    // --- debounced, slew-clamped pitch (silence = rest, never fall) ---
    const raw = voicedMidi()
    rawMidiNow = raw
    if (raw !== null) {
      voicedStreak += 1
      unvoicedMs = 0
      if (voicedStreak >= C.voice.debounceFrames) {
        if (shownMidi === null) shownMidi = raw
        else {
          const maxStep = C.voice.slewSemisPerFrame * (dt / 16.7)
          let step = Math.max(-maxStep, Math.min(maxStep, raw - shownMidi))
          // jitter calm: sub-jitterSemis wobble moves Merc at a fraction
          // of full speed — flutter stops bouncing him, real jumps stay
          const mag = Math.abs(raw - shownMidi)
          if (mag < C.voice.jitterSemis) {
            step *=
              C.voice.jitterCalm +
              (1 - C.voice.jitterCalm) * (mag / C.voice.jitterSemis)
          }
          shownMidi += step
        }
        pitchHist.push({ t: now, midi: raw })
        const keep = now - C.voice.releaseTailMs - C.voice.releaseSpanMs - 200
        while (pitchHist.length > 0 && pitchHist[0].t < keep) pitchHist.shift()
      }
    } else {
      voicedStreak = 0
      unvoicedMs += dt
      if (unvoicedMs > C.voice.restGraceMs && shownMidi !== null) {
        // release-glide filter: the stopping voice collapsed in pitch and
        // dragged Merc down — restore the height he meant, the median of
        // the pitch window just BEFORE the release tail. Both modes need
        // it: in the platformer the tail would drag Merc past the settle
        // range and through the platform he meant to land on.
        if (p === 'play') {
          const cut = now - unvoicedMs
          const upto = cut - C.voice.releaseTailMs
          const from = upto - C.voice.releaseSpanMs
          const win = pitchHist
            .filter((s) => s.t >= from && s.t <= upto)
            .map((s) => s.midi)
            .sort((a, b) => a - b)
          if (win.length > 0) {
            const iy = Math.min(
              1.05,
              Math.max(-0.05, yFor(win[Math.floor(win.length / 2)])),
            )
            if (iy < mercY) mercY = iy // only lift back, never push down
          }
        }
        shownMidi = null
        pitchHist = []
      }
    }
    const midi = shownMidi

    if (p === 'ground' && midi !== null) {
      const t = now / 1000
      groundSamples.push({ t, midi })
      groundSamples = groundSamples.filter((s) => t - s.t < 0.9)
      if (groundSamples.length > 24) {
        const ms = groundSamples.map((s) => s.midi).sort((a, b) => a - b)
        if (ms[ms.length - 1] - ms[0] < 1.6) {
          groundMidi = Math.round(ms[Math.floor(ms.length / 2)])
          try {
            window.localStorage.setItem(GROUND_KEY, String(groundMidi))
          } catch {
            // tap mode just falls back to its default ground
          }
          buildStage()
          setPhase('play')
        }
      }
    }

    if (p === 'play' && !falling && isTrials()) {
      // === platformer objectives: physical, order-light ===
      // landing lights the platform under Merc's feet — and standing on
      // a LATER land node's platform completes the ones a big leap
      // skipped (panes break the run: locks are never completed by air)
      if (restIdx !== null && !platforms[restIdx].broken) {
        const stand = platforms[restIdx]
        stand.lit = true
        for (let k = activeIdx; k < nodes.length; k++) {
          const nk = nodes[k]
          if (nk.t === 'pane') {
            // an OPEN wall doesn't block completion; an intact one does
            if (nk.pane.burstT >= 0) continue
            break
          }
          if (nk.t !== 'land') break
          if (nk.p === stand) {
            for (let j = activeIdx; j <= k; j++) {
              const nj = nodes[j]
              if (nj.t === 'land') nj.p.lit = true
            }
            break
          }
        }
      }
      // every satisfied node (lit land, burst pane) fast-forwards
      let guard = 0
      while (activeIdx < nodes.length && guard < 60) {
        guard += 1
        const n0 = nodes[activeIdx]
        if (n0.t === 'land' && n0.p.lit) {
          if (n0.checkpoint === true) lastCheckpointIdx = activeIdx
          advanceTo(activeIdx + 1)
        } else if (n0.t === 'pane' && n0.pane.burstT >= 0) {
          advanceTo(activeIdx + 1)
        } else {
          break
        }
      }
      // glass walls charge by PROXIMITY, not node order: press near an
      // intact pane and sing its note — it bursts, the wall opens
      for (const pane of panes) {
        if (pane.burstT >= 0) continue
        const cfg =
          pane.kind === 'gate'
            ? C.gate
            : pane.kind === 'wall'
              ? C.wall
              : C.hidden
        const near = Math.abs(mercWX - pane.wx) <= C.control.paneChargeUnits
        if (
          near &&
          midi !== null &&
          Math.abs(midi - pane.midi) <= cfg.tolSemis
        ) {
          pane.res = Math.min(1, pane.res + dt / cfg.riseMs)
          if (pane.res >= 1) burstPane(pane)
        } else {
          pane.res = Math.max(0, pane.res - dt / cfg.fallMs)
        }
        if (pane.kind === 'hidden') {
          pane.reveal =
            midi === null || !near
              ? Math.max(0, pane.reveal - dt / 600)
              : Math.max(
                  0,
                  1 - Math.abs(midi - pane.midi) / C.hidden.revealSemis,
                )
        }
      }
    } else if (p === 'play' && !falling && activeIdx < nodes.length) {
      const n = nodes[activeIdx]
      if (n.t === 'land') {
        const pl = n.p
        if (
          !pl.broken &&
          midi !== null &&
          Math.abs(midi - pl.midi) <= C.land.bandSemis
        ) {
          pl.dwell += dt
          if (pl.dwell >= C.land.dwellMs) {
            pl.lit = true
            if (n.checkpoint === true) lastCheckpointIdx = activeIdx
            advanceTo(activeIdx + 1)
          }
        } else {
          pl.dwell = Math.max(0, pl.dwell - dt * C.land.decay)
        }
      } else if (n.t === 'whisper') {
        const z = n.z
        const loud = (driver?.latestLevel() ?? 0) > C.whisper.rmsLoud
        if (!z.woken) {
          if (
            loud &&
            mercWX > z.x0 - C.whisper.approachMargin &&
            mercWX < z.x1 + 0.3
          ) {
            z.stir = Math.min(1, z.stir + dt / C.whisper.wakeMs)
          } else {
            z.stir = Math.max(
              0,
              z.stir - (dt / C.whisper.wakeMs) * C.whisper.decay,
            )
          }
          if (z.stir >= 1) {
            z.woken = true
            z.wokenMs = 0
            setHint('It woke. The pulse throws you into the void—')
          } else if (mercWX > z.x1) {
            advanceTo(activeIdx + 1)
          }
        } else {
          z.wokenMs += dt
          if (z.wokenMs > C.whisper.crumbleDelayMs && !falling) {
            falling = true
            restIdx = null
          }
        }
      } else if (n.t === 'boss') {
        const b = n.boss
        for (const c of b.crystals) {
          if (c.broken) continue
          if (midi !== null && Math.abs(midi - c.midi) <= C.boss.tolSemis) {
            c.res = Math.min(1, c.res + dt / C.boss.riseMs)
          } else {
            c.res = Math.max(0, c.res - dt / C.boss.fallMs)
          }
          if (c.res >= 1) {
            c.broken = true
            c.brokenMs = 0
            const cy = yFor(c.midi)
            for (let i = 0; i < 12; i++) {
              b.shards.push({
                x: c.wx,
                y: cy,
                vx: (Math.cos((i / 12) * 6.283) * (0.4 + (i % 3) * 0.12)) / 2.2,
                vy:
                  (Math.sin((i / 12) * 6.283) * (0.4 + (i % 3) * 0.15)) / 2.2 -
                  0.2,
                r: 2 + (i % 3) * 2,
                t: 0,
              })
            }
            const left = b.crystals.filter((x) => !x.broken).length
            setHint(
              left === 0
                ? 'Silence. The chandelier is dark.'
                : left === 1
                  ? 'One crystal still rings — before the others re-anneal!'
                  : `${left} crystals still ring. Keep going!`,
            )
          }
        }
        for (const c of b.crystals) {
          if (!c.broken) continue
          c.brokenMs += dt
          if (
            c.brokenMs > C.boss.reannealMs &&
            b.crystals.some((x) => !x.broken)
          ) {
            c.broken = false
            c.res = 0
            setHint('A crystal re-annealed. Break them all before that!')
          }
        }
        if (!b.cleared && b.crystals.every((c) => c.broken)) {
          b.cleared = true
          advanceTo(activeIdx + 1)
        }
      } else {
        const pane = n.pane
        const cfg =
          pane.kind === 'gate'
            ? C.gate
            : pane.kind === 'wall'
              ? C.wall
              : C.hidden
        if (pane.kind === 'hidden') {
          pane.reveal =
            midi === null
              ? Math.max(0, pane.reveal - dt / 600)
              : Math.max(
                  0,
                  1 - Math.abs(midi - pane.midi) / C.hidden.revealSemis,
                )
        }
        if (pane.burstT < 0) {
          if (midi !== null && Math.abs(midi - pane.midi) <= cfg.tolSemis) {
            pane.res = Math.min(1, pane.res + dt / cfg.riseMs)
          } else {
            pane.res = Math.max(0, pane.res - dt / cfg.fallMs)
          }
          if (pane.res >= 1) {
            burstPane(pane)
            rescueMs = C.pane.rescueMs
          }
        }
      }
    }

    // pane burst animation (world-x shards move in world units horizontally)
    for (const pane of panes) {
      if (pane.burstT >= 0 && pane.burstT < 2) {
        pane.burstT += dt / 1000
        for (const s of pane.shards) {
          s.x += (s.vx * dt) / 1000 / 0.55
          s.y += (s.vy * dt) / 1000
          s.vy += (1.6 * dt) / 1000
        }
        if (pane.burstT > 0.9 && nodes[activeIdx]?.t === 'pane') {
          const n = nodes[activeIdx] as Extract<Node, { t: 'pane' }>
          if (n.pane === pane) advanceTo(activeIdx + 1)
        }
      }
    }

    // boss shard sparks
    if (boss !== null && boss.shards.length > 0) {
      for (const s of boss.shards) {
        s.t += dt / 1000
        s.x += (s.vx * dt) / 1000 / 0.55
        s.y += (s.vy * dt) / 1000
        s.vy += (1.6 * dt) / 1000
      }
      boss.shards = boss.shards.filter((s) => s.t < 1)
    }

    // --- merc: fly with the voice, rest on what's below, or fall ---
    if (p === 'play' || p === 'fallen') {
      if (isRhythm()) {
        // === rhythm: the road scrolls at tempo, taps land the notes ===
        if (p === 'play' && now >= rhythmStartAt) {
          mercWX = Math.min(worldMax - 0.3, mercWX + (rhythmSpeed * dt) / 1000)
        }
        // glide along the melody contour — y follows the active note
        const tgtP =
          activeIdx < nodes.length && nodes[activeIdx].t === 'land'
            ? (nodes[activeIdx] as Extract<Node, { t: 'land' }>).p
            : platforms[platforms.length - 1]
        mercY += (yFor(tgtP.midi) - 0.035 - mercY) * C.tap.yLerp
        // judge queued taps against the active slab. V1 judges by frame
        // position; the intents carry audio-clock stamps for the finer
        // beat judge later.
        const taps = (driver?.drainIntents() ?? []).filter(
          (t) => t.type === 'tap',
        )
        if (p === 'play' && activeIdx < nodes.length) {
          const n = nodes[activeIdx]
          if (n.t === 'land') {
            const center = (n.p.x0 + n.p.x1) / 2
            const latency = (C.tap.inputLatencyMs / 1000) * rhythmSpeed
            const win = Math.max(
              (C.tap.windowMs / 1000) * rhythmSpeed,
              (n.p.x1 - n.p.x0) / 2,
            )
            let hitP: Platform | null = null
            if (taps.length > 0 && Math.abs(mercWX - latency - center) <= win) {
              hitP = n.p
            } else if (mercWX > n.p.x1 + 0.15) {
              // forgiving V1: a passed slab lights late — the song keeps
              // going, the miss just is not celebrated
              n.p.lit = true
              n.p.dwell = 9999
              advanceTo(activeIdx + 1)
            }
            if (hitP !== null) {
              hitP.lit = true
              hitP.dwell = 9999
              hum(hitP.midi, C.sound.humSeconds)
              try {
                navigator.vibrate?.(C.tap.vibrateMs)
              } catch {
                // no haptics on this device
              }
              mercY -= 0.03 // a little hop; the glide settles him back
              advanceTo(activeIdx + 1)
            }
          } else {
            advanceTo(activeIdx + 1) // rhythm compiles land nodes only
          }
        }
      } else if (isTrials()) {
        // === platformer: keys walk, the voice is the jump ===
        const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
        const prevX = mercWX
        if (p === 'play' && dir !== 0) {
          const sp =
            C.control.walkSpeed *
            (restIdx !== null ? 1 : C.control.airControlScale)
          mercWX = Math.min(
            worldMax - 0.3,
            Math.max(0.3, mercWX + (dir * sp * dt) / 1000),
          )
        }
        // intact panes are physical glass walls — no jumping past a lock
        for (const pane of panes) {
          if (pane.burstT >= 0) continue
          const m = C.control.paneBlockUnits
          if (prevX <= pane.wx - m && mercWX > pane.wx - m) {
            mercWX = pane.wx - m
          } else if (prevX >= pane.wx + m && mercWX < pane.wx + m) {
            mercWX = pane.wx + m
          }
        }
        const prevY = mercY
        if (p === 'play' && midi !== null) {
          // the jump: lift toward the sung note's height — a higher note
          // is a higher, longer leap; holding it is holding the button
          const ty = Math.min(1.05, Math.max(-0.05, yFor(midi)))
          // rate-capped approach: big intervals climb at a weighted,
          // constant pace and ease out near the apex
          const step = (ty - mercY) * C.control.liftLerp
          const cap = (C.control.liftMaxPerSec * dt) / 1000
          mercY += Math.max(-cap, Math.min(cap, step))
          jumpVy = 0
          falling = false
          if (restIdx !== null) {
            const sit = yFor(platforms[restIdx].midi) - 0.035
            if (mercY > sit) {
              // the platform is a FLOOR: a lower note cannot sing Merc
              // through it — walking off the edge is the only way down
              mercY = sit
            } else if (mercY < sit - 0.012) {
              restIdx = null // lifted off
            }
          }
        } else if (restIdx === null) {
          // silent in the air: settle onto a top we hover at, else gravity
          const foot = C.control.footUnits
          for (const [i, pl] of platforms.entries()) {
            if (pl.broken) continue
            if (mercWX < pl.x0 - foot || mercWX > pl.x1 + foot) continue
            if (
              Math.abs(mercY - (yFor(pl.midi) - 0.035)) < C.control.settleUnits
            ) {
              restIdx = i
              break
            }
          }
          if (restIdx === null) {
            jumpVy = Math.min(
              C.control.maxFall,
              jumpVy + (C.control.gravity * dt) / 1000,
            )
            mercY += (jumpVy * dt) / 1000
          }
        }
        if (restIdx !== null) {
          const pl = platforms[restIdx]
          if (
            mercWX < pl.x0 - C.control.footUnits ||
            mercWX > pl.x1 + C.control.footUnits
          ) {
            coyoteLeftMs -= dt
            if (coyoteLeftMs <= 0) restIdx = null // walked off the edge
          } else {
            coyoteLeftMs = C.control.coyoteMs
            if (midi === null) {
              mercY = yFor(pl.midi) - 0.035
              jumpVy = 0
            }
          }
        }
        // landing sweep: crossed a platform top on the way down
        if (restIdx === null && mercY >= prevY) {
          for (const [i, pl] of platforms.entries()) {
            if (pl.broken) continue
            if (
              mercWX < pl.x0 - C.control.footUnits ||
              mercWX > pl.x1 + C.control.footUnits
            )
              continue
            const sit = yFor(pl.midi) - 0.035
            if (prevY <= sit + 0.002 && mercY >= sit - 0.002) {
              restIdx = i
              mercY = sit
              jumpVy = 0
              coyoteLeftMs = C.control.coyoteMs
              break
            }
          }
        }
        falling = restIdx === null && jumpVy > 0.35
        if (mercY > C.fall.yGone) {
          fallenMs += dt
          if (fallenMs > C.fall.cardDelayMs && p === 'play') setPhase('fallen')
        } else if (p === 'play') {
          fallenMs = 0
        }
      } else {
        rescueMs = Math.max(0, rescueMs - dt)
        if (falling) {
          if (
            C.fall.catchable &&
            midi !== null &&
            mercY < C.fall.yGone &&
            p === 'play'
          ) {
            // a voiced note catches Merc while he is still on screen
            falling = false
            fallenMs = 0
            sinkMs = 0
          } else {
            mercY += (C.fall.speed * dt) / 1000
            if (mercY > C.fall.yGone) {
              fallenMs += dt
              if (fallenMs > C.fall.cardDelayMs && p === 'play')
                setPhase('fallen')
            }
          }
        } else if (midi !== null) {
          restIdx = null
          sinkMs = 0
          const ty = Math.min(1.05, Math.max(-0.05, yFor(midi)))
          mercY += (ty - mercY) * C.view.flyLerp
        } else if (platforms.length > 0) {
          if (restIdx === null || platforms[restIdx].broken) {
            let best: number | null = null
            let bestD = Infinity
            for (const [i, pl] of platforms.entries()) {
              if (pl.broken) continue
              if (mercWX < pl.x0 - 0.15 || mercWX > pl.x1 + 0.15) continue
              const d = yFor(pl.midi) - mercY
              // restSnapUpUnits: a slab slightly ABOVE still catches — the
              // release glide dragged Merc under it, silence pops him back
              if (d > -C.land.restSnapUpUnits && d < bestD) {
                bestD = d
                best = i
              }
            }
            restIdx = best
            if (restIdx === null) {
              if (rescueMs > 0) {
                // Post-burst grace: the success breath must never kill.
                // Glide to the nearest intact perch; it stays unlit until
                // its note is actually sung.
                let t: Platform | null = null
                let td = Infinity
                for (const pl of platforms) {
                  if (pl.broken) continue
                  const d = Math.abs((pl.x0 + pl.x1) / 2 - mercWX)
                  if (d < td) {
                    td = d
                    t = pl
                  }
                }
                if (t !== null) {
                  const tx = Math.min(Math.max(mercWX, t.x0 + 0.2), t.x1 - 0.2)
                  mercWX += (tx - mercWX) * C.pane.rescueLerp
                  mercY += (yFor(t.midi) - 0.035 - mercY) * C.view.restLerp
                  sinkMs = 0
                } else {
                  falling = true
                }
              } else {
                // the void — but first a slow, recoverable sink: any voiced
                // note lifts Merc out before the real fall starts
                sinkMs += dt
                if (sinkMs > C.fall.sinkGraceMs) falling = true
                else mercY += (C.fall.sinkSpeed * dt) / 1000
              }
            }
          }
          if (restIdx !== null) {
            sinkMs = 0
            const pl = platforms[restIdx]
            const sitY = yFor(pl.midi) - 0.035
            mercY += (sitY - mercY) * C.view.restLerp
            if (pl.kind === 'glass' && Math.abs(mercY - sitY) < 0.02) {
              pl.integrity = Math.max(0, pl.integrity - dt / C.glass.crackMs)
              if (pl.integrity === 0 && !pl.broken) {
                pl.broken = true
                pl.respawnMs = C.glass.respawnMs
                const py = yFor(pl.midi)
                puff = Array.from({ length: 14 }, (_, i) => ({
                  x: pl.x0 + ((i + 0.5) / 14) * (pl.x1 - pl.x0),
                  y: py,
                  vx: (i / 14 - 0.5) * 0.5,
                  vy: 0.05 + (i % 3) * 0.08,
                  r: 2 + (i % 3) * 2,
                }))
                puffT = 0
                restIdx = null
              }
            }
          }
        }
      }
      for (const pl of platforms) {
        if (pl.broken) {
          pl.respawnMs -= dt
          if (pl.respawnMs <= 0) {
            pl.broken = false
            pl.integrity = 1
          }
        }
      }
      if (puffT >= 0) {
        puffT += dt / 1000
        for (const s of puff) {
          s.x += (s.vx * dt) / 1000
          s.y += (s.vy * dt) / 1000
          s.vy += (1.4 * dt) / 1000
        }
        if (puffT > 1) puffT = -1
      }

      // forward drift toward the objective (or stay on the rest platform) —
      // flow mode only; the platformer's keys and the rhythm's tempo own
      // their own x axis
      if (mode() === 'flow' && !falling) {
        let wantWX = mercWX
        if (midi !== null && activeIdx < nodes.length) {
          const n = nodes[activeIdx]
          const quiet = (driver?.latestLevel() ?? 0) <= C.whisper.rmsLoud
          wantWX =
            n.t === 'land'
              ? (n.p.x0 + n.p.x1) / 2
              : n.t === 'pane'
                ? n.pane.wx - C.pane.approachBack
                : n.t === 'whisper'
                  ? quiet
                    ? n.z.x1 + 0.6
                    : mercWX // a loud voice stands still before the sleeper
                  : bossTargetWX(n.boss)
        } else if (restIdx !== null) {
          const pl = platforms[restIdx]
          wantWX = Math.min(Math.max(mercWX, pl.x0 + 0.2), pl.x1 - 0.2)
        }
        // the hush slows every step inside it — no dashing past the sleeper
        const inHush = zones.some(
          (z) => !z.woken && mercWX > z.x0 - 0.3 && mercWX < z.x1,
        )
        const xLerp = inHush
          ? C.view.xLerp * C.whisper.dragXLerpScale
          : C.view.xLerp
        mercWX += (wantWX - mercWX) * xLerp
      }

      if (midi !== null) {
        trail.push({ wx: mercWX, y: mercY })
        if (trail.length > 70) trail.shift()
        if (C.hud.pitchGhost && rawMidiNow !== null) {
          ghost.push({
            wx: mercWX,
            y: Math.min(1.05, Math.max(-0.05, yFor(rawMidiNow))),
          })
          if (ghost.length > 70) ghost.shift()
        }
      }

      // camera follows
      const target = Math.min(
        Math.max(mercWX - 3, 0),
        worldMax - C.view.viewUnits,
      )
      camX += (target - camX) * C.view.cameraLerp

      // vertical camera (trials only): standing re-centers Merc on screen;
      // airborne, the view follows only inside the edge bands so a single
      // jump never yanks it. Clamped between the baseline framing and
      // centering the highest platform.
      if (isTrials() || isRhythm()) {
        let wantY = camY
        const rel = mercY - camY
        if (restIdx !== null || isRhythm()) {
          wantY = mercY - C.control.camCenterY
        } else if (rel < C.control.camAirBand) {
          wantY = mercY - C.control.camAirBand
        } else if (rel > 1 - C.control.camAirBand) {
          wantY = mercY - (1 - C.control.camAirBand)
        }
        let camMin = 0
        for (const pl of platforms) {
          camMin = Math.min(
            camMin,
            yFor(pl.midi) - 0.035 - C.control.camCenterY,
          )
        }
        camY +=
          (Math.min(0, Math.max(camMin, wantY)) - camY) * C.control.camYLerp
      }
    }

    // motion feel: smoothed velocities drive squash/stretch and lean
    const rawVy = ((mercY - prevMercY) * 1000) / dt
    const rawVx = ((mercWX - prevMercWX) * 1000) / dt
    mercVy += (rawVy - mercVy) * 0.25
    mercVx += (rawVx - mercVx) * 0.25
    prevMercY = mercY
    prevMercWX = mercWX

    // mercury beads shed while falling (quicksilver juice)
    if (falling && beads.length < C.art.fallBeads) {
      beads.push({
        x: mercWX + (Math.random() - 0.5) * 0.2,
        y: mercY,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.25 - Math.random() * 0.3,
        r: 1.5 + Math.random() * 2.5,
      })
    }
    if (beads.length > 0) {
      for (const b of beads) {
        b.x += (b.vx * dt) / 1000
        b.y += (b.vy * dt) / 1000
        b.vy += (1.1 * dt) / 1000
      }
      beads = beads.filter((b) => b.y < 1.4)
      if (!falling && phase() !== 'fallen') beads = []
    }

    draw()
  }

  const draw = (): void => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (
      canvas.width !== w * window.devicePixelRatio ||
      canvas.height !== h * window.devicePixelRatio
    ) {
      canvas.width = w * window.devicePixelRatio
      canvas.height = h * window.devicePixelRatio
    }
    ctx.setTransform(
      window.devicePixelRatio,
      0,
      0,
      window.devicePixelRatio,
      0,
      0,
    )
    ctx.clearRect(0, 0, w, h)

    // portrait sees fewer world units so platforms keep a playable size
    const viewUnits = w / h < 0.8 ? C.art.viewUnitsPortrait : C.view.viewUnits
    const unitPx = w / viewUnits
    const camPx = camX * unitPx
    drawBackdrop(ctx, w, h, camPx)
    if (phase() === 'intro' || phase() === 'ground') return

    // vertical pan: every world element shifts as one; the backdrop above
    // stays pinned (it is sky, not world)
    ctx.translate(0, -camY * h)

    const X = (wx: number): number => (wx - camX) * unitPx

    // world-anchored material patterns (re-anchored to the camera each frame
    // so the texture rides with the platforms instead of swimming)
    if (
      patterns.crystal === null &&
      art.crystal.complete &&
      art.crystal.naturalWidth > 0
    ) {
      patterns.crystal = ctx.createPattern(art.crystal, 'repeat')
    }
    if (
      patterns.stone === null &&
      art.stone.complete &&
      art.stone.naturalWidth > 0
    ) {
      patterns.stone = ctx.createPattern(art.stone, 'repeat')
    }
    const anchorPattern = (p: CanvasPattern | null): void => {
      p?.setTransform(
        new DOMMatrix()
          .translate(-camPx % (512 * C.art.texScale), 0)
          .scale(C.art.texScale),
      )
    }
    anchorPattern(patterns.crystal)
    anchorPattern(patterns.stone)

    // void shimmer under the bridge span
    ctx.strokeStyle = 'rgba(248,81,73,0.18)'
    ctx.setLineDash([3, 9])
    ctx.beginPath()
    ctx.moveTo(X(10.3), h * 0.96)
    ctx.lineTo(X(16.1), h * 0.96)
    ctx.stroke()
    ctx.setLineDash([])

    // guide line: the objective note's height — where the voice must sit
    const guideMidi =
      C.hud.guideLine && phase() === 'play' ? objectiveMidi() : null
    if (guideMidi !== null) {
      const gy = yFor(guideMidi) * h
      const pulse = 0.2 + (Math.sin(last / 300) + 1) * 0.09
      ctx.strokeStyle = `rgba(88,166,255,${pulse})`
      ctx.lineWidth = 1.5
      ctx.setLineDash([10, 9])
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(w, gy)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = `rgba(148,197,255,${0.7 + (Math.sin(last / 300) + 1) * 0.15})`
      ctx.font = "700 15px 'Saira Condensed', monospace"
      ctx.fillText(midiToNoteNameOctave(guideMidi), 12, gy - 8)
    }

    const slabH = Math.max(
      C.art.platformMinPx,
      Math.min(C.art.platformMaxPx, C.art.platformUnits * unitPx),
    )
    for (const pl of platforms) {
      const y = yFor(pl.midi) * h
      const x0 = X(pl.x0)
      const x1 = X(pl.x1)
      if (x1 < -40 || x0 > w + 40) continue
      const isActive =
        activeIdx < nodes.length &&
        nodes[activeIdx].t === 'land' &&
        (nodes[activeIdx] as Extract<Node, { t: 'land' }>).p === pl
      const accent = pl.kind === 'glass' ? '#7ee7ff' : '#2dd4bf'

      if (pl.broken) {
        // ghost outline while the glass regrows
        ctx.strokeStyle = 'rgba(126,231,255,0.14)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 10])
        ctx.beginPath()
        ctx.roundRect(x0, y - 3, x1 - x0, slabH, 5)
        ctx.stroke()
        ctx.setLineDash([])
        continue
      }

      // slab body: dark base (carries the lit glow), material texture on top
      ctx.beginPath()
      ctx.roundRect(x0, y - 3, x1 - x0, slabH, 5)
      if (pl.lit) {
        ctx.shadowColor = accent
        ctx.shadowBlur = 16
      }
      ctx.fillStyle =
        pl.kind === 'glass' ? 'rgba(16,34,52,0.92)' : 'rgba(27,32,48,0.97)'
      ctx.fill()
      ctx.shadowBlur = 0
      const pat = pl.kind === 'glass' ? patterns.crystal : patterns.stone
      if (pat !== null) {
        ctx.globalAlpha = pl.kind === 'glass' ? 0.6 : 0.9
        ctx.fillStyle = pat
        ctx.fill()
        ctx.globalAlpha = 1
      }
      // faint underside line so slabs read against the nebula
      ctx.strokeStyle =
        pl.kind === 'glass' ? 'rgba(126,231,255,0.22)' : 'rgba(45,212,191,0.2)'
      ctx.lineWidth = 1
      ctx.stroke()

      // top edge light — the note surface Merc lands on
      ctx.lineCap = 'round'
      ctx.lineWidth = 2
      ctx.strokeStyle = pl.lit
        ? accent
        : isActive
          ? 'rgba(88,166,255,0.95)'
          : pl.kind === 'glass'
            ? 'rgba(126,231,255,0.5)'
            : 'rgba(88,166,255,0.35)'
      ctx.beginPath()
      ctx.moveTo(x0 + 3, y - 3)
      ctx.lineTo(x1 - 3, y - 3)
      ctx.stroke()

      if (isActive && pl.dwell > 0 && !pl.lit) {
        ctx.strokeStyle = '#7ee787'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x0 + 3, y - 3)
        ctx.lineTo(
          x0 + 3 + (x1 - x0 - 6) * Math.min(1, pl.dwell / C.land.dwellMs),
          y - 3,
        )
        ctx.stroke()
      }

      if (pl.kind === 'glass' && pl.integrity < 1) {
        const n = Math.ceil((1 - pl.integrity) * 6)
        ctx.strokeStyle = 'rgba(230,237,243,0.65)'
        ctx.lineWidth = 1
        for (let c = 0; c < n; c++) {
          const cx = x0 + ((c + 0.7) / 6.4) * (x1 - x0)
          ctx.beginPath()
          ctx.moveTo(cx, y - 2)
          ctx.lineTo(cx + (c % 2 === 0 ? 4 : -4), y + slabH - 2 + c * 1.5)
          ctx.stroke()
        }
      }

      const labelA = isActive
        ? 0.75 + (Math.sin(last / 300) + 1) * 0.125
        : pl.lit
          ? 0.55
          : C.hud.inactiveLabelAlpha
      ctx.fillStyle = `rgba(230,237,243,${labelA})`
      ctx.font = isActive
        ? "700 13px 'Saira Condensed', monospace"
        : "600 11px 'Saira Condensed', monospace"
      ctx.fillText(midiToNoteNameOctave(pl.midi), x0, y - 10)

      // karaoke syllable under the slab (melody levels)
      if (pl.syllable !== undefined) {
        ctx.fillStyle = `rgba(45,212,191,${Math.max(labelA, 0.45)})`
        ctx.font = isActive
          ? "700 13px 'Saira Condensed', monospace"
          : "600 12px 'Saira Condensed', monospace"
        ctx.fillText(pl.syllable, x0 + 2, y + slabH + 13)
      }
    }

    // rhythm: the approach ring contracts onto the target ring — the two
    // meeting IS the beat; tap anywhere at that moment
    if (isRhythm() && phase() === 'play' && activeIdx < nodes.length) {
      const n = nodes[activeIdx]
      if (n.t === 'land') {
        const cwx = (n.p.x0 + n.p.x1) / 2
        const cx = X(cwx)
        const cy = yFor(n.p.midi) * h - 22
        const dist = cwx - mercWX
        if (dist > -1.2 && dist < 4.5) {
          const closeness = Math.max(0, Math.min(1, 1 - dist / 4.5))
          ctx.strokeStyle = `rgba(255,209,102,${0.2 + closeness * 0.6})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, cy, 9 + (1 - closeness) * 36, 0, 6.283)
          ctx.stroke()
          ctx.strokeStyle = 'rgba(255,209,102,0.85)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(cx, cy, 9, 0, 6.283)
          ctx.stroke()
        }
      }
    }

    for (const pane of panes) {
      const gx = X(pane.wx)
      if (gx < -60 || gx > w + 60) continue
      const gy = yFor(pane.midi) * h
      const tall = pane.kind === 'wall' ? 150 : 108
      const wide = pane.kind === 'wall' ? 34 : 28
      if (pane.burstT < 0.02) {
        const hiddenGlow = pane.kind === 'hidden' ? pane.reveal : 0
        ctx.beginPath()
        ctx.roundRect(gx - wide / 2, gy - tall / 2, wide, tall, 8)
        if (patterns.crystal !== null) {
          ctx.globalAlpha =
            pane.kind === 'hidden' ? 0.3 + hiddenGlow * 0.3 : 0.5
          ctx.fillStyle = patterns.crystal
          ctx.fill()
          ctx.globalAlpha = 1
        }
        // charge tint + glow grow with resonance (hidden: with proximity too)
        ctx.fillStyle =
          pane.kind === 'hidden'
            ? `rgba(126,231,255,${0.08 + hiddenGlow * 0.3 + pane.res * 0.4})`
            : `rgba(188,140,255,${0.2 + pane.res * 0.5})`
        ctx.shadowColor = pane.kind === 'hidden' ? '#7ee7ff' : '#bc8cff'
        ctx.shadowBlur =
          pane.kind === 'hidden'
            ? hiddenGlow * 20 + pane.res * 18
            : 6 + pane.res * 22
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle =
          pane.kind === 'hidden'
            ? `rgba(126,231,255,${0.35 + hiddenGlow * 0.65})`
            : '#bc8cff'
        ctx.lineWidth = 2
        ctx.stroke()
        const isActivePane =
          activeIdx < nodes.length &&
          nodes[activeIdx].t === 'pane' &&
          (nodes[activeIdx] as Extract<Node, { t: 'pane' }>).pane === pane
        const paneLabelA = isActivePane
          ? 0.75 + (Math.sin(last / 300) + 1) * 0.125
          : C.hud.inactiveLabelAlpha
        ctx.fillStyle = `rgba(230,237,243,${paneLabelA})`
        ctx.font = isActivePane
          ? "700 13px 'Saira Condensed', monospace"
          : "600 11px 'Saira Condensed', monospace"
        ctx.fillText(
          pane.kind === 'hidden' ? '?' : midiToNoteNameOctave(pane.midi),
          gx - wide / 2,
          gy - tall / 2 - 8,
        )
      }
      if (pane.burstT >= 0) {
        ctx.fillStyle = '#bc8cff'
        for (const s of pane.shards) {
          ctx.globalAlpha = Math.max(0, 1 - pane.burstT)
          ctx.fillRect(X(s.x), s.y * h, s.r, s.r)
        }
        ctx.globalAlpha = 1
      }
    }

    // whisper zones: an indigo hush veil + the sleeping guardian
    for (const z of zones) {
      const zx0 = X(z.x0)
      const zx1 = X(z.x1)
      if (zx1 < -60 || zx0 > w + 60) continue
      const veil = ctx.createLinearGradient(zx0, 0, zx1, 0)
      veil.addColorStop(0, 'rgba(40,30,80,0)')
      veil.addColorStop(0.18, 'rgba(40,30,80,0.22)')
      veil.addColorStop(0.82, 'rgba(40,30,80,0.22)')
      veil.addColorStop(1, 'rgba(40,30,80,0)')
      ctx.fillStyle = veil
      ctx.fillRect(zx0, 0, zx1 - zx0, h)

      const gx = X(z.gx)
      const gy = yFor(z.gyMidi) * h
      const breath = Math.sin(last / 700) * 2
      const shake =
        z.stir > 0.6 && !z.woken ? Math.sin(last / 40) * z.stir * 3 : 0
      const r = 20 + breath + (z.woken ? 6 : 0)
      const grad = ctx.createRadialGradient(
        gx + shake,
        gy,
        2,
        gx + shake,
        gy,
        r,
      )
      const heat = z.woken ? 1 : z.stir
      grad.addColorStop(
        0,
        `rgba(${140 + heat * 110}, ${100 - heat * 40}, 255, 0.9)`,
      )
      grad.addColorStop(1, 'rgba(40,30,80,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(gx + shake, gy, r, 0, 6.283)
      ctx.fill()
      // closed eyes while asleep; wide while woken
      ctx.strokeStyle = 'rgba(230,237,243,0.85)'
      ctx.lineWidth = 1.5
      for (const dx of [-5, 5]) {
        ctx.beginPath()
        if (z.woken) {
          ctx.arc(gx + shake + dx, gy - 2, 2.6, 0, 6.283)
        } else {
          ctx.arc(gx + shake + dx, gy - 2, 3, 0.15 * Math.PI, 0.85 * Math.PI)
        }
        ctx.stroke()
      }
      // stir meter: a thin arc over the guardian
      if (z.stir > 0.02 && !z.woken) {
        ctx.strokeStyle = `rgba(255,160,120,${0.3 + z.stir * 0.6})`
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(gx, gy, r + 7, -Math.PI / 2, -Math.PI / 2 + z.stir * 6.283)
        ctx.stroke()
      }
    }

    // chandelier boss: hanging crystals that ring, break, and re-anneal
    if (boss !== null) {
      const anyVisible = boss.crystals.some((c) => {
        const cx = X(c.wx)
        return cx > -60 && cx < w + 60
      })
      if (anyVisible) {
        for (const c of boss.crystals) {
          const cx = X(c.wx)
          const cy = yFor(c.midi) * h
          // hanging thread from the top
          ctx.strokeStyle = 'rgba(188,140,255,0.25)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(cx, 0)
          ctx.lineTo(cx, cy - 12)
          ctx.stroke()
          const s = 11
          ctx.save()
          ctx.translate(cx, cy)
          ctx.rotate(Math.PI / 4)
          if (c.broken) {
            ctx.strokeStyle = 'rgba(188,140,255,0.3)'
            ctx.setLineDash([3, 5])
            ctx.strokeRect(-s / 2, -s / 2, s, s)
            ctx.setLineDash([])
            ctx.restore()
            // re-anneal ring fills as it comes back
            ctx.strokeStyle = 'rgba(188,140,255,0.5)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(
              cx,
              cy,
              s,
              -Math.PI / 2,
              -Math.PI / 2 + (c.brokenMs / C.boss.reannealMs) * 6.283,
            )
            ctx.stroke()
          } else {
            ctx.fillStyle = `rgba(188,140,255,${0.45 + c.res * 0.5})`
            ctx.shadowColor = '#bc8cff'
            ctx.shadowBlur = 4 + c.res * 20
            ctx.fillRect(-s / 2, -s / 2, s, s)
            ctx.shadowBlur = 0
            ctx.strokeStyle = '#e6d5ff'
            ctx.lineWidth = 1.5
            ctx.strokeRect(-s / 2, -s / 2, s, s)
            ctx.restore()
            ctx.fillStyle = 'rgba(230,237,243,0.85)'
            ctx.font = "600 11px 'Saira Condensed', monospace"
            ctx.fillText(midiToNoteNameOctave(c.midi), cx - 10, cy - 16)
          }
        }
        if (boss.shards.length > 0) {
          ctx.fillStyle = '#bc8cff'
          for (const s of boss.shards) {
            ctx.globalAlpha = Math.max(0, 1 - s.t)
            ctx.fillRect(X(s.x), s.y * h, s.r, s.r)
          }
          ctx.globalAlpha = 1
        }
      }
    }

    if (puffT >= 0) {
      ctx.fillStyle = '#7ee7ff'
      for (const s of puff) {
        ctx.globalAlpha = Math.max(0, 1 - puffT)
        ctx.fillRect(X(s.x), s.y * h, s.r, s.r)
      }
      ctx.globalAlpha = 1
    }

    if (C.hud.pitchGhost && ghost.length > 1) {
      // the raw voice, un-smoothed — what the singer actually did
      ctx.strokeStyle = 'rgba(230,237,243,0.16)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X(ghost[0].wx), ghost[0].y * h)
      for (const g of ghost) ctx.lineTo(X(g.wx), g.y * h)
      ctx.stroke()
    }
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(45,212,191,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(X(trail[0].wx), trail[0].y * h)
      for (const t of trail) ctx.lineTo(X(t.wx), t.y * h)
      ctx.stroke()
    }

    // mercury beads shed during the fall
    if (beads.length > 0) {
      ctx.fillStyle = '#9be8ff'
      ctx.globalAlpha = 0.8
      for (const b of beads) {
        ctx.beginPath()
        ctx.arc(X(b.x), b.y * h, b.r, 0, 6.283)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const mx = X(mercWX)
    const bob =
      shownMidi === null && restIdx !== null && !falling
        ? Math.sin(last / 300) * 1.5
        : 0
    const my = mercY * h + bob
    // pose by state; motion carries the rest (droplet squash/stretch + lean)
    const sprite =
      phase() === 'done'
        ? art.mercCelebrate
        : falling
          ? art.mercListening
          : shownMidi !== null
            ? art.mercSinging
            : restIdx !== null
              ? art.mercIdle
              : art.mercListening
    if (sprite.complete && sprite.naturalWidth > 0) {
      const sh = Math.max(
        C.art.mercMinPx,
        Math.min(C.art.mercMaxPx, C.art.mercUnits * unitPx),
      )
      const sw = sh * (sprite.naturalWidth / sprite.naturalHeight)
      const stretch = Math.min(
        C.art.squashMax,
        Math.abs(mercVy) * C.art.squashVelScale,
      )
      const sy = 1 + stretch
      const sx = 1 / sy
      let tilt = Math.max(
        -C.art.tiltMax,
        Math.min(C.art.tiltMax, mercVx * C.art.tiltVelScale * 0.1),
      )
      if (falling) tilt += Math.sin(last / 90) * C.art.fallWobble
      // flying through a slab: go translucent — Merc is incorporeal in
      // flight, only rest makes him solid on a surface
      const phasing =
        shownMidi !== null &&
        restIdx === null &&
        platforms.some(
          (pl) =>
            !pl.broken &&
            mercWX >= pl.x0 &&
            mercWX <= pl.x1 &&
            Math.abs(mercY - yFor(pl.midi)) < 0.045,
        )
      ctx.save()
      if (phasing) ctx.globalAlpha = C.art.phaseAlpha
      ctx.translate(mx, my)
      ctx.rotate(tilt)
      ctx.scale(sx, sy)
      ctx.drawImage(sprite, -sw / 2, -sh / 2, sw, sh)
      ctx.restore()
    } else {
      ctx.fillStyle = '#2dd4bf'
      ctx.beginPath()
      ctx.arc(mx, my, 14, 0, 6.283)
      ctx.fill()
    }

    // voice beam: Merc's note ringing a crystal — cause meets effect
    if (
      C.boss.beam &&
      phase() === 'play' &&
      boss !== null &&
      activeIdx < nodes.length &&
      nodes[activeIdx].t === 'boss' &&
      shownMidi !== null
    ) {
      const sm = shownMidi
      const hit = boss.crystals.find(
        (c) => !c.broken && Math.abs(sm - c.midi) <= C.boss.tolSemis,
      )
      if (hit !== undefined) {
        const bx = X(hit.wx)
        const by = yFor(hit.midi) * h
        const a = 0.25 + hit.res * 0.55
        const grad = ctx.createLinearGradient(mx, my, bx, by)
        grad.addColorStop(0, `rgba(45,212,191,${a})`)
        grad.addColorStop(1, `rgba(188,140,255,${a})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 2 + hit.res * 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(mx, my - 6)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }
    }

    // direction chevrons: point the way when the objective note is far,
    // and always while sinking/falling (any in-window note recovers).
    // Never for the hidden door (no spoilers) or the whisper passage.
    if (phase() === 'play') {
      let dir = 0 // -1 = sing higher (screen up), 1 = sing lower
      if (falling || sinkMs > 0) dir = -1
      else if (activeIdx < nodes.length) {
        const target = objectiveMidi()
        const cur =
          shownMidi ?? (restIdx !== null ? platforms[restIdx].midi : null)
        if (
          target !== null &&
          cur !== null &&
          Math.abs(target - cur) > C.hud.arrowSemis
        ) {
          dir = target > cur ? -1 : 1
        }
      }
      if (dir !== 0) {
        const pulse = 0.5 + Math.sin(last / 220) * 0.3
        ctx.strokeStyle = `rgba(88,166,255,${pulse})`
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const ay = my + dir * 40
        for (const o of [0, 9]) {
          const yy = ay + dir * o
          ctx.beginPath()
          ctx.moveTo(mx - 8, yy - dir * 5)
          ctx.lineTo(mx, yy + dir * 3)
          ctx.lineTo(mx + 8, yy - dir * 5)
          ctx.stroke()
        }
      }
    }
  }

  // --- painterly backdrop: three parallax layers over the navy base ---
  const coverWrap = (
    ctx: CanvasRenderingContext2D,
    im: HTMLImageElement,
    w: number,
    h: number,
    scroll: number,
  ): void => {
    if (!im.complete || im.naturalWidth === 0) return
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight)
    const dw = im.naturalWidth * s
    const dh = im.naturalHeight * s
    const dy = (h - dh) / 2
    let x = -(scroll % dw)
    if (x > 0) x -= dw
    for (; x < w + 1; x += dw) ctx.drawImage(im, x, dy, dw, dh)
  }

  const drawBackdrop = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    camPx: number,
  ): void => {
    ctx.fillStyle = '#05060b'
    ctx.fillRect(0, 0, w, h)
    coverWrap(ctx, art.sky, w, h, camPx * C.art.parallaxFar)
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = C.art.nebulaAlpha
    coverWrap(ctx, art.nebula, w, h, camPx * C.art.parallaxMid)
    ctx.globalAlpha = C.art.dustAlpha
    coverWrap(ctx, art.dust, w, h, camPx * C.art.parallaxNear)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    // seat the play space: quiet, darker ground for HUD and low platforms
    const g = ctx.createLinearGradient(0, h * 0.72, 0, h)
    g.addColorStop(0, 'rgba(5,6,11,0)')
    g.addColorStop(1, 'rgba(5,6,11,0.82)')
    ctx.fillStyle = g
    ctx.fillRect(0, h * 0.72, w, h * 0.28)
  }

  const setKey = (down: boolean) => (e: KeyboardEvent) => {
    if (!isTrials()) return
    const k = e.key
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      keys.left = down
      e.preventDefault()
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      keys.right = down
      e.preventDefault()
    }
  }
  const keyDown = setKey(true)
  const keyUp = setKey(false)

  onMount(() => {
    if (import.meta.env.DEV) {
      // dev-only probe for the synthetic E2E harness
      ;(
        window as unknown as { __merc?: () => Record<string, unknown> }
      ).__merc = () => ({
        x: Math.round(mercWX * 100) / 100,
        y: Math.round(mercY * 1000) / 1000,
        rest: restIdx,
        vy: Math.round(jumpVy * 100) / 100,
        falling,
        phase: phase(),
        activeIdx,
        camY: Math.round(camY * 1000) / 1000,
      })
      ;(
        window as unknown as { __world?: () => Record<string, unknown> }
      ).__world = () => ({
        platforms: platforms.map((pl) => ({
          x0: pl.x0,
          x1: pl.x1,
          midi: pl.midi,
          lit: pl.lit,
        })),
        panes: panes.map((pn) => ({ wx: pn.wx, midi: pn.midi })),
        groundMidi,
        winLo,
        winHi,
        worldMax,
      })
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    raf = requestAnimationFrame(tick)
  })
  onCleanup(() => {
    cancelAnimationFrame(raf)
    window.removeEventListener('keydown', keyDown)
    window.removeEventListener('keyup', keyUp)
    arpeggioTimers.forEach((t) => window.clearTimeout(t))
    driver?.stop()
    driver = null
  })

  return (
    <div class="jp-root">
      <canvas class="jp-canvas" ref={canvas} />
      <Show when={phase() !== 'intro'}>
        <div class="jp-audio">
          <button
            type="button"
            aria-pressed={soundOn()}
            aria-label={soundOn() ? 'Mute game sound' : 'Unmute game sound'}
            onClick={() => setSoundOn(!soundOn())}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
              <Show
                when={soundOn()}
                fallback={<path d="M15 8.5 21 15.5M21 8.5 15 15.5" />}
              >
                <path d="M15 9.2a4 4 0 0 1 0 5.6M17.4 7a7.2 7.2 0 0 1 0 10" />
              </Show>
            </svg>
          </button>
          <button
            type="button"
            aria-pressed={humOn()}
            aria-label={humOn() ? 'Turn note hints off' : 'Turn note hints on'}
            onClick={() => setHumOn(!humOn())}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.5 17.5V6.5l8-2v10.5" />
              <circle cx="7.2" cy="17.5" r="2.3" />
              <circle cx="15.2" cy="15" r="2.3" />
              <Show when={!humOn()}>
                <path d="M4.5 4.5 20 20" />
              </Show>
            </svg>
          </button>
        </div>
      </Show>
      <Show when={isTrials() && (phase() === 'play' || phase() === 'ground')}>
        <div class="jp-pads">
          <button
            type="button"
            aria-label="Walk left"
            onPointerDown={(e) => {
              e.preventDefault()
              keys.left = true
            }}
            onPointerUp={() => (keys.left = false)}
            onPointerLeave={() => (keys.left = false)}
            onPointerCancel={() => (keys.left = false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Walk right"
            onPointerDown={(e) => {
              e.preventDefault()
              keys.right = true
            }}
            onPointerUp={() => (keys.right = false)}
            onPointerLeave={() => (keys.right = false)}
            onPointerCancel={() => (keys.right = false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m10 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </Show>
      <Show when={phase() === 'cue'}>
        <div class="jp-bubble" role="dialog" aria-label="Merc says">
          <svg
            class="jp-bubble-cloud"
            viewBox="0 0 460 200"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M62 148 C24 150 10 116 34 98 C12 78 32 44 66 50 C74 18 122 8 144 30 C166 4 220 2 240 26 C264 4 316 8 330 34 C368 20 412 40 404 74 C434 86 434 124 404 136 C414 164 372 184 342 170 C320 192 268 194 248 174 C222 194 172 192 154 170 C122 188 78 178 74 152 C70 151 66 150 62 148 Z" />
          </svg>
          <div class="jp-bubble-inner">
            <p>{cueText()}</p>
            <button class="jp-start jp-start--small" onClick={resumeFromCue}>
              I heard it
            </button>
          </div>
          <span class="jp-bubble-dot jp-bubble-dot--big" aria-hidden="true" />
          <span class="jp-bubble-dot" aria-hidden="true" />
        </div>
      </Show>
      <div class="jp-hud">
        <Show when={phase() === 'intro'}>
          <h2 class="jp-title">
            {props.level?.title ??
              (isTrials() ? 'Jump Trials' : "Merc's Journey")}
          </h2>
          <p class="jp-text">
            {props.level?.intro ??
              (isTrials()
                ? 'Walk with the arrow keys or the side pads. Your voice is the jump: sing the labeled note and Merc leaps to its height — higher note, higher leap. Hold it to glide.'
                : 'Your voice is the controller: sing higher to rise, lower to sink. Climb, shatter the gate, cross the bridge, break the wall.')}
          </p>
          <Show when={props.level !== undefined}>
            <p class="jp-text jp-text--mode">
              {isRhythm()
                ? 'Playing it by rhythm: the road moves at tempo — tap anywhere as Merc crosses each slab, and the taps perform the song. No microphone.'
                : isTrials()
                  ? 'Playing it as a platformer: walk with keys or pads, sing each note to leap its interval.'
                  : 'Playing it as a song line: your voice is the height — trace the melody.'}
            </p>
          </Show>
          <button class="jp-start" onClick={() => void start()}>
            {isRhythm() ? 'Start — no mic needed' : 'Start — allow the mic'}
          </button>
          <Show when={micError()}>
            <p class="jp-error">{micError()}</p>
          </Show>
        </Show>
        <Show when={phase() === 'ground'}>
          <p class="jp-text jp-pulse">Hum any comfortable note and hold it…</p>
        </Show>
        <Show when={phase() === 'play'}>
          <p class="jp-text">{hint()}</p>
        </Show>
        <Show when={phase() === 'fallen'}>
          <h2 class="jp-title">The glass gave way.</h2>
          <p class="jp-text">The void keeps what it catches.</p>
          <button class="jp-start" onClick={retry}>
            {lastCheckpointIdx >= 0 ? 'Retry from the checkpoint' : 'Retry'}
          </button>
        </Show>
        <Show when={phase() === 'done'}>
          <h2 class="jp-title">
            {props.level !== undefined
              ? 'The song is yours.'
              : isTrials()
                ? 'The trail rang true.'
                : 'The chandelier fell silent.'}
          </h2>
          <p class="jp-text">
            {props.level?.done ??
              (isTrials()
                ? 'Jump Trials cleared — your feet walked, your voice leapt. Every gap was an interval; you just sang your way across.'
                : 'Chapter one complete — climb, gate, bridge, wall, stairway, sleeper, hidden door, chandelier. Your voice did all of it.')}
          </p>
          <button
            class="jp-start"
            onClick={() => {
              buildStage()
              if (isRhythm()) beginCountIn()
              setPhase('play')
            }}
          >
            Run it again
          </button>
        </Show>
      </div>
    </div>
  )
}
