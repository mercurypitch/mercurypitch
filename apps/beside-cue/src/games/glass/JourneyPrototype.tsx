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
import { micErrorLine } from './mic-error'
import type { RunScore } from './score'
import { computeRunScore, emptyTally, qualityFromCents, qualityFromOffset, writeBest, } from './score'
import { readStoredTapLatency } from './tap-latency'
import { resolveTheme } from './themes'
import type { VibratoState } from './vibrato'
import { createVibratoDetector } from './vibrato'
import type { AtriumZone, BeamZone, Boss, Node, Pane, Platform, WhisperZone, } from './world-types'

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
  control?: 'flow' | 'platformer' | 'rhythm' | 'listen'
  /** Range setting: semitones to sit the song lower/higher (levels only). */
  rangeBias?: number
  /** Stage theme id (themes.ts) — the skin; defaults to Cosmos. */
  theme?: string
}> = (props) => {
  const mode = (): 'flow' | 'platformer' | 'rhythm' | 'listen' =>
    props.level !== undefined
      ? (props.control ?? props.level.control ?? 'flow')
      : (props.variant ?? 'journey') === 'trials'
        ? 'platformer'
        : 'flow'
  const isTrials = (): boolean => mode() === 'platformer'
  const isRhythm = (): boolean => mode() === 'rhythm'
  const isListen = (): boolean => mode() === 'listen'
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
  /** Air re-lift gate: voiced onsets while airborne, and whether the
   * current voiced run is past control.airReliftMax (lift ignored). */
  let airRelifts = 0
  let liftBlocked = false
  let wasVoicedTr = false
  // rhythm (tap) state: the road scrolls at tempo after the count-in
  let rhythmStartAt = 0
  let rhythmSpeed = 2 // world units / s
  let rhythmBpm = C.tap.bpmDefault
  let rhythmMisses = 0
  // listen (ear training) state: current perch, the candidate fan
  // (phantom pitches stacked AT the next slab — geometry offers the
  // choice, only the ear can pick the answer), timers
  let listenHome = 0
  let listenFan: number[] = [] // phantom midis; the true slab is implicit
  let listenFanAt = -1 // node index the fan was built for
  let listenWrongT = -1
  let listenWrongMidi = -1 // the phantom that shakes, then dissolves
  let listenWrongs = 0 // wrong picks on the current question
  let listenAdvanceAt = 0
  let listenPromptAt = 0

  // run scoring (score.ts): the engine only collects; per-note cents
  // accumulate time-weighted while the active note is held in band
  let tally = emptyTally()
  let nodeCentsSum = 0
  let nodeCentsT = 0
  let nodeCentsAt = -1
  const [finalScore, setFinalScore] = createSignal<RunScore | null>(null)
  const [bestPct, setBestPct] = createSignal<number | null>(null)

  // workshop mechanics (game-mechanics-research.md picks, 2026-08-31):
  // Resonance Ring listens through the vibrato detector; Steady Beam
  // tracks in-band steadiness; the Improv Atrium raises sung steps.
  let beams: BeamZone[] = []
  let atriums: AtriumZone[] = []
  let vib = createVibratoDetector(JOURNEY_CONFIG.vibrato)
  let vibState: VibratoState = {
    active: false,
    rateHz: 0,
    depthCents: 0,
    strength: 0,
  }
  let beamCentsSum = 0
  let beamCentsT = 0
  let beamVar: { t: number; c: number }[] = []
  let beamFlakeAt = 0
  let flakes: { x: number; y: number; vx: number; vy: number; t: number }[] = []
  let atriumHoldMidi = -1
  let atriumHoldMs = 0
  let atriumVoicedT = 0
  let atriumInT = 0
  let atriumCentsSum = 0
  // DEV: recent raw pitch samples for the __vib probe
  const rawRing: { t: number; m: number | null }[] = []
  /** Input-latency compensation, ms: the tap tuner's stored per-device
   * measurement when present, else the config default. */
  let tapLatencyMs = 0

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
  // The stage theme: asset directory + palette (themes.ts). Merc's own
  // sprites stay shared — he is the brand; the world dresses around him.
  // (the stage remounts per game entry; the theme is fixed for its life)
  // eslint-disable-next-line solid/reactivity
  const theme = resolveTheme(props.theme)
  const P = theme.palette
  // Painterly world: parallax layers, material tiles, Merc pose sprites
  // (merc-lumen sheet). Poses stretch/lean in code — liquid droplet physics.
  const art = {
    sky: img(`${theme.dir}/sky-far.webp`),
    nebula: img(`${theme.dir}/nebula-mid.webp`),
    dust: img(`${theme.dir}/dust-near.webp`),
    crystal: img(`${theme.dir}/crystal-tex.webp`),
    stone: img(`${theme.dir}/stone-tex.webp`),
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
    if (n.t === 'beam') return n.beam.midi
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
    beams = []
    atriums = []

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
    beams = []
    atriums = []

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
    airRelifts = 0
    liftBlocked = false
    wasVoicedTr = false
    rhythmMisses = 0
    listenHome = 0
    listenFan = []
    listenFanAt = -1
    listenWrongT = -1
    listenWrongs = 0
    tally = emptyTally()
    nodeCentsAt = -1
    setFinalScore(null)
    beamCentsSum = 0
    beamCentsT = 0
    beamVar = []
    flakes = []
    atriumHoldMidi = -1
    atriumHoldMs = 0
    atriumVoicedT = 0
    atriumInT = 0
    atriumCentsSum = 0
    listenAdvanceAt = 0
    listenPromptAt = 0
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
    tapLatencyMs =
      readStoredTapLatency(C.tap.calClampMs) ?? C.tap.inputLatencyMs
    platforms = cs.platforms
    panes = cs.panes
    beams = cs.beams
    atriums = cs.atriums
    vib = createVibratoDetector(C.vibrato)
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
    airRelifts = 0
    liftBlocked = false
    wasVoicedTr = false
    rhythmMisses = 0
    listenHome = 0
    listenFan = []
    listenFanAt = -1
    listenWrongT = -1
    listenWrongs = 0
    tally = emptyTally()
    nodeCentsAt = -1
    setFinalScore(null)
    beamCentsSum = 0
    beamCentsT = 0
    beamVar = []
    flakes = []
    atriumHoldMidi = -1
    atriumHoldMs = 0
    atriumVoicedT = 0
    atriumInT = 0
    atriumCentsSum = 0
    listenAdvanceAt = 0
    listenPromptAt = 0
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

  /** The candidate fan for a listen question: a ladder of fanSize
   * rungs, gapSemis apart, stacked at the SAME road position as the
   * true slab — the true note lands on a random rung, so position can
   * never leak the answer; only the ear separates the candidates
   * (find-the-frequency among decoys, game-design mechanic #2, drawn
   * as the Kodaly pitch-is-height ladder). Returns the PHANTOM midis;
   * rungs that would poke out of the pitch window slide back in, and
   * any still outside are dropped (fewer candidates, never a broken
   * question). */
  const buildFan = (target: Platform): number[] => {
    const lo = groundMidi + winLo + 1
    const hi = groundMidi + winHi - 1
    const gap = C.listen.gapSemis
    const n = C.listen.fanSize
    let rung = Math.floor(Math.random() * n)
    while (rung < n - 1 && target.midi + (n - 1 - rung) * gap > hi) rung++
    while (rung > 0 && target.midi - rung * gap < lo) rung--
    const fan: number[] = []
    for (let i = 0; i < n; i++) {
      if (i === rung) continue
      const midi = target.midi + (i - rung) * gap
      if (midi <= hi && midi >= lo) fan.push(midi)
    }
    return fan
  }

  /** The listen prompt: the note the player must find, played through
   * the driver clock REGARDLESS of the corner sound toggles — hearing
   * it IS the game. */
  const promptListen = (midi: number): void => {
    const ctx = driver?.ctx() ?? null
    if (ctx !== null) playTargetHum(ctx, midiToHz(midi), C.listen.promptSeconds)
    listenPromptAt = performance.now()
  }

  /** The Improv Atrium raises a sung step: an ephemeral glass slab at
   * the quantized pitch, a little ahead of Merc. Dedupes against any
   * live slab at that height nearby; the oldest step fades early when
   * the room is full. Steps never crack under rest — they just fade. */
  const spawnAtriumStep = (a: AtriumZone, m: number): void => {
    const A = C.atrium
    const x0 = Math.min(
      Math.max(mercWX + A.spawnAhead - A.stepWidth / 2, a.x0 + 0.1),
      a.x1 - A.stepWidth + 0.6,
    )
    const x1 = x0 + A.stepWidth
    for (const pl of platforms) {
      if (pl.broken) continue
      if (pl.x1 > x0 - 0.2 && pl.x0 < x1 + 0.2 && Math.abs(pl.midi - m) < 0.7) {
        return
      }
    }
    const live = platforms.filter((pl) => pl.ephemeral === true && !pl.broken)
    if (live.length >= A.maxSteps) {
      live[0].broken = true
      live[0].respawnMs = 1e9
    }
    platforms.push({
      midi: m,
      x0,
      x1,
      kind: 'glass',
      lit: true,
      dwell: 9999,
      integrity: 1,
      broken: false,
      respawnMs: 0,
      ephemeral: true,
      ttlMs: A.stepTtlMs,
    })
    hum(m, 0.3)
  }

  /** One pane charger for the flow objective AND the platformer's
   * proximity walls. 'ring' panes (Resonance Ring): a steady hold only
   * reaches holdCap — past it the pane pumps on VIBRATO strength, and
   * the pitch band widens so the wave itself cannot fall out of tol. */
  const chargePane = (
    pane: Pane,
    inReach: boolean,
    midi: number | null,
    dt: number,
  ): void => {
    if (pane.burstT >= 0) return
    if (pane.kind === 'ring') {
      const R = C.ring
      const ringing = pane.res >= R.holdCap
      const tol = R.tolSemis + (ringing ? R.pumpTolBonus : 0)
      const inTol =
        inReach && midi !== null && Math.abs(midi - pane.midi) <= tol
      const prev = pane.res
      if (inTol && !ringing) {
        pane.res = Math.min(R.holdCap, pane.res + dt / R.riseMs)
      } else if (inTol && vibState.active) {
        pane.res = Math.min(1, pane.res + (dt / R.pumpMs) * vibState.strength)
      } else if (!inTol) {
        pane.res = Math.max(0, pane.res - dt / R.fallMs)
      }
      if (prev < R.holdCap && pane.res >= R.holdCap) {
        setHint(
          'It rings! Now let the note WAVE — a wobble in the voice pumps the ring.',
        )
      }
    } else {
      const cfg =
        pane.kind === 'gate' ? C.gate : pane.kind === 'wall' ? C.wall : C.hidden
      const inTol =
        inReach && midi !== null && Math.abs(midi - pane.midi) <= cfg.tolSemis
      if (inTol) {
        pane.res = Math.min(1, pane.res + dt / cfg.riseMs)
      } else {
        pane.res = Math.max(0, pane.res - dt / cfg.fallMs)
      }
    }
    if (pane.res >= 1) {
      burstPane(pane)
      rescueMs = C.pane.rescueMs
    }
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
      const lvl = props.level
      if (lvl !== undefined) {
        const sc = computeRunScore(mode(), tally, C.score)
        setFinalScore(sc)
        if (sc !== null) setBestPct(writeBest(lvl.id, mode(), sc.pct))
      }
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
    if (isListen()) {
      // the objective hum IS the question — always played, fan rebuilt
      listenFan = []
      listenFanAt = -1
      listenWrongT = -1
      listenWrongs = 0
      if (n.t === 'land') promptListen(n.p.midi)
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

  const shatterPlatform = (pl: Platform): void => {
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
    if (isRhythm()) {
      // the road IS the clock in rhythm play — a run restarts whole,
      // count-in and all, never from a mid-road checkpoint
      buildStage()
      beginCountIn()
      setPhase('play')
      return
    }
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
        } else if (n.t === 'beam') {
          n.beam.done = false
        } else if (n.t === 'boss') {
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
    if (isRhythm() || isListen()) {
      // tap and listen play need no microphone: the clock (and the
      // player's ears) are the instrument
      driver = createTapDriver()
      await driver.start()
      groundMidi = readStoredGround()
      buildStage()
      if (isRhythm()) beginCountIn()
      setPhase('play')
      return
    }
    try {
      driver = createSingDriver(MIC_ID)
      await driver.start()
      setPhase('ground')
    } catch (err) {
      // Say WHICH failure it was. A generic "unavailable" sent a real
      // device bug (a manifest permission Capacitor needs) round the
      // houses, because the screen looked identical to a denied prompt.
      setMicError(micErrorLine(err))
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
    // the vibrato detector hears the RAW stream (smoothing would erase
    // the wave); silence idles it until the window refills
    if (raw !== null) {
      vibState = vib.feed(now, raw)
    } else if (vibState.active) {
      vibState = { active: false, rateHz: 0, depthCents: 0, strength: 0 }
    }
    if (import.meta.env.DEV) {
      rawRing.push({ t: Math.round(now), m: raw })
      if (rawRing.length > 90) rawRing.shift()
    }
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
        } else if (n0.t === 'beam' && n0.beam.done) {
          advanceTo(activeIdx + 1)
        } else {
          break
        }
      }
      // glass walls charge by PROXIMITY, not node order: press near an
      // intact pane and sing its note — it bursts, the wall opens
      for (const pane of panes) {
        if (pane.burstT >= 0) continue
        const near = Math.abs(mercWX - pane.wx) <= C.control.paneChargeUnits
        chargePane(pane, near, midi, dt)
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
          if (nodeCentsAt !== activeIdx) {
            nodeCentsAt = activeIdx
            nodeCentsSum = 0
            nodeCentsT = 0
          }
          nodeCentsSum += Math.abs(midi - pl.midi) * 100 * dt
          nodeCentsT += dt
          pl.dwell += dt
          if (pl.dwell >= C.land.dwellMs) {
            const meanCents = nodeCentsT > 0 ? nodeCentsSum / nodeCentsT : 0
            tally.quality.set(activeIdx, qualityFromCents(meanCents, C.score))
            tally.centsMeans.push(meanCents)
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
      } else if (n.t === 'pane') {
        const pane = n.pane
        if (pane.kind === 'hidden') {
          pane.reveal =
            midi === null
              ? Math.max(0, pane.reveal - dt / 600)
              : Math.max(
                  0,
                  1 - Math.abs(midi - pane.midi) / C.hidden.revealSemis,
                )
        }
        chargePane(pane, true, midi, dt)
      } else if (n.t === 'beam') {
        // === Steady Beam: one steady note IS the bridge ===
        const b = n.beam
        if (midi !== null && Math.abs(midi - b.midi) <= C.beam.tolSemis) {
          const cents = Math.abs(midi - b.midi) * 100
          beamVar.push({ t: now, c: cents })
          if (mercWX > b.x0 - 0.3) {
            beamCentsSum += cents * dt
            beamCentsT += dt
            // a wobble flakes shards off the beam — score, not failure
            if (cents > C.beam.flakeCents && now - beamFlakeAt > 90) {
              beamFlakeAt = now
              flakes.push({
                x: mercWX - 0.15,
                y: yFor(b.midi) + 0.012,
                vx: -0.25 - Math.random() * 0.3,
                vy: 0.12 + Math.random() * 0.2,
                t: 0,
              })
            }
          }
        }
        while (beamVar.length > 0 && now - beamVar[0].t > C.beam.varWindowMs) {
          beamVar.shift()
        }
        if (!b.done && mercWX >= b.x1 - 0.25) {
          b.done = true
          const meanC = beamCentsT > 0 ? beamCentsSum / beamCentsT : 0
          tally.quality.set(activeIdx, qualityFromCents(meanC, C.score))
          tally.centsMeans.push(meanC)
          advanceTo(activeIdx + 1)
        }
      } else if (n.t === 'atrium') {
        // === Improv Atrium: any note in the key raises a step ===
        const a = n.a
        if (midi !== null) {
          let best = -1
          let bd = Infinity
          for (const m2 of a.scaleMidis) {
            const d = Math.abs(midi - m2)
            if (d < bd) {
              bd = d
              best = m2
            }
          }
          const inZone = mercWX > a.x0 - 0.3
          if (inZone) atriumVoicedT += dt
          if (best >= 0 && bd <= C.atrium.snapSemis) {
            if (inZone) {
              atriumInT += dt
              atriumCentsSum += bd * 100 * dt
            }
            if (atriumHoldMidi === best) {
              atriumHoldMs += dt
            } else {
              atriumHoldMidi = best
              atriumHoldMs = 0
            }
            if (atriumHoldMs >= C.atrium.stableMs) {
              atriumHoldMs = -1e9 // one step per hold; a new note re-arms
              spawnAtriumStep(a, best)
            }
          } else {
            atriumHoldMidi = -1
            atriumHoldMs = 0
          }
        } else {
          atriumHoldMidi = -1
          atriumHoldMs = 0
        }
        if (mercWX >= a.x1 - 0.3) {
          const ratio = atriumVoicedT > 0 ? atriumInT / atriumVoicedT : 0
          tally.quality.set(
            activeIdx,
            Math.min(1, ratio / C.atrium.inKeyFullRatio),
          )
          if (atriumInT > 0) tally.centsMeans.push(atriumCentsSum / atriumInT)
          atriumVoicedT = 0
          atriumInT = 0
          atriumCentsSum = 0
          advanceTo(activeIdx + 1)
        }
      }
    }

    // beam flakes drift down and fade
    if (flakes.length > 0) {
      for (const f of flakes) {
        f.t += dt / 1000
        f.x += (f.vx * dt) / 1000
        f.y += (f.vy * dt) / 1000
        f.vy += (0.9 * dt) / 1000
      }
      flakes = flakes.filter((f) => f.t < 1.1)
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
            const latency = (tapLatencyMs / 1000) * rhythmSpeed
            const win = Math.max(
              (C.tap.windowMs / 1000) * rhythmSpeed,
              (n.p.x1 - n.p.x0) / 2,
            )
            let hitP: Platform | null = null
            if (taps.length > 0 && Math.abs(mercWX - latency - center) <= win) {
              hitP = n.p
            } else if (mercWX > n.p.x1 + 0.15) {
              // a passed slab lights late — the song keeps going, the
              // miss just is not celebrated. Hard tiers (tap.maxMisses)
              // end the run once too many slip by.
              n.p.lit = true
              n.p.dwell = 9999
              rhythmMisses += 1
              tally.quality.set(activeIdx, 0)
              if (C.tap.maxMisses > 0 && rhythmMisses >= C.tap.maxMisses) {
                setPhase('fallen')
              } else {
                advanceTo(activeIdx + 1)
              }
            }
            if (hitP !== null) {
              const offMs = ((mercWX - latency - center) / rhythmSpeed) * 1000
              tally.quality.set(
                activeIdx,
                qualityFromOffset(offMs, C.tap.windowMs),
              )
              tally.offsetsMs.push(offMs)
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
      } else if (isListen()) {
        // === listen: hear the note, tap the slab that matches ===
        const home = platforms[listenHome]
        mercWX += ((home.x0 + home.x1) / 2 - mercWX) * 0.08
        mercY += (yFor(home.midi) - 0.035 - mercY) * C.tap.yLerp
        if (listenAdvanceAt > 0 && last >= listenAdvanceAt) {
          listenAdvanceAt = 0
          advanceTo(activeIdx + 1)
        }
        const answers = (driver?.drainIntents() ?? []).filter(
          (t) => t.type === 'tap' && t.x !== undefined,
        )
        if (p === 'play' && listenAdvanceAt === 0 && activeIdx < nodes.length) {
          const n = nodes[activeIdx]
          if (n.t === 'land') {
            if (listenFanAt !== activeIdx) {
              listenFan = buildFan(n.p)
              listenFanAt = activeIdx
            }
            // a shaken wrong pick dissolves, then the prompt replays —
            // process of elimination keeps every question winnable
            if (
              listenWrongT >= 0 &&
              last - listenWrongT > C.listen.wrongShakeMs + 150
            ) {
              listenWrongT = -1
              listenFan = listenFan.filter((m) => m !== listenWrongMidi)
              promptListen(n.p.midi)
            }
            const rect = canvas.getBoundingClientRect()
            const vw = rect.width
            const vh = rect.height
            const vu = vw < vh ? C.art.viewUnitsPortrait : C.view.viewUnits
            const upx = vw / vu
            for (const a of answers) {
              const cx = (a.x ?? 0) - rect.left
              const cy = (a.y ?? 0) - rect.top
              const inX =
                cx >= (n.p.x0 - camX) * upx - 8 &&
                cx <= (n.p.x1 - camX) * upx + 8
              // the nearest rung at the question's road position wins
              let pickMidi = -1
              let pickDy = 46
              if (inX) {
                for (const m of [n.p.midi, ...listenFan]) {
                  const dy = Math.abs(cy - (yFor(m) - camY) * vh)
                  if (dy < pickDy) {
                    pickDy = dy
                    pickMidi = m
                  }
                }
              }
              if (pickMidi === n.p.midi) {
                tally.quality.set(
                  activeIdx,
                  Math.max(0, 1 - listenWrongs * C.score.listenWrongPenalty),
                )
                n.p.lit = true
                n.p.dwell = 9999
                promptListen(n.p.midi) // the answer rings back as reward
                try {
                  navigator.vibrate?.(C.tap.vibrateMs)
                } catch {
                  // no haptics on this device
                }
                mercY -= 0.03
                listenHome = platforms.indexOf(n.p)
                listenWrongT = -1
                listenAdvanceAt = last + C.listen.hopDelayMs
                break
              } else if (pickMidi >= 0) {
                listenWrongT = last // the phantom shakes its head
                listenWrongMidi = pickMidi
                listenWrongs += 1
              } else if (last - listenPromptAt > C.listen.replayGapMs) {
                promptListen(n.p.midi) // tap elsewhere = hear it again
              }
            }
          } else {
            advanceTo(activeIdx + 1) // listen compiles land nodes only
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
        // air re-lift gate: a voiced ONSET while airborne is a re-lift;
        // past control.airReliftMax of them the voice stops lifting
        // until Merc lands — a hard-tier jump is sung as ONE note
        const voicedNow = midi !== null
        if (voicedNow && !wasVoicedTr && restIdx === null) {
          airRelifts += 1
          liftBlocked = airRelifts > C.control.airReliftMax
        }
        if (restIdx !== null) {
          airRelifts = 0
          liftBlocked = false
        }
        wasVoicedTr = voicedNow
        if (p === 'play' && midi !== null && !liftBlocked) {
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
            // standing cracks glass here too — an icy slab in a sung
            // level is a step, not a camp
            if (pl.kind === 'glass') {
              pl.integrity = Math.max(0, pl.integrity - dt / C.glass.crackMs)
              if (pl.integrity === 0 && !pl.broken) {
                shatterPlatform(pl)
                restIdx = null
              }
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
          if (fallenMs > C.fall.cardDelayMs && p === 'play') {
            tally.falls += 1
            setPhase('fallen')
          }
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
              if (fallenMs > C.fall.cardDelayMs && p === 'play') {
                tally.falls += 1
                setPhase('fallen')
              }
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
            if (
              pl.kind === 'glass' &&
              pl.ephemeral !== true &&
              Math.abs(mercY - sitY) < 0.02
            ) {
              pl.integrity = Math.max(0, pl.integrity - dt / C.glass.crackMs)
              if (pl.integrity === 0 && !pl.broken) {
                shatterPlatform(pl)
                restIdx = null
              }
            }
          }
        }
      }
      for (const pl of platforms) {
        if (pl.ephemeral === true && !pl.broken) {
          pl.ttlMs = (pl.ttlMs ?? 0) - dt
          if (pl.ttlMs <= 0) {
            pl.broken = true
            pl.respawnMs = 1e9 // a faded thought does not regrow
          }
        }
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
          switch (n.t) {
            case 'land':
              wantWX = (n.p.x0 + n.p.x1) / 2
              break
            case 'pane':
              wantWX = n.pane.wx - C.pane.approachBack
              break
            case 'whisper':
              // a loud voice stands still before the sleeper
              wantWX = quiet ? n.z.x1 + 0.6 : mercWX
              break
            case 'boss':
              wantWX = bossTargetWX(n.boss)
              break
            case 'beam':
              // the beam only carries an in-band voice forward
              wantWX =
                Math.abs(midi - n.beam.midi) <= C.beam.tolSemis
                  ? n.beam.x1 + 0.5
                  : mercWX
              break
            case 'atrium': {
              // the room has no floor of its own: you walk exactly as
              // far as the steps you have sung, and only a note IN THE
              // KEY carries you along them
              let ad = Infinity
              for (const m2 of n.a.scaleMidis) {
                ad = Math.min(ad, Math.abs(midi - m2))
              }
              let reach = n.a.x0
              for (const pl of platforms) {
                if (pl.ephemeral === true && !pl.broken && pl.x1 > reach) {
                  reach = pl.x1
                }
              }
              const edge = Math.min(
                n.a.x1 + 0.5,
                reach - C.atrium.stepReachBack,
              )
              wantWX = ad <= C.atrium.snapSemis && edge > mercWX ? edge : mercWX
              break
            }
          }
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
      if (isTrials() || isRhythm() || isListen()) {
        let wantY = camY
        const rel = mercY - camY
        if (restIdx !== null || isRhythm() || isListen()) {
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
      C.hud.guideLine && !isRhythm() && !isListen() && phase() === 'play'
        ? objectiveMidi()
        : null
    if (guideMidi !== null) {
      const gy = yFor(guideMidi) * h
      const pulse = 0.2 + (Math.sin(last / 300) + 1) * 0.09
      ctx.strokeStyle = `rgba(${P.guideRgb},${pulse})`
      ctx.lineWidth = 1.5
      ctx.setLineDash([10, 9])
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(w, gy)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = `rgba(${P.guideTextRgb},${0.7 + (Math.sin(last / 300) + 1) * 0.15})`
      ctx.font = "700 15px 'Saira Condensed', monospace"
      ctx.fillText(midiToNoteNameOctave(guideMidi), 12, gy - 8)
    }

    // the melody ribbon: the contour ahead drawn as one flowing line —
    // platforms sit ON the tune; the curve says where it bends next
    if (C.art.ribbon && !isRhythm() && !isListen()) {
      const pts: { x: number; y: number }[] = []
      let seen = 0
      for (
        let i = Math.max(0, activeIdx - 1);
        i < nodes.length && seen < C.art.ribbonAhead;
        i++
      ) {
        const n = nodes[i]
        if (n.t !== 'land') continue
        pts.push({ x: X((n.p.x0 + n.p.x1) / 2), y: yFor(n.p.midi) * h - 3 })
        seen += 1
      }
      if (pts.length > 1) {
        ctx.strokeStyle = `rgba(${P.syllableRgb},${C.art.ribbonAlpha})`
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length - 1; i++) {
          ctx.quadraticCurveTo(
            pts[i].x,
            pts[i].y,
            (pts[i].x + pts[i + 1].x) / 2,
            (pts[i].y + pts[i + 1].y) / 2,
          )
        }
        const tail = pts[pts.length - 1]
        ctx.lineTo(tail.x, tail.y)
        ctx.stroke()
      }
    }

    // rhythm: every slab breathes with the beat once the road rolls
    let beatGlow = 0
    if (
      C.art.beatPulse &&
      isRhythm() &&
      phase() === 'play' &&
      last >= rhythmStartAt
    ) {
      const beatMs = 60000 / rhythmBpm
      const beatPh = ((last - rhythmStartAt) % beatMs) / beatMs
      beatGlow = Math.pow(1 - beatPh, 3) * C.art.beatPulseAmt
    }

    // Improv Atrium rooms: a soft glass-light column with dashed walls —
    // the open room reads as a place, not a gap
    for (const a of atriums) {
      const ax0 = X(a.x0)
      const ax1 = X(a.x1)
      if (ax1 < -40 || ax0 > w + 40) continue
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0, 'rgba(126,231,255,0.10)')
      grad.addColorStop(1, 'rgba(126,231,255,0.02)')
      ctx.fillStyle = grad
      ctx.fillRect(ax0, 0, ax1 - ax0, h)
      ctx.strokeStyle = 'rgba(126,231,255,0.30)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 9])
      for (const bx of [ax0, ax1]) {
        ctx.beginPath()
        ctx.moveTo(bx, h * 0.06)
        ctx.lineTo(bx, h * 0.97)
        ctx.stroke()
      }
      ctx.setLineDash([])
      // the key, drawn: every note that will hold your weight gets a
      // faint rung, so the room reads as a keyboard and not a gap
      ctx.font = "700 12px 'Saira Condensed', monospace"
      ctx.setLineDash([2, 7])
      for (const m of a.scaleMidis) {
        const my = yFor(m) * h
        if (my < -20 || my > h + 20) continue
        const home = m === a.tonicMidi
        ctx.strokeStyle = home
          ? 'rgba(126,231,255,0.30)'
          : 'rgba(126,231,255,0.14)'
        ctx.beginPath()
        ctx.moveTo(ax0 + 6, my)
        ctx.lineTo(ax1 - 6, my)
        ctx.stroke()
        ctx.fillStyle = home
          ? 'rgba(126,231,255,0.62)'
          : 'rgba(126,231,255,0.32)'
        ctx.fillText(midiToNoteNameOctave(m), ax0 + 10, my - 5)
      }
      ctx.setLineDash([])
      // the room says what it is — no unexplained dashed space
      ctx.fillStyle = 'rgba(126,231,255,0.5)'
      ctx.font = "700 13px 'Saira Condensed', monospace"
      ctx.fillText('IMPROV ATRIUM — SING IN KEY TO LAY THE FLOOR', ax0 + 10, 26)
    }

    const slabH = Math.max(
      C.art.platformMinPx,
      Math.min(C.art.platformMaxPx, C.art.platformUnits * unitPx),
    )
    // the dashed candidate coat listen questions dress ALL rungs in —
    // one function so the true slab and its phantoms cannot drift apart
    const drawListenBox = (
      bx0: number,
      bx1: number,
      by: number,
      wob: number,
      fade: number,
    ): void => {
      ctx.globalAlpha = (0.55 + (Math.sin(last / 260) + 1) * 0.2) * fade
      ctx.strokeStyle = P.activeEdge
      ctx.lineWidth = 2.5
      ctx.setLineDash([7, 6])
      ctx.beginPath()
      ctx.roundRect(bx0 - 5 + wob, by - 9, bx1 - bx0 + 10, slabH + 12, 8)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = `rgba(${P.labelRgb},0.85)`
      ctx.font = "700 15px 'Saira Condensed', monospace"
      ctx.fillText('?', (bx0 + bx1) / 2 - 3 + wob, by - 14)
      ctx.globalAlpha = 1
    }
    for (const pl of platforms) {
      if (pl.ephemeral === true) continue
      const y = yFor(pl.midi) * h
      const x0 = X(pl.x0)
      const x1 = X(pl.x1)
      if (x1 < -40 || x0 > w + 40) continue
      const isActive =
        activeIdx < nodes.length &&
        nodes[activeIdx].t === 'land' &&
        (nodes[activeIdx] as Extract<Node, { t: 'land' }>).p === pl
      // in listen the answer must not LOOK like the answer: the active
      // styling is suppressed; both candidates share one treatment
      const showActive = isActive && !isListen()
      const accent = pl.kind === 'glass' ? P.accentGlass : P.accentStone

      if (pl.broken) {
        // ghost outline while the glass regrows
        ctx.strokeStyle = `rgba(${P.edgeGlassRgb},0.14)`
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
      ctx.fillStyle = pl.kind === 'glass' ? P.slabGlass : P.slabStone
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
        pl.kind === 'glass' ? P.undersideGlass : P.undersideStone
      ctx.lineWidth = 1
      ctx.stroke()

      // top edge light — the note surface Merc lands on
      ctx.lineCap = 'round'
      ctx.lineWidth = 2
      ctx.strokeStyle = pl.lit
        ? accent
        : showActive
          ? P.activeEdge
          : pl.kind === 'glass'
            ? `rgba(${P.edgeGlassRgb},${0.5 + beatGlow})`
            : `rgba(${P.edgeStoneRgb},${0.35 + beatGlow})`
      ctx.beginPath()
      ctx.moveTo(x0 + 3, y - 3)
      ctx.lineTo(x1 - 3, y - 3)
      ctx.stroke()

      if (showActive && pl.dwell > 0 && !pl.lit) {
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
        ctx.strokeStyle = `rgba(${P.labelRgb},0.65)`
        ctx.lineWidth = 1
        for (let c = 0; c < n; c++) {
          const cx = x0 + ((c + 0.7) / 6.4) * (x1 - x0)
          ctx.beginPath()
          ctx.moveTo(cx, y - 2)
          ctx.lineTo(cx + (c % 2 === 0 ? 4 : -4), y + slabH - 2 + c * 1.5)
          ctx.stroke()
        }
      }

      const labelA = showActive
        ? 0.75 + (Math.sin(last / 300) + 1) * 0.125
        : pl.lit
          ? 0.55
          : C.hud.inactiveLabelAlpha
      ctx.fillStyle = `rgba(${P.labelRgb},${labelA})`
      ctx.font = showActive
        ? "700 13px 'Saira Condensed', monospace"
        : "600 11px 'Saira Condensed', monospace"
      // in listen, unlit note names would spell out the answer — the
      // ear is supposed to do the reading
      if (!isListen() || pl.lit) {
        ctx.fillText(midiToNoteNameOctave(pl.midi), x0, y - 10)
      }

      // listen: the true slab wears the same dashed coat as its
      // phantom rungs (drawn after this loop)
      if (isListen() && !pl.lit && isActive) {
        drawListenBox(x0, x1, y, 0, 1)
      }

      // karaoke syllable under the slab (melody levels); the active one
      // carries an underline — the bouncing-ball of this karaoke. In
      // listen a syllable would tag the true slab among its phantoms,
      // so unlit slabs keep quiet there.
      if (pl.syllable !== undefined && (!isListen() || pl.lit)) {
        ctx.fillStyle = `rgba(${P.syllableRgb},${Math.max(labelA, 0.45)})`
        ctx.font = showActive
          ? "700 13px 'Saira Condensed', monospace"
          : "600 12px 'Saira Condensed', monospace"
        ctx.fillText(pl.syllable, x0 + 2, y + slabH + 13)
        if (showActive) {
          const tw = ctx.measureText(pl.syllable).width
          ctx.strokeStyle = `rgba(${P.syllableRgb},0.9)`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x0 + 2, y + slabH + 16.5)
          ctx.lineTo(x0 + 2 + tw, y + slabH + 16.5)
          ctx.stroke()
        }
      }
    }

    // listen phantoms: fake rungs at the true slab's road position in
    // full slab dress — nothing but pitch separates the candidates
    if (isListen() && activeIdx < nodes.length) {
      const n = nodes[activeIdx]
      if (n.t === 'land' && !n.p.lit) {
        const kind = n.p.kind
        const pat = kind === 'glass' ? patterns.crystal : patterns.stone
        const x0 = X(n.p.x0)
        const x1 = X(n.p.x1)
        for (const m of listenFan) {
          const wrong = listenWrongT >= 0 && m === listenWrongMidi
          const ft = wrong
            ? Math.max(0, 1 - (last - listenWrongT) / C.listen.wrongShakeMs)
            : 1
          const wob = wrong ? Math.sin((last - listenWrongT) / 26) * 5 * ft : 0
          const y = yFor(m) * h
          ctx.globalAlpha = ft
          ctx.beginPath()
          ctx.roundRect(x0 + wob, y - 3, x1 - x0, slabH, 5)
          ctx.fillStyle = kind === 'glass' ? P.slabGlass : P.slabStone
          ctx.fill()
          if (pat !== null) {
            ctx.globalAlpha = (kind === 'glass' ? 0.6 : 0.9) * ft
            ctx.fillStyle = pat
            ctx.fill()
          }
          ctx.globalAlpha = ft
          ctx.strokeStyle =
            kind === 'glass' ? P.undersideGlass : P.undersideStone
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.lineCap = 'round'
          ctx.lineWidth = 2
          ctx.strokeStyle =
            kind === 'glass'
              ? `rgba(${P.edgeGlassRgb},0.5)`
              : `rgba(${P.edgeStoneRgb},0.35)`
          ctx.beginPath()
          ctx.moveTo(x0 + 3 + wob, y - 3)
          ctx.lineTo(x1 - 3 + wob, y - 3)
          ctx.stroke()
          ctx.globalAlpha = 1
          drawListenBox(x0, x1, y, wob, ft)
        }
      }
    }

    // atrium steps: sung thoughts in glass — they glow, then fade out
    for (const pl of platforms) {
      if (pl.ephemeral !== true || pl.broken) continue
      const y = yFor(pl.midi) * h
      const x0 = X(pl.x0)
      const x1 = X(pl.x1)
      if (x1 < -40 || x0 > w + 40) continue
      const fade = Math.max(0.18, Math.min(1, (pl.ttlMs ?? 0) / 1500))
      ctx.globalAlpha = fade
      ctx.beginPath()
      ctx.roundRect(x0, y - 3, x1 - x0, slabH, 5)
      ctx.shadowColor = P.accentGlass
      ctx.shadowBlur = 12 * fade
      ctx.fillStyle = P.slabGlass
      ctx.fill()
      ctx.shadowBlur = 0
      if (patterns.crystal !== null) {
        ctx.globalAlpha = 0.6 * fade
        ctx.fillStyle = patterns.crystal
        ctx.fill()
      }
      ctx.globalAlpha = fade
      ctx.lineCap = 'round'
      ctx.lineWidth = 2
      ctx.strokeStyle = P.accentGlass
      ctx.beginPath()
      ctx.moveTo(x0 + 3, y - 3)
      ctx.lineTo(x1 - 3, y - 3)
      ctx.stroke()
      ctx.fillStyle = `rgba(${P.labelRgb},0.6)`
      ctx.font = "600 11px 'Saira Condensed', monospace"
      ctx.fillText(midiToNoteNameOctave(pl.midi), x0, y - 10)
      ctx.globalAlpha = 1
    }

    // Steady Beam: the light-bridge — bright and wide while the note is
    // steady, thin when it wobbles; flakes are the wobble made visible
    for (const b of beams) {
      const bx0 = X(b.x0)
      const bx1 = X(b.x1)
      if (bx1 < -40 || bx0 > w + 40) continue
      const by = yFor(b.midi) * h
      const isOn =
        activeIdx < nodes.length &&
        nodes[activeIdx].t === 'beam' &&
        (nodes[activeIdx] as Extract<Node, { t: 'beam' }>).beam === b
      const sm = shownMidi
      const carried =
        isOn && sm !== null && Math.abs(sm - b.midi) <= C.beam.tolSemis
      let meanVar = 0
      if (beamVar.length > 0) {
        for (const v of beamVar) meanVar += v.c
        meanVar /= beamVar.length
      }
      const steady = carried
        ? 1 - Math.min(1, meanVar / C.beam.varThinCents)
        : 0
      if (b.done || (!isOn && !carried)) {
        // ahead or behind: a faint promise of the crossing
        ctx.strokeStyle = `rgba(126,231,255,${b.done ? 0.28 : 0.2})`
        ctx.lineWidth = 2
        ctx.setLineDash([4, 8])
        ctx.beginPath()
        ctx.moveTo(bx0 + 2, by)
        ctx.lineTo(bx1 - 2, by)
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        const bh = carried ? 3 + 8 * steady : 2.5
        const pulse = 0.75 + Math.sin(last / 170) * 0.25
        ctx.globalAlpha = (carried ? 0.4 + 0.5 * steady : 0.3) * pulse
        const grad = ctx.createLinearGradient(0, by - bh, 0, by + bh)
        grad.addColorStop(0, 'rgba(126,231,255,0)')
        grad.addColorStop(0.5, 'rgba(200,245,255,0.95)')
        grad.addColorStop(1, 'rgba(126,231,255,0)')
        ctx.fillStyle = grad
        ctx.fillRect(bx0, by - bh, bx1 - bx0, bh * 2)
        ctx.globalAlpha = 1
      }
    }
    if (flakes.length > 0) {
      ctx.fillStyle = 'rgba(200,245,255,0.8)'
      for (const f of flakes) {
        ctx.globalAlpha = Math.max(0, 1 - f.t)
        ctx.fillRect(X(f.x), f.y * h, 3, 3)
      }
      ctx.globalAlpha = 1
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
          ctx.strokeStyle = `rgba(${P.ringRgb},${0.2 + closeness * 0.6})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(cx, cy, 9 + (1 - closeness) * 36, 0, 6.283)
          ctx.stroke()
          ctx.strokeStyle = `rgba(${P.ringRgb},0.85)`
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
      const tall = pane.kind === 'wall' ? 150 : pane.kind === 'ring' ? 64 : 108
      const wide = pane.kind === 'wall' ? 34 : pane.kind === 'ring' ? 64 : 28
      if (pane.burstT < 0.02) {
        const hiddenGlow = pane.kind === 'hidden' ? pane.reveal : 0
        ctx.beginPath()
        ctx.roundRect(
          gx - wide / 2,
          gy - tall / 2,
          wide,
          tall,
          pane.kind === 'ring' ? 32 : 8,
        )
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
        ctx.fillStyle = `rgba(${P.labelRgb},${paneLabelA})`
        ctx.font = isActivePane
          ? "700 13px 'Saira Condensed', monospace"
          : "600 11px 'Saira Condensed', monospace"
        ctx.fillText(
          pane.kind === 'hidden' ? '?' : midiToNoteNameOctave(pane.midi),
          gx - wide / 2,
          gy - tall / 2 - 8,
        )
        if (pane.kind === 'ring') {
          // Resonance Ring: concentric arcs breathe with the resonance;
          // once ringing, they shiver with the singer's actual vibrato
          const R = C.ring
          const ringing = pane.res >= R.holdCap
          const shiver = ringing
            ? Math.sin(last / 55) * (2.5 + vibState.depthCents / 14)
            : 0
          ctx.strokeStyle = '#bc8cff'
          ctx.lineWidth = 1.5
          for (let k = 0; k < 3; k++) {
            const r = 42 + k * 13 + shiver * (1 + k * 0.4)
            ctx.globalAlpha =
              Math.max(0, 0.65 - k * 0.2) * (0.25 + pane.res * 0.75)
            ctx.beginPath()
            ctx.arc(gx, gy, r, 0, 6.283)
            ctx.stroke()
          }
          ctx.globalAlpha = 1
          if (ringing) {
            // the ask, drawn: a live sine ribbon under the ring
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'
            ctx.lineWidth = 2
            ctx.beginPath()
            for (let i = 0; i <= 20; i++) {
              const px = gx - 20 + i * 2
              const py = gy + tall / 2 + 16 + Math.sin(i * 0.9 + last / 90) * 4
              if (i === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
            }
            ctx.stroke()
          }
        }
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
      ctx.strokeStyle = `rgba(${P.labelRgb},0.85)`
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
            ctx.fillStyle = `rgba(${P.labelRgb},0.85)`
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
      ctx.fillStyle = P.accentGlass
      for (const s of puff) {
        ctx.globalAlpha = Math.max(0, 1 - puffT)
        ctx.fillRect(X(s.x), s.y * h, s.r, s.r)
      }
      ctx.globalAlpha = 1
    }

    if (C.hud.pitchGhost && ghost.length > 1) {
      // the raw voice, un-smoothed — what the singer actually did
      ctx.strokeStyle = `rgba(${P.labelRgb},0.16)`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X(ghost[0].wx), ghost[0].y * h)
      for (const g of ghost) ctx.lineTo(X(g.wx), g.y * h)
      ctx.stroke()
    }
    if (trail.length > 1) {
      ctx.strokeStyle = `rgba(${P.syllableRgb},0.5)`
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
      ctx.fillStyle = P.accentStone
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
        grad.addColorStop(0, `rgba(${P.syllableRgb},${a})`)
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
    // Never for the hidden door (no spoilers), the whisper passage, or
    // rhythm play — they say where the VOICE must go, and tap has no
    // voice (Merc glides to each note himself).
    if (phase() === 'play' && !isRhythm() && !isListen()) {
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
        ctx.strokeStyle = `rgba(${P.guideRgb},${pulse})`
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
    ctx.fillStyle = P.base
    ctx.fillRect(0, 0, w, h)
    coverWrap(ctx, art.sky, w, h, camPx * C.art.parallaxFar)
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = theme.art?.nebulaAlpha ?? C.art.nebulaAlpha
    coverWrap(ctx, art.nebula, w, h, camPx * C.art.parallaxMid)
    ctx.globalAlpha = theme.art?.dustAlpha ?? C.art.dustAlpha
    coverWrap(ctx, art.dust, w, h, camPx * C.art.parallaxNear)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    // seat the play space: quiet, darker ground for HUD and low platforms
    const g = ctx.createLinearGradient(0, h * 0.72, 0, h)
    g.addColorStop(0, `rgba(${P.seatRgb},0)`)
    g.addColorStop(1, `rgba(${P.seatRgb},0.82)`)
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
        window as unknown as { __listen?: () => Record<string, unknown> }
      ).__listen = () => {
        const rect = canvas.getBoundingClientRect()
        const vu =
          rect.width < rect.height ? C.art.viewUnitsPortrait : C.view.viewUnits
        const upx = rect.width / vu
        const at = (pl: Platform): Record<string, number> => ({
          cx: rect.left + ((pl.x0 + pl.x1) / 2 - camX) * upx,
          cy: rect.top + (yFor(pl.midi) - camY) * rect.height,
          midi: pl.midi,
        })
        const n = nodes[activeIdx] as Node | undefined
        const tp = n !== undefined && n.t === 'land' ? n.p : null
        const rungAt = (midi: number): Record<string, number> | null =>
          tp === null
            ? null
            : {
                cx: rect.left + ((tp.x0 + tp.x1) / 2 - camX) * upx,
                cy: rect.top + (yFor(midi) - camY) * rect.height,
                midi,
              }
        return {
          activeIdx,
          target: tp !== null ? at(tp) : null,
          fan: listenFan.map(rungAt),
          home: listenHome,
          wrong: listenWrongT >= 0,
          wrongs: listenWrongs,
        }
      }
      ;(
        window as unknown as { __vibp?: () => Record<string, unknown> }
      ).__vibp = () => ({
        ...vibState,
        ring: rawRing.slice(-70),
      })
      ;(
        window as unknown as { __world?: () => Record<string, unknown> }
      ).__world = () => ({
        platforms: platforms.map((pl) => ({
          x0: pl.x0,
          x1: pl.x1,
          midi: pl.midi,
          lit: pl.lit,
          kind: pl.kind,
        })),
        panes: panes.map((pn) => ({
          wx: pn.wx,
          midi: pn.midi,
          kind: pn.kind,
          res: Math.round(pn.res * 1000) / 1000,
          burst: pn.burstT >= 0,
        })),
        beams: beams.map((b) => ({ ...b })),
        nodes: nodes.map((n) =>
          n.t === 'land'
            ? { t: n.t, midi: n.p.midi, lit: n.p.lit }
            : n.t === 'pane'
              ? {
                  t: n.t,
                  midi: n.pane.midi,
                  kind: n.pane.kind,
                  burst: n.pane.burstT >= 0,
                }
              : n.t === 'beam'
                ? {
                    t: n.t,
                    midi: n.beam.midi,
                    x1: n.beam.x1,
                    done: n.beam.done,
                  }
                : n.t === 'atrium'
                  ? { t: n.t, x1: n.a.x1, tonic: n.a.tonicMidi }
                  : { t: n.t },
        ),
        atriums: atriums.map((a) => ({
          x0: a.x0,
          x1: a.x1,
          tonicMidi: a.tonicMidi,
        })),
        vib: vibState.active,
        vibDetail: { ...vibState },
        groundMidi,
        winLo,
        winHi,
        worldMax,
        tapLatencyMs,
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
    <div class="jp-root" classList={{ 'jp-root--light': theme.light === true }}>
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
              {isListen()
                ? 'Playing it by ear: Merc hums the next note — two slabs light up; tap the one whose height matches what you heard. No microphone.'
                : isRhythm()
                  ? 'Playing it by rhythm: the road moves at tempo — tap anywhere as Merc crosses each slab, and the taps perform the song. No microphone.'
                  : isTrials()
                    ? 'Playing it as a platformer: walk with keys or pads, sing each note to leap its interval.'
                    : 'Playing it as a song line: your voice is the height — trace the melody.'}
            </p>
          </Show>
          <button class="jp-start" onClick={() => void start()}>
            {isRhythm()
              ? 'Start — no mic needed'
              : isListen()
                ? 'Start — ears only, no mic'
                : 'Start — allow the mic'}
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
          <h2 class="jp-title">
            {isRhythm() ? 'The beat ran ahead.' : 'The glass gave way.'}
          </h2>
          <p class="jp-text">
            {isRhythm()
              ? 'Too many slabs slipped by unlit. Catch them as Merc crosses — the rings meeting is the moment.'
              : 'The void keeps what it catches.'}
          </p>
          <button class="jp-start" onClick={retry}>
            {!isRhythm() && lastCheckpointIdx >= 0
              ? 'Retry from the checkpoint'
              : 'Retry'}
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
          <Show when={finalScore() !== null}>
            <p class="jp-score">
              <Show when={finalScore()?.grade != null}>
                <span class={`jp-grade jp-grade--${finalScore()?.grade ?? ''}`}>
                  {(finalScore()?.grade ?? '').toUpperCase()}
                </span>
              </Show>
              Run score {finalScore()?.pct}% —{' '}
              {finalScore()?.great === true
                ? 'a polished run.'
                : finalScore()?.passed === true
                  ? 'inside the pass band.'
                  : 'under the pass band — yours to polish.'}
              <span class="jp-score__detail">
                {finalScore()?.detail}
                {bestPct() !== null ? ` — best ${bestPct()}%` : ''}
              </span>
            </p>
          </Show>
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
