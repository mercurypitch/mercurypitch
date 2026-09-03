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
import { currentRoom, isFinished, progressLabel, readTrack, recordClear, roomAfter, walkGrade, writeTrack, } from '../levels/chamber-track'
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
import { ChamberGuide, guideSeen } from './ChamberGuide'
import { ModeLadder } from './ModeLadder'
import { TouchControls } from './TouchControls'

const MIC_ID = 'glass3d-chamber'
const TEXT_INTERVAL = 0.1

/** The beat between the floor letting go and the room resetting: long
 * enough for the fall to read as a fall, short enough to be a shrug. */
const FALL_SECONDS = 1.6

/** Close enough to the exit to count as out. */
const ARRIVED = 0.02

/** How long the room he just finished is held before the next one
 * arrives. Long enough to register as an ending, short enough that it
 * is not a loading screen. */
const CLEARED_SECONDS = 1.4

/**
 * How far in front of a pane Merc is stopped, in metres.
 *
 * A pane is a WALL until it is broken -- the whole point of a chamber is
 * that the way through is a note, not a walk -- and it has to stop him
 * with the glass still in front of him rather than inside him. Merc is
 * about half a metre tall and reads as roughly as wide, so a fifth of a
 * metre puts him nose to the glass and leaves the pane fully visible
 * between him and the camera.
 */
const PANE_STANDOFF = 0.22

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

/**
 * `cleared` is the beat between rooms: the glass is gone, the exit is
 * reached, and the next room is being built behind a held frame. It is a
 * phase rather than a timer somewhere else because the pose, the HUD
 * line and the controls all have to agree about it.
 */
type Phase = 'walking' | 'falling' | 'cleared' | 'done'

interface ChamberStageProps {
  onExit: () => void
}

