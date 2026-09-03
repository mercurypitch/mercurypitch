// A chamber, played.
// ============================================================
//
// Slice 2's room. Merc walks it, the voice shapes it, and where he can
// stand depends on what he is singing -- which is the first mechanic in
// this game that is about SPACE, and the reason any of it is in 3D.
//
// The component owns what every stage here owns: the canvas, the mic
// lifecycle, and the HUD signals. What is new is one rule, and it is
// worth stating plainly because everything else follows from it:
//
//   THE ROOM IS TUNED TO THE PLAYER, NOT THE PLAYER TO THE ROOM.
//
// The theory fixes the RATIOS between modes and says nothing at all
// about absolute pitch, so the fundamental is derived from the range the
// RangeFinder measured. Nobody is asked to reach.
//
// Each pane gets its own resonance, targeted at the one mode that can
// break it, and every unbroken pane is stepped with the same voice --
// so the pane you are singing at charges and the others decay, with no
// state machine deciding which one you meant. The panes ARE the state
// machine.

import { applyPreferredInput } from '@irchiinnuss/audio-io'
import { MicInput } from '@irchiinnuss/audio-io/solid'
import { midiToFreq, midiToNote } from '@irchiinnuss/pitch-engine'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { createSingDriver } from '@/games/glass/drivers/sing'
import type { InteractionDriver } from '@/games/glass/drivers/types'
import { micErrorLine } from '@/games/glass/mic-error'
import { createVibratoDetector } from '@/games/glass/vibrato'
import { micApiBlocker } from '@/platform/device-support'
import { createGlassTone } from '../audio/glass-tone'
import { bindKeyboard, createIntentSource } from '../input/pad-intent'
import type { ChamberLevel } from '../levels/chambers'
import { createLoopState, runLoop } from '../runtime/loop'
import { groundIn, isExciting, isFloorSafe, modeMidi, nearestMode, standingAmplitude, tuneChamber, } from '../sim/chamber3d'
import { createLocomotion, stepLocomotion } from '../sim/locomotion3d'
import { accuracy, createResonance, stepResonance } from '../sim/resonance3d'
import type { ShardLaunch } from '../sim/shatter3d'
import { solveShatter } from '../sim/shatter3d'
import { canShift, shiftOctaves, voiceCentre, writeVoiceCentre, } from '../voice-range'
import { CHAMBER_CONFIG } from '../world3d-config'
import type { ChamberView } from './Chamber3D'
import { createChamber3D } from './Chamber3D'
import { ModeLadder } from './ModeLadder'
import { TouchControls } from './TouchControls'

const MIC_ID = 'glass3d-chamber'
const TEXT_INTERVAL = 0.1

/** The beat between the floor letting go and the room resetting: long
 * enough for the fall to read as a fall, short enough to be a shrug. */
const FALL_SECONDS = 1.6

/** Close enough to the exit to count as out. */
const ARRIVED = 0.02

/** How long after a break before the glass may ring again. Past the crack
 * and the body, into the thin end of the shard tail -- long enough that
 * the next pane is not answering over the last one's wreckage, short
 * enough that a player who moves straight on is not met with silence. */
const REARM_SECONDS = 2.2

const LADDER_KEY = 'beside-cue:games:chamber-ladder'
const PATTERN_KEY = 'beside-cue:games:chamber-pattern'
/** Both default ON. A player who wants the harder version can find the
 * toggle; a player who cannot see why they fell will never find
 * anything (§5). */
