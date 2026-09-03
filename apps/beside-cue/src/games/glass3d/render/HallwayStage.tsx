// The Hallway, mounted: slice 1's journey.
// ============================================================
//
// Merc walks in, a pane blocks the way, the voice breaks it, he
// crosses through the wreckage. The component owns exactly what
// Stage3D owns for the Cabinet — canvas, mic lifecycle, HUD signals —
// plus the one thing slice 1 adds: the traversal, a four-phase state
// machine simple enough to read as stage directions.
//
// SLICE 2 TOOK THE WHEEL OFF THE SCRIPT. The phases used to advance
// `mercX` by a constant; now the player walks him, through
// `sim/locomotion3d`, and a phase ends when he ARRIVES rather than when
// enough seconds have passed. Nothing else about the scene changed,
// which is the whole point of doing it here first: a control that feels
// wrong in a room that already worked is a control problem, and cannot
// be confused with a chamber problem (docs/games/standing-wave-chamber.md §6).
//
// The pane is a wall, not a trigger. Before the break he simply cannot
// walk past x = 0, and afterwards he can -- so "the glass is in the way"
// is a fact about the room rather than a rule about the state machine.

import { applyPreferredInput } from '@irchiinnuss/audio-io'
import { MicInput } from '@irchiinnuss/audio-io/solid'
import { midiToFreq, midiToNote } from '@irchiinnuss/pitch-engine'
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { createSingDriver } from '@/games/glass/drivers/sing'
import type { InteractionDriver } from '@/games/glass/drivers/types'
import { micErrorLine } from '@/games/glass/mic-error'
import { createVibratoDetector } from '@/games/glass/vibrato'
import { createGlassTone } from '../audio/glass-tone'
import { bindKeyboard, createIntentSource } from '../input/pad-intent'
import { createLoopState, runLoop } from '../runtime/loop'
import type { GroundSampler, LocomotionConfig } from '../sim/locomotion3d'
import { createLocomotion, stepLocomotion } from '../sim/locomotion3d'
import { accuracy, createResonance, stepResonance } from '../sim/resonance3d'
import type { ShardLaunch } from '../sim/shatter3d'
import { solveShatter } from '../sim/shatter3d'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { HallwayView } from './Hallway3D'
import { createHallway3D, PANE } from './Hallway3D'
import { TouchControls } from './TouchControls'
import { VoiceCoach } from './VoiceCoach'

const MIC_ID = 'glass3d-hallway'

/** The pane's note: G4. A third below the Cabinet's A4, so the two
 * rooms ask for different notes and the ear tells them apart. */
const TARGET_MIDI = 67

/** The journey, in corridor metres. */
const START_X = -1.5
const SING_X = -0.52
const EXIT_X = 1.45

/** Close enough to the wall to count as having arrived. He is clamped
 * exactly to it, so this only has to survive floating point. */
const ARRIVED = 0.005

/** The floor of the Hallway: flat, everywhere, forever. The chamber is
 * where this gets interesting. */
const HALLWAY_FLOOR: GroundSampler = () => 0

/** Slower than a walk, and the threshold for "he is going somewhere".
 * Below it he is drifting to a stop and should look like it. */
const WALKING_VX = 0.06

/** The beat between the break and moving on: long enough to watch the
 * shards fly, short enough that he is visibly eager. */
const CELEBRATE_SECONDS = 1.1

const TEXT_INTERVAL = 0.1

type Phase = 'enter' | 'sing' | 'celebrate' | 'crossing' | 'done'

interface HallwayStageProps {
  onExit: () => void
}