export const ChamberStage = (props: ChamberStageProps) => {
  let canvas!: HTMLCanvasElement
  // The walk, not one room of it. The stage owns the track because it is
  // the thing that knows a room has been finished, and because moving to
  // the next room WITHOUT REMOUNTING is the whole point: a remount takes
  // the renderer and the microphone with it, and a re-prompt between
  // rooms is the difference between a path and three games in a coat.
  const [track, setTrack] = createSignal(readTrack())
  const [room, setRoom] = createSignal<ChamberLevel>(currentRoom(readTrack()))
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
  // The raw input level, which is a DIFFERENT question from "was a note
  // recognised". A dead level means no audio is arriving at all -- wrong
  // device, muted interface, a permission granted to a microphone that
  // is not the one being sung into -- and no amount of singing better
  // will fix it. A moving level with no note is the opposite problem.
  const [level, setLevel] = createSignal(0)
  const [nearMode, setNearMode] = createSignal<number | null>(null)
  const [semisOff, setSemisOff] = createSignal(0)
  const [onIt, setOnIt] = createSignal(false)
  const [charges, setCharges] = createSignal<number[]>(
    room().modes.map(() => 0),
  )
  const [broken, setBroken] = createSignal(0)
  const [grade, setGrade] = createSignal<number | null>(null)
  // Shown once, on the first room anybody walks into, and reachable
  // afterwards from the HUD. A player who already knows what a node is
  // should not be made to page through four cards to prove it.
  const [guide, setGuide] = createSignal(!guideSeen())
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
  const fundamental = (): number => tuneChamber(room().modes, null, centre())

  /** Move the whole room by an octave, and remember it for the next one. */
  const nudgeOctave = (octaves: number): void => {
    setCentre(writeVoiceCentre(shiftOctaves(centre(), octaves)))
  }

  let driver: InteractionDriver | null = null
  let stopLoop: (() => void) | null = null
  const tone = createGlassTone(
    midiToFreq(modeMidi(fundamental(), room().modes[0] ?? 1)),
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
    const r = createChamber3D(canvas, cfg, room())
    const unbindKeys = bindKeyboard(input, window)

    const fit = (): void => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      r.resize(rect.width, rect.height, Math.min(window.devicePixelRatio, 1.5))
    }
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)

    const begin = (): void => {
      /** The room in front of him. `enterRoom` moves it on. */
      let live: ChamberLevel = room()

      interface Target {
        mode: number
        midi: number
        ring: ReturnType<typeof createResonance>
        broken: boolean
      }

      /**
       * One resonance per pane, aimed at the one mode that can shake it
       * apart. Which mode that is comes out of the geometry, not out of
       * a field somebody has to keep in sync with the level.
       */
      const buildTargets = (): Target[] =>
        live.panes.map((pane) => {
          const mode =
            live.modes.find(
              (m) => standingAmplitude(pane.at, m) >= live.breakAt,
            ) ?? live.modes[0]!
          const midi = modeMidi(fundamental(), mode)
          return { mode, midi, ring: createResonance(midi), broken: false }
        })

      let targets = buildTargets()

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

      let ground = groundIn(live)
      // The room's walls, recomputed as glass gives way.
      //
      // `maxX` is the nearest unbroken pane ahead of him, not the end of
      // the room: walking through the glass instead of breaking it makes
      // every puzzle in the chamber optional. Only panes AHEAD count, so
      // a pane he has already come through cannot reach back and clamp
      // him -- which cannot happen while they break in order, and is one
      // line to be certain of rather than an assumption to hold.
      const walls = { ...cfg.locomotion, minX: 0, maxX: live.length }
      const closeWalls = (): void => {
        let stop = live.length
        for (let i = 0; i < targets.length; i++) {
          if (targets[i]!.broken) continue
          const at = live.panes[i]!.at * live.length - PANE_STANDOFF
          if (at >= loco.x && at < stop) stop = at
        }
        walls.maxX = stop
      }
      const loco = createLocomotion(live.startAt * live.length)
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
      /** The accuracy of each break in THIS room. Reset per room; the
       * track keeps the best of the room grades it makes from them. */
      let grades: number[] = []
      /** Wall time the room was cleared at, for the beat before the
       * next one. */
      let clearedAtWall = 0
      let lastMidi: number | null = null
      let lastMode: number | null = null
      /** A mode held down from the dev hook, so the room can be walked
       * and looked at without a microphone. Never set outside DEV. */
      let forcedMode: number | null = null
      let lastOff = 0
      let lastOnIt = false
      let lastWaveStrength = 0
      let lastLevel = 0
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

      /**
       * Put a room in front of him and start it.
       *
       * Everything a room owns is rebuilt here -- the panes' resonances,
       * the floor sampler, the walls, where he stands. Everything that
       * is NOT a room is left alone: the renderer, Merc, the vibrato
       * detector, and above all the microphone, which is why this is a
       * function rather than a remount.
       */
      const enterRoom = (next: ChamberLevel): void => {
        live = next
        setRoom(next)
        r.load(next)
        targets = buildTargets()
        tunedRoom = fundamental()
        tunedTo = -1
        ground = groundIn(next)
        grades = []
        breaking = null
        loco.x = next.startAt * next.length
        loco.y = 0
        loco.vx = 0
        loco.vy = 0
        loco.grounded = true
        loco.facing = 1
        closeWalls()
        setBroken(0)
        setCharges(next.modes.map(() => 0))
        go('walking')
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
        loco.x = live.startAt * live.length
        loco.y = 0
        loco.vx = 0
        loco.vy = 0
        loco.grounded = true
        loco.facing = 1
        for (const t of targets) t.ring.res = 0
        closeWalls()
        go('walking')
      }

      /**
       * The room is finished. Record it, then either walk on or stop.
       *
       * The clear is written the moment it happens rather than at the
       * end of the track, because a player who puts the phone down
       * after room two has finished room two.
       */
      const clearRoom = (): void => {
        const grade =
          grades.length === 0
            ? 0
            : Math.round(
                (grades.reduce((a, b) => a + b, 0) / grades.length) * 100,
              )
        setGrade(grade)
        const next = recordClear(track(), live.id, grade)
        setTrack(next)
        writeTrack(next)
        clearedAtWall = wallSeconds
        go(roomAfter(live.id) === null ? 'done' : 'cleared')
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
            { x: 0, y: live.panes[index]!.height * 0.52, z: 0 },
            acc,
            cfg.shatter,
            11 + index,
          ),
        }
        breakAtWall = wallSeconds
        tone.shatter(acc)
        setBroken(targets.filter((t) => t.broken).length)
      }

      closeWalls()

      const view: ChamberView = {
        mercX: loco.x,
        mercY: 0,
        mercFacing: 1,
        mode: null,
        strength: 0,
        paneBroken: targets.map(() => false),
        breaking: null,
        resonance: 0,
        exitOpen: false,
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

          if (phaseNow === 'cleared') {
            // The beat between rooms. He is still standing in the room
            // he finished, and the next one arrives under him.
            if (wallSeconds - clearedAtWall >= CLEARED_SECONDS) {
              const next = roomAfter(live.id)
              if (next === null) go('done')
              else enterRoom(next)
            }
            return
          }
          if (phaseNow === 'done') return

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

          closeWalls()
          stepLocomotion(loco, input.read(now), ground, dt, walls)

          const pitch = driver?.latestPitch() ?? null
          const wave =
            pitch === null
              ? { active: false, strength: 0 }
              : vib.feed(pitch.tAudio * 1000, pitch.midi)
          lastMidi = pitch?.midi ?? null
          lastLevel = driver?.latestLevel() ?? 0
          lastWaveStrength = wave.active ? wave.strength : 0

          const near = nearestMode(lastMidi, tunedRoom, live.modes)
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
          const x01 = loco.x / live.length
          if (onGround && !isFloorSafe(x01, lastMode, live.floorThreshold)) {
            drop()
            return
          }

          // The way out is the far end, and every pane has to be gone
          // for it to count -- the exit is not a shortcut past the
          // puzzle, it is what the puzzle opens.
          if (
            loco.x >= live.exitAt * live.length - ARRIVED &&
            targets.every((t) => t.broken)
          ) {
            clearRoom()
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
          setLevel(lastLevel)
          setNearMode(
            lastMidi === null
              ? null
              : nearestMode(lastMidi, tunedRoom, live.modes).mode,
          )
          setSemisOff(lastOff)
          setOnIt(lastOnIt)
          setCharges(
            live.modes.map((mode) =>
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
        view.exitOpen = targets.every((t) => t.broken)
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
            // Clamped by the glass, like walking is. A debug hook that
            // can put him on the far side of a pane that is still up
            // would be a hook that tests a room nobody can play.
            closeWalls()
            loco.x = Math.max(walls.minX, Math.min(walls.maxX, x))
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
            modes={room().modes}
            fundamentalMidi={fundamental()}
            nearest={nearMode()}
            semisOff={semisOff()}
            onIt={onIt()}
            charge={charges()}
          />
        </Show>

        <div class="chamber-hud">
          <p class="chamber-hud__line">
            <Show
              when={phase() === 'falling' || phase() === 'cleared'}
              fallback={
                // Once the glass is gone the room has nothing left to
                // teach and one thing left to say.
                broken() === room().panes.length
                  ? 'The way out is lit.'
                  : room().teaches
              }
            >
              <Show
                when={phase() === 'cleared'}
                fallback="The floor was moving there."
              >
                Through. On to the next room.
              </Show>
            </Show>
          </p>
          <p class="chamber-hud__where">{progressLabel(track())}</p>
          <p class="chamber-hud__count">
            <Show
              when={heardMidi() !== null}
              fallback={
                <span class="chamber-hud__quiet">
                  {level() > 0.005
                    ? 'no note yet'
                    : 'no sound reaching the mic'}
                </span>
              }
            >
              {heardName()}
            </Show>
            <i
              class="chamber-hud__level"
              style={{ width: `${Math.min(1, level() * 6) * 2.5}rem` }}
            />
            {' · '}
            {broken()} of {room().panes.length} broken
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
            <button
              type="button"
              aria-label="How a chamber works"
              onClick={() => setGuide(true)}
            >
              ?
            </button>
          </div>
        </div>

        <TouchControls source={input} />
      </Show>

      <Show when={guide()}>
        <ChamberGuide onClose={() => setGuide(false)} />
      </Show>

      <Show when={!started() && !guide()}>
        <div class="stage3d__gate">
          <p>{room().teaches}</p>
          <button type="button" onClick={() => void startMic()}>
            Walk in
          </button>
          {/* For anyone who skipped it, or who has met a chamber before
              and wants reminding. The gate no longer explains the
              mechanic itself: the guide does that, and saying it twice
              made the first screen of a game a wall of text. */}
          <button
            class="stage3d__gate-link"
            type="button"
            onClick={() => setGuide(true)}
          >
            How a chamber works
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
          <Show
            when={isFinished(track())}
            fallback={<span>{grade()}% in tune</span>}
          >
            <span>Every room walked</span>
            <span class="stage3d__card-note">
              {walkGrade(track()) ?? 0}% in tune across {progressLabel(track())}
            </span>
          </Show>
          <button type="button" onClick={() => props.onExit()}>
            Done
          </button>
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