const readToggle = (key: string): boolean => {
  try {
    return window.localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}
const writeToggle = (key: string, on: boolean): void => {
  try {
    window.localStorage.setItem(key, on ? 'on' : 'off')
  } catch {
    // the preference just lives for the session when storage is denied
  }
}

type Phase = 'walking' | 'falling' | 'done'

interface ChamberStageProps {
  chamber: ChamberLevel
  onExit: () => void
}

export const ChamberStage = (props: ChamberStageProps) => {
  let canvas!: HTMLCanvasElement
  // Read once, on purpose. The room is fixed for the life of this
  // component -- GamesScreen mounts it with a `keyed` Show, so choosing
  // a different chamber tears this one down and builds a new one -- and
  // half of what is set up below (the fundamental, one resonance per
  // pane, the renderer's geometry) is derived from it at mount and
  // could not follow a change anyway.
  // eslint-disable-next-line solid/reactivity
  const chamber = props.chamber
  const cfg = CHAMBER_CONFIG

  // A page with no microphone API says so before the tap rather than
  // after it: there is nothing to grant and nothing to retry, and the
  // fix is in the address bar (see platform/device-support).
  const noMicApi = micApiBlocker()
  const [micError, setMicError] = createSignal<string | null>(noMicApi)
  const [started, setStarted] = createSignal(false)
  const [backend, setBackend] = createSignal('…')
  const [phase, setPhase] = createSignal<Phase>('walking')
  // What the microphone is actually hearing, kept separately from what the
  // room makes of it. Without this a dead microphone and a wrong note look
  // exactly the same -- an unlit ladder -- which is how "the audio is not
  // coming through" and "I am singing the wrong note" became the same bug
  // report.
  const [heardMidi, setHeardMidi] = createSignal<number | null>(null)
  const [nearMode, setNearMode] = createSignal<number | null>(null)
  const [semisOff, setSemisOff] = createSignal(0)
  const [onIt, setOnIt] = createSignal(false)
  const [charges, setCharges] = createSignal<number[]>(
    chamber.modes.map(() => 0),
  )
  const [broken, setBroken] = createSignal(0)
  const [grade, setGrade] = createSignal<number | null>(null)
  const [showLadder, setShowLadder] = createSignal(readToggle(LADDER_KEY))
  const [showPattern, setShowPattern] = createSignal(readToggle(PATTERN_KEY))

  // The room, transposed onto this player's voice.
  //
  // A chamber is built out of RATIOS, so which absolute pitch it sits on
  // is free -- moving it does not change one node, one belly, or one
  // answer. That is why this is a control and not a difficulty setting:
  // a room outside your range is not a hard room, it is a room you
  // cannot play (see voice-range.ts).
  const [centre, setCentre] = createSignal(voiceCentre())
  const fundamental = (): number => tuneChamber(chamber.modes, null, centre())

  /** Move the whole room by an octave, and remember it for the next one. */
  const nudgeOctave = (octaves: number): void => {
    setCentre(writeVoiceCentre(shiftOctaves(centre(), octaves)))
  }

  let driver: InteractionDriver | null = null
  let stopLoop: (() => void) | null = null
  const tone = createGlassTone(
    midiToFreq(modeMidi(fundamental(), chamber.modes[0] ?? 1)),
  )
  const input = createIntentSource()

  /** The note being sung, named. Rounded to the nearest semitone, which
   * is what a name IS -- how far off it that note is belongs to the
   * ladder, where the rung it belongs to is already lit. */
  const heardName = (): string => {
    const midi = heardMidi()
    if (midi === null) return ''
    const note = midiToNote(Math.round(midi))
    return `${note.name}${note.octave}`
  }

  const toggleLadder = (): void => {
    const next = !showLadder()
    setShowLadder(next)
    writeToggle(LADDER_KEY, next)
  }
  const togglePattern = (): void => {
    const next = !showPattern()
    setShowPattern(next)
    writeToggle(PATTERN_KEY, next)
  }

  onMount(() => {
    const r = createChamber3D(canvas, cfg, chamber)
    const unbindKeys = bindKeyboard(input, window)

    const fit = (): void => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      r.resize(rect.width, rect.height, Math.min(window.devicePixelRatio, 1.5))
    }
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)

    const begin = (): void => {
      // One resonance per pane, aimed at the one mode that can shake it
      // apart. Which mode that is comes out of the geometry, not out of
      // a field somebody has to keep in sync with the level.
      const targets = chamber.panes.map((pane) => {
        const mode =
          chamber.modes.find(
            (m) => standingAmplitude(pane.at, m) >= chamber.breakAt,
          ) ?? chamber.modes[0]!
        const midi = modeMidi(fundamental(), mode)
        return { mode, midi, ring: createResonance(midi), broken: false }
      })

      /** The fundamental the rings are currently listening for. */
      let tunedRoom = fundamental()

      /**
       * Move the room to a new fundamental, mid-play.
       *
       * The rings hold their target note inside them, so an octave
       * button has to rebuild them -- and it drops whatever charge was
       * on them, which is right: that charge was earned on a different
       * note, and carrying it over would break a pane for a note nobody
       * sang. Broken panes stay broken.
       */
      const retuneRoom = (): void => {
        const f0 = fundamental()
        tunedRoom = f0
        for (const target of targets) {
          target.midi = modeMidi(f0, target.mode)
          target.ring = createResonance(target.midi)
        }
        tunedTo = -1
      }

      const ground = groundIn(chamber)
      const walls = { ...cfg.locomotion, minX: 0, maxX: chamber.length }
      const loco = createLocomotion(chamber.startAt * chamber.length)
      const vib = createVibratoDetector(cfg.vibrato)

      let phaseNow: Phase = 'walking'
      let fallUntil = 0
      let elapsed = 0
      let wallSeconds = 0
      let breakAtWall = 0
      let breaking: {
        pane: number
        launches: readonly ShardLaunch[]
      } | null = null
      const grades: number[] = []
      let lastMidi: number | null = null
      let lastMode: number | null = null
      /** A mode held down from the dev hook, so the room can be walked
       * and looked at without a microphone. Never set outside DEV. */
      let forcedMode: number | null = null
      let lastOff = 0
      let lastOnIt = false
      let lastWaveStrength = 0
      /** Which pane the ring is currently tuned to. */
      let tunedTo = -1
      let sinceText = TEXT_INTERVAL

      const go = (p: Phase): void => {
        phaseNow = p
        setPhase(p)
      }

      let pose = ''
      const setPose = (name: string, loop = true): void => {
        if (pose === name) return
        pose = name
        r.merc()?.play(name, { loop })
      }
      const poseNow = (): void => {
        if (phaseNow === 'falling') setPose('fall', false)
        else if (!loco.grounded || Math.abs(loco.vx) > 0.06) setPose('move')
        else if (lastOnIt) setPose('sing')
        else setPose('listen')
      }

      /** The floor gave way. The clip that has been rigged and exported
       * and never once played since slice 0 finally has a caller. */
      const drop = (): void => {
        input.release()
        loco.vx = 0
        loco.vy = 0
        fallUntil = elapsed + FALL_SECONDS
        go('falling')
      }

      /** Back to the start, with the room remembering what was already
       * solved. Losing three panes to one misstep is a punishment for
       * learning, and this game does not do those. */
      const restart = (): void => {
        loco.x = chamber.startAt * chamber.length
        loco.y = 0
        loco.vx = 0
        loco.vy = 0
        loco.grounded = true
        loco.facing = 1
        for (const t of targets) t.ring.res = 0
        go('walking')
      }

      const breakPane = (index: number): void => {
        const target = targets[index]!
        target.broken = true
        const acc = accuracy(target.ring, cfg.ring)
        grades.push(acc)
        breaking = {
          pane: index,
          launches: solveShatter(
            r.centroids(),
            { x: 0, y: chamber.panes[index]!.height * 0.52, z: 0 },
            acc,
            cfg.shatter,
            11 + index,
          ),
        }
        breakAtWall = wallSeconds
        tone.shatter(acc)
        setBroken(targets.filter((t) => t.broken).length)
      }

      const view: ChamberView = {
        mercX: loco.x,
        mercY: 0,
        mercFacing: 1,
        mode: null,
        strength: 0,
        paneBroken: targets.map(() => false),
        breaking: null,
        resonance: 0,
      }

      const loopState = createLoopState()
      let last = performance.now()
      let frame = 0

      const tick = (now: number): void => {
        const frameSeconds = (now - last) / 1000
        last = now
        wallSeconds += frameSeconds

        // An octave button was pressed since the last frame.
        if (fundamental() !== tunedRoom) retuneRoom()

        runLoop(loopState, frameSeconds, cfg.loop, (dt) => {
          elapsed += dt

          if (phaseNow === 'falling') {
            // He TOPPLES; he does not plummet. The `fall` clip is
            // anticipation, topple, impact and settle -- an animation of
            // going over, played where he stood. Dropping him through
            // the floor instead would throw the one asset this moment
            // exists to show off out of frame, and read as him being
            // deleted rather than as him having got it wrong.
            if (elapsed >= fallUntil) restart()
            return
          }

          stepLocomotion(loco, input.read(now), ground, dt, walls)

          const pitch = driver?.latestPitch() ?? null
          const wave =
            pitch === null
              ? { active: false, strength: 0 }
              : vib.feed(pitch.tAudio * 1000, pitch.midi)
          lastMidi = pitch?.midi ?? null
          lastWaveStrength = wave.active ? wave.strength : 0

          const near = nearestMode(lastMidi, tunedRoom, chamber.modes)
          lastOff = near.semisOff
          lastOnIt =
            near.mode !== null && isExciting(near.semisOff, cfg.ring.tolSemis)
          // A mode only SHAPES the room when it is actually being
          // excited. Humming vaguely near a note must not move the
          // floor, or the room reads as punishing warm-ups.
          lastMode = lastOnIt ? near.mode : null
          if (forcedMode !== null) lastMode = forcedMode

          for (let i = 0; i < targets.length; i++) {
            const target = targets[i]!
            if (target.broken) continue
            const broke = stepResonance(
              target.ring,
              {
                midi: lastMidi,
                vibrato: wave.active,
                vibratoStrength: wave.strength,
              },
              dt,
              cfg.ring,
            )
            if (broke) breakPane(i)
          }

          // The floor. A ledge does not shake -- it is solid, not the
          // resonating floor -- so only the ground itself can drop him.
          const onGround = loco.grounded && loco.y <= 0.001
          const x01 = loco.x / chamber.length
          if (onGround && !isFloorSafe(x01, lastMode, chamber.floorThreshold)) {
            drop()
            return
          }

          if (loco.x >= chamber.exitAt * chamber.length - ARRIVED) {
            if (targets.every((t) => t.broken)) {
              setGrade(
                Math.round(
                  (grades.reduce((a, b) => a + b, 0) /
                    Math.max(1, grades.length)) *
                    100,
                ),
              )
              go('done')
            }
          }
        })

        const charge = Math.max(
          ...targets.map((t) => (t.broken ? 0 : t.ring.res)),
          0,
        )

        // The ring follows whichever pane is furthest along, and points
        // at THAT pane's note. One tone serving several panes would
        // otherwise answer the second one in the first one's key.
        let active = -1
        let bestRes = -1
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i]!
          if (t.broken || t.ring.res <= bestRes) continue
          bestRes = t.ring.res
          active = i
        }
        if (active >= 0 && active !== tunedTo) {
          tunedTo = active
          tone.retune(midiToFreq(targets[active]!.midi))
        }
        // `shatter` silences the ring for good, which is right for a room
        // with one pane in it. This room has more glass.
        if (
          breaking !== null &&
          wallSeconds - breakAtWall > REARM_SECONDS &&
          active >= 0
        ) {
          tone.rearm()
        }

        tone.update(charge, lastWaveStrength)
        sinceText += frameSeconds
        if (sinceText >= TEXT_INTERVAL) {
          sinceText = 0
          // The rung the voice is nearest, in tune or not -- a player a
          // whole tone flat is trying to sing that mode, and the ladder
          // saying "nothing" instead of "flat" is a shrug where a hint
          // belongs. Silence, and only silence, lights nothing.
          setHeardMidi(lastMidi)
          setNearMode(
            lastMidi === null
              ? null
              : nearestMode(lastMidi, tunedRoom, chamber.modes).mode,
          )
          setSemisOff(lastOff)
          setOnIt(lastOnIt)
          setCharges(
            chamber.modes.map((mode) =>
              Math.max(
                0,
                ...targets
                  .filter((t) => t.mode === mode && !t.broken)
                  .map((t) => t.ring.res),
              ),
            ),
          )
        }

        poseNow()
        view.mercX = loco.x
        view.mercY = loco.y
        view.mercFacing = loco.facing
        view.mode = showPattern() ? lastMode : null
        view.strength = lastMode === null ? 0 : 1
        view.paneBroken = targets.map((t) => t.broken)
        view.resonance = charge
        view.breaking =
          breaking === null
            ? null
            : {
                pane: breaking.pane,
                seconds: wallSeconds - breakAtWall,
                launches: breaking.launches,
              }

        r.render(view, frameSeconds)
        frame = requestAnimationFrame(tick)
      }

      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__w3c = () => ({
          phase: phaseNow,
          x: loco.x,
          y: loco.y,
          grounded: loco.grounded,
          mode: lastMode,
          fundamental: fundamental(),
          broken: targets.map((t) => t.broken),
          charges: targets.map((t) => t.ring.res),
          move: (m: number) => input.setMove(m),
          jump: () => input.pulseJump(performance.now()),
          warpTo: (x: number) => {
            loco.x = Math.max(0, Math.min(chamber.length, x))
          },
          break: (i = 0) => {
            if (targets[i] !== undefined && !targets[i]!.broken) breakPane(i)
          },
          sing: (mode: number | null) => {
            forcedMode = mode
          },
        })
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
      delete (window as unknown as Record<string, unknown>).__w3c
    })
  })

  const startMic = async (): Promise<void> => {
    setMicError(null)
    tone.start()
    try {
      await applyPreferredInput()
      driver = createSingDriver(MIC_ID)
      await driver.start()
      setStarted(true)
    } catch (err) {
      setMicError(micErrorLine(err))
      driver = null
    }
  }

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

      <Show when={started() && phase() !== 'done'}>
        <Show when={showLadder()}>
          <ModeLadder
            modes={chamber.modes}
            fundamentalMidi={fundamental()}
            nearest={nearMode()}
            semisOff={semisOff()}
            onIt={onIt()}
            charge={charges()}
          />
        </Show>

        <div class="chamber-hud">
          <p class="chamber-hud__line">
            <Show when={phase() === 'falling'} fallback={chamber.teaches}>
              The floor was moving there.
            </Show>
          </p>
          <p class="chamber-hud__count">
            <Show
              when={heardMidi() !== null}
              fallback={<span class="chamber-hud__quiet">nothing heard</span>}
            >
              {heardName()}
            </Show>
            {' · '}
            {broken()} of {chamber.panes.length} broken
          </p>
          <div class="chamber-hud__toggles">
            {/* The room moves to the voice, never the other way round.
                An octave is the size of the gap between voice types, so
                it is the step -- and because a chamber is built out of
                ratios, moving it changes nothing about the puzzle. */}
            <button
              type="button"
              class="chamber-hud__octave"
              aria-label="Sing this room an octave lower"
              disabled={!canShift(centre(), -1)}
              onClick={() => nudgeOctave(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v13m0 0-6-6m6 6 6-6" />
              </svg>
              8ve
            </button>
            <button
              type="button"
              class="chamber-hud__octave"
              aria-label="Sing this room an octave higher"
              disabled={!canShift(centre(), 1)}
              onClick={() => nudgeOctave(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 19V6m0 0-6 6m6-6 6 6" />
              </svg>
              8ve
            </button>
            <button
              type="button"
              aria-pressed={showLadder()}
              onClick={toggleLadder}
            >
              Notes
            </button>
            <button
              type="button"
              aria-pressed={showPattern()}
              onClick={togglePattern}
            >
              Pattern
            </button>
          </div>
        </div>

        <TouchControls source={input} />
      </Show>

      <Show when={!started()}>
        <div class="stage3d__gate">
          <p>{chamber.teaches}</p>
          <p>
            Walk him along the room. The glass breaks where the air moves
            hardest, and the floor is only still where it does not.
          </p>
          <button type="button" onClick={() => void startMic()}>
            Walk in
          </button>
          <Show when={micError() !== null}>
            <p class="stage3d__error">{micError()}</p>
            {/* A picker is no use when the browser is withholding the
                whole microphone API -- there is nothing to pick from. */}
            <Show when={noMicApi === null}>
              <MicInput listening={false} onChoose={() => void switchMic()} />
            </Show>
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