export const HallwayStage = (props: HallwayStageProps) => {
  let canvas!: HTMLCanvasElement
  const [micError, setMicError] = createSignal<string | null>(null)
  const [started, setStarted] = createSignal(false)
  const [backend, setBackend] = createSignal('…')
  const [charge, setCharge] = createSignal(0)
  const [ringing, setRinging] = createSignal(false)
  const [heardMidi, setHeardMidi] = createSignal<number | null>(null)
  // The wave as measured, not as judged. The Hallway used to keep only
  // `wave.active` and throw the numbers away, which left a player whose
  // wave was too slow, too shallow, or never heard at all looking at the
  // same unmoving bar for all three.
  const [wavering, setWavering] = createSignal(false)
  const [waveRate, setWaveRate] = createSignal(0)
  const [waveDepth, setWaveDepth] = createSignal(0)
  const [phase, setPhase] = createSignal<Phase>('enter')
  const [grade, setGrade] = createSignal<number | null>(null)

  let driver: InteractionDriver | null = null
  let stopLoop: (() => void) | null = null
  const tone = createGlassTone(midiToFreq(TARGET_MIDI))
  // Made here rather than in `begin()`, because the pad is rendered as
  // soon as the mic is live and `begin()` waits on the renderer.
  const input = createIntentSource()

  const cfg = WORLD3D_CONFIG
  const target = midiToNote(TARGET_MIDI)
  const targetName = `${target.name}${target.octave}`

  /** What the Hallway says INSTEAD of coaching, in the phases where
   * nothing is being sung at. `undefined` while singing hands the line
   * back to VoiceCoach, which is the only thing that knows how the wave
   * is going. */
  const phaseLine = createMemo(() => {
    switch (phase()) {
      case 'enter':
        return 'Merc has somewhere to be'
      case 'sing':
        return undefined
      case 'celebrate':
      case 'crossing':
        return 'Through he goes'
      case 'done':
        return `${grade() ?? 0}% in tune`
    }
  })

  onMount(() => {
    const r = createHallway3D(canvas, cfg)
    // Not the shipping controls -- the ones that make the room playable
    // at a desk, which is where it gets iterated on.
    const unbindKeys = bindKeyboard(input, window)

    const fit = (): void => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      r.resize(rect.width, rect.height, Math.min(window.devicePixelRatio, 1.5))
    }
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)

    const begin = (): void => {
      const ring = createResonance(TARGET_MIDI)
      const vib = createVibratoDetector(cfg.vibrato)
      let launches: readonly ShardLaunch[] | null = null
      let elapsed = 0
      // The shatter runs on WALL time, not on `elapsed`.
      //
      // `elapsed` is simulation time, and simulation time is spent in
      // fixed steps with a spiral guard: `runLoop` will advance at most
      // `maxStepsPerFrame` of them per frame and DROPS the rest. At
      // 1/120 s a step and five steps a frame that is 41.7 ms of
      // simulation per frame, so below about 24fps the simulation falls
      // behind real time and never catches up -- at 15fps it advances at
      // 62% of wall speed, at 12fps at half.
      //
      // For the simulation that is the correct trade. For an animation it
      // is not: the shards would play back in slow motion on exactly the
      // devices that were already struggling, and lurch as the drops
      // arrive unevenly, while Merc's own clip -- which the renderer
      // drives from the real frame delta -- carried on at full speed
      // beside them. Two clocks in one shot is what "slow, and it
      // stutters, and it looks wrong" is made of.
      let wallSeconds = 0
      let breakAtWall = 0
      const loco = createLocomotion(START_X)
      // The pane is the far wall until it is not. `minX` never moves:
      // there is nothing behind him worth walking back to.
      let walls: LocomotionConfig = {
        ...cfg.locomotion,
        minX: START_X,
        maxX: SING_X,
      }
      let phaseNow: Phase = 'enter'
      let celebrateUntil = 0
      let lastWaveStrength = 0
      let lastWave = false
      let lastWaveRate = 0
      let lastWaveDepth = 0
      let lastMidi: number | null = null
      let sinceText = TEXT_INTERVAL

      const go = (p: Phase): void => {
        phaseNow = p
        setPhase(p)
      }
      go('enter')

      // The clip follows the BODY, not the phase.
      //
      // While the walk was scripted the two were the same thing: a phase
      // was a movement. Now a player can stand still through 'crossing'
      // or walk during 'celebrate', and a clip chosen at the transition
      // would be wrong for as long as they felt like it. Walking wins
      // over celebrating on purpose -- a player who has taken control
      // back should see him obey rather than finish his little dance.
      let pose = ''
      const setPose = (name: string, loop = true): void => {
        if (pose === name) return
        pose = name
        r.merc()?.play(name, { loop })
      }
      const poseNow = (): void => {
        if (!loco.grounded || Math.abs(loco.vx) > WALKING_VX) setPose('move')
        else if (phaseNow === 'celebrate') setPose('celebrate', false)
        else if (phaseNow === 'done') setPose('sing')
        else setPose('listen')
      }

      const doBreak = (acc: number): void => {
        launches = solveShatter(
          r.centroids(),
          { x: 0, y: PANE.height * 0.52, z: 0 },
          acc,
          cfg.shatter,
          11,
        )
        breakAtWall = wallSeconds
        // The way out was blocked by a fact about the room, so opening
        // it is a fact about the room too.
        walls = { ...walls, maxX: EXIT_X }
        tone.shatter(acc)
        setGrade(Math.round(acc * 100))
        celebrateUntil = elapsed + CELEBRATE_SECONDS
        go('celebrate')
      }

      const view: HallwayView = {
        mercX: loco.x,
        mercY: 0,
        mercFacing: 1,
        resonance: 0,
        ringing: false,
        shatterSeconds: 0,
        launches: null,
      }

      const loopState = createLoopState()
      let last = performance.now()
      let frame = 0

      const tick = (now: number): void => {
        const frameSeconds = (now - last) / 1000
        last = now
        wallSeconds += frameSeconds

        runLoop(loopState, frameSeconds, cfg.loop, (dt) => {
          elapsed += dt

          // He walks in every phase, including the ones that are about
          // something else. A player who wants to shuffle while they
          // hold a note should be allowed to; the room is not a cutscene
          // with an input field in it.
          stepLocomotion(loco, input.read(now), HALLWAY_FLOOR, dt, walls)

          switch (phaseNow) {
            case 'enter':
              if (loco.x >= SING_X - ARRIVED) go('sing')
              break
            case 'sing': {
              const pitch = driver?.latestPitch() ?? null
              const wave =
                pitch === null
                  ? { active: false, strength: 0 }
                  : vib.feed(pitch.tAudio * 1000, pitch.midi)
              lastMidi = pitch?.midi ?? null
              lastWave = wave.active
              lastWaveStrength = wave.active ? wave.strength : 0
              // `rateHz`/`depthCents` are absent on the idle state, so
              // the guard is what keeps a measurement from being
              // invented for a wave that was never judged.
              lastWaveRate = 'rateHz' in wave ? wave.rateHz : 0
              lastWaveDepth = 'depthCents' in wave ? wave.depthCents : 0
              const broke = stepResonance(
                ring,
                {
                  midi: lastMidi,
                  vibrato: wave.active,
                  vibratoStrength: wave.strength,
                },
                dt,
                cfg.ring,
              )
              if (broke) doBreak(accuracy(ring, cfg.ring))
              break
            }
            case 'celebrate':
              if (elapsed >= celebrateUntil) go('crossing')
              break
            case 'crossing':
              if (loco.x >= EXIT_X - ARRIVED) go('done')
              break
            case 'done':
              break
          }
        })

        tone.update(ring.res, lastWaveStrength)
        setCharge(ring.res)
        setRinging(ring.res >= cfg.ring.holdCap && launches === null)
        sinceText += frameSeconds
        if (sinceText >= TEXT_INTERVAL) {
          sinceText = 0
          setHeardMidi(lastMidi)
          setWavering(lastWave)
          setWaveRate(lastWaveRate)
          setWaveDepth(lastWaveDepth)
        }

        poseNow()
        view.mercX = loco.x
        view.mercY = loco.y
        view.mercFacing = loco.facing
        view.resonance = ring.res
        view.ringing = ring.res >= cfg.ring.holdCap && launches === null
        view.launches = launches
        view.shatterSeconds = launches === null ? 0 : wallSeconds - breakAtWall

        r.render(view, frameSeconds)
        frame = requestAnimationFrame(tick)
      }

      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__w3h = () => ({
          phase: phaseNow,
          mercX: loco.x,
          mercY: loco.y,
          grounded: loco.grounded,
          charge: ring.res,
          broken: launches !== null,
          shards: r.centroids().length,
          backend: backend(),
          break: (acc = 1) => {
            if (launches === null && phaseNow === 'sing') doBreak(acc)
          },
          setCharge: (to = cfg.ring.holdCap) => {
            ring.res = Math.min(0.999, to)
          },
          // Walking a headless browser to the pane one keypress at a
          // time is not a test, it is a hostage situation.
          warpTo: (x: number) => {
            loco.x = Math.max(walls.minX, Math.min(walls.maxX, x))
          },
          move: (m: number) => {
            input.setMove(m)
          },
          jump: () => {
            input.pulseJump(performance.now())
          },
        })
        // No onCleanup here: begin() runs from init().then(), outside any
        // Solid owner, and a cleanup registered there is dropped with a
        // "will never be run" warning. The mount-level cleanup below
        // deletes the hook instead.
      }

      frame = requestAnimationFrame(tick)
      stopLoop = () => cancelAnimationFrame(frame)
    }

    void r
      .init()
      .then(() => {
        fit()
        setBackend(r.backend())
        begin()
      })
      .catch((err: unknown) => {
        setBackend('no GPU')
        setMicError(err instanceof Error ? err.message : String(err))
      })

    onCleanup(() => {
      observer.disconnect()
      unbindKeys()
      stopLoop?.()
      driver?.stop()
      tone.dispose()
      r.dispose()
      delete (window as unknown as Record<string, unknown>).__w3h
    })
  })

  const startMic = async (): Promise<void> => {
    setMicError(null)
    tone.start()
    try {
      // The remembered input, if it is still plugged in -- see
      // audio/input-device.ts. Must happen before acquire(), because the
      // device is chosen by the constraints that open the stream.
      await applyPreferredInput()
      driver = createSingDriver(MIC_ID)
      await driver.start()
      setStarted(true)
    } catch (err) {
      setMicError(micErrorLine(err))
      driver = null
    }
  }

  /** Re-open on a different input, without leaving the game. */
  const switchMic = async (): Promise<void> => {
    driver?.stop()
    driver = null
    setMicError(null)
    try {
      driver = createSingDriver(MIC_ID)
      await driver.start()
    } catch (err) {
      setMicError(micErrorLine(err))
      driver = null
    }
  }

  return (
    <div class="stage3d" classList={{ 'has-controls': started() }}>
      <canvas class="stage3d__canvas" ref={canvas} />

      <span class="stage3d__chip">{backend()}</span>

      <Show when={started()}>
        <TouchControls source={input} />
      </Show>

      <Show when={started() && phase() !== 'done'}>
        <VoiceCoach
          cfg={cfg}
          targetMidi={TARGET_MIDI}
          charge={charge()}
          ringing={ringing()}
          heardMidi={heardMidi()}
          waveRate={waveRate()}
          waveDepth={waveDepth()}
          wavering={wavering()}
          listening={phase() === 'sing'}
          line={phaseLine()}
          onChooseMic={() => void switchMic()}
        />
      </Show>

      <Show when={!started()}>
        <div class="stage3d__gate">
          <p>
            A pane stands between Merc and the rest of the hallway. Walk him up
            to it, then hold {targetName} until it rings and let the note waver.
          </p>
          <button type="button" onClick={() => void startMic()}>
            Walk with him
          </button>
          <Show when={micError() !== null}>
            <p class="stage3d__error">{micError()}</p>
            <MicInput listening={false} onChoose={() => void switchMic()} />
          </Show>
        </div>
      </Show>

      <Show when={phase() === 'done'}>
        <div class="stage3d__card">
          <span>{grade()}% in tune</span>
        </div>
      </Show>

      <button class="games-leave" type="button" onClick={() => props.onExit()}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
        Leave
      </button>
    </div>
  )
}
