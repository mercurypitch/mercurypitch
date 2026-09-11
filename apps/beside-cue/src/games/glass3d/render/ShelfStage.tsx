// The Top Shelf, played.
// ============================================================
//
// Slice 6's room (docs/games/top-shelf.md). Hum a note, hum a higher
// one, and Merc leaps exactly that much higher. The room is a staircase
// and the voice is the only way up it: the jump button is hidden (D7),
// and walking alone never climbs.
//
// A fork of LineStage, not a lift: the canvas, the mic lifecycle, the
// loop, the gate card and the end card are the Line's shape, carrying
// its fixes -- the camera placed on load, the jump buffer cleared across
// a handover, the grounded-checked exit, `begin()` after unmount, the
// mic-switch double driver. What is new is one rule, in
// `sim/shelf-voice`: a stop above the last one is a leap that high.
//
//   THERE IS NO TARGET PITCH HERE EITHER. A leap is an interval, so two
//   voices with nothing in common climb the same room on different
//   notes, and each leap is sung from wherever the last note was held.

import { applyPreferredInput } from '@irchiinnuss/audio-io'
import { MicInput } from '@irchiinnuss/audio-io/solid'
import { createSignal, For, lazy, onCleanup, onMount, Show } from 'solid-js'
import { createSingDriver } from '@/games/glass/drivers/sing'
import type { InteractionDriver } from '@/games/glass/drivers/types'
import { micErrorLine } from '@/games/glass/mic-error'
import { micApiBlocker } from '@/platform/device-support'
import type { DevAction } from '../dev/DevDials'
import { bindKeyboard, createIntentSource } from '../input/pad-intent'
import type { ShelfLevel } from '../levels/shelf'
import { CATCH, groundFor, leapCarry, MAX_LEAP, MITT_SPAN, RISE_PER_SEMI, riserWallAt, topsOf, } from '../levels/shelf'
import { keepBest, readStats, writeStats } from '../levels/shelf-stats'
import { shelfTrack } from '../levels/shelf-track'
import { createLoopState, runLoop } from '../runtime/loop'
import { medalFor } from '../sim/line-grade'
import { createLocomotion, leapVelocity, stepLocomotion, } from '../sim/locomotion3d'
import type { ShelfGrade, ShelfStats } from '../sim/shelf-grade'
import { NO_LEAPS, roomLine, statsOf, walkLine, withLeap, } from '../sim/shelf-grade'
import { emptyVoice, intervalLabel, voiceStep } from '../sim/shelf-voice'
import { CHAMBER_CONFIG } from '../world3d-config'
import { ShapeGauge } from './ShapeGauge'
import type { ShelfView } from './Shelf3D'
import { createShelf3D } from './Shelf3D'
import { TouchControls } from './TouchControls'

const MIC_ID = 'glass3d-shelf'
const TEXT_INTERVAL = 0.1
/** How close to the exit counts as reaching it, in metres. */
const ARRIVED = 0.02
/** The beat between rooms. */
const CLEARED_SECONDS = 1.4
/** Half of him, mitt to mitt: what the walls and the floor read (6a). */
const HALF = MITT_SPAN / 2
/** How fast he crouches into readiness and out of it, per second. */
const CROUCH_RATE = 12
/** A silence this long lets the crouch go. Shorter than a breath would
 * flicker him on every consonant; longer reads as not listening. */
const CROUCH_BREATH = 0.25
const GAUGE_KEY = 'beside-cue:games:shelf-gauge'
/** The interval gauge's glass, in semitones: his spring, the most any
 * one leap is (§6, D2). */
const SPRING_SEMIS = Math.round(MAX_LEAP / RISE_PER_SEMI)
/** The catch in semitones: how far under an ask still lands. */
const CATCH_SEMIS = CATCH / RISE_PER_SEMI

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

/** The rooms, in the order they teach (§4), on their own track. */
const ROOMS = shelfTrack.rooms

type Phase = 'climbing' | 'cleared' | 'done'

/** A leap in the air: what was sung, at which riser, and whether his
 * mitt has reached that riser -- which is what aims it there, for the
 * grade (§7) -- and whether its apex has flashed (§6). */
interface Flight {
  interval: number
  riser: number
  reached: boolean
  flashed: boolean
  /** How fast it carries him while he rises, when it was fired in reach
   * of that riser (`leapCarry`, §3.2); null for a hop at walking pace. */
  carry: number | null
}

const DevDials = import.meta.env.DEV
  ? lazy(async () => ({ default: (await import('../dev/DevDials')).DevDials }))
  : null

interface ShelfStageProps {
  onExit: () => void
}

/** The app's medal, at the Line's thresholds, with nothing gated on it
 * (§7). Renders nothing below bronze: the units are the grade then. */
const Medal = (props: { pct: number }) => (
  <Show when={medalFor(props.pct)}>
    {(medal) => <i class={`line-medal line-medal--${medal()}`}>{medal()}</i>}
  </Show>
)

export const ShelfStage = (props: ShelfStageProps) => {
  let canvas!: HTMLCanvasElement
  // Only locomotion and the loop are read from it, as in the Line; its
  // locomotion is WORLD3D_CONFIG's, the body `levels/shelf` is tested on.
  const cfg = CHAMBER_CONFIG
  const input = createIntentSource()
  const noMicApi = micApiBlocker()

  const [track, setTrack] = createSignal(shelfTrack.readTrack())
  const [room, setRoom] = createSignal<ShelfLevel>(
    shelfTrack.currentRoom(shelfTrack.readTrack()),
  )
  const [micError, setMicError] = createSignal<string | null>(noMicApi)
  const [started, setStarted] = createSignal(false)
  const [backend, setBackend] = createSignal('…')
  const [phase, setPhase] = createSignal<Phase>(
    shelfTrack.isFinished(shelfTrack.readTrack()) ? 'done' : 'climbing',
  )
  const [ready, setReady] = createSignal(false)
  const [heard, setHeard] = createSignal(false)
  const [level, setLevel] = createSignal(0)
  /** Semitones above the reference the voice is now, or null. */
  const [above, setAbove] = createSignal<number | null>(null)
  const [standing, setStanding] = createSignal(0)
  /** Every room's best run, in §7's units, for the walk card. */
  const [stats, setStats] = createSignal(readStats())
  /** The run just finished, for the room card. */
  const [lastRun, setLastRun] = createSignal<ShelfStats | null>(null)
  /** The next shelf's rise, in semitones, or null on the top shelf. */
  const [ask, setAsk] = createSignal<number | null>(null)
  const [showGauge, setShowGauge] = createSignal(readToggle(GAUGE_KEY))
  const [dials, setDials] = createSignal(false)

  const toggleGauge = (): void => {
    const on = !showGauge()
    setShowGauge(on)
    writeToggle(GAUGE_KEY, on)
  }

  let driver: InteractionDriver | null = null
  let stopLoop: (() => void) | null = null
  let goToRoom: ((next: ShelfLevel) => void) | null = null
  let devActions: readonly DevAction[] = []
  let replaying = false

  const replayRoom = (next: ShelfLevel): void => {
    replaying = true
    goToRoom?.(next)
  }

  onMount(() => {
    const r = createShelf3D(canvas, cfg, room())
    const unbindKeys = bindKeyboard(input, window)

    const fit = (): void => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      r.resize(rect.width, rect.height, Math.min(window.devicePixelRatio, 1.5))
    }
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)

    let gone = false

    const begin = (): void => {
      if (gone) return
      let live: ShelfLevel = room()
      let tops = topsOf(live)
      let ground = groundFor(live, HALF)

      const walls = {
        ...cfg.locomotion,
        minX: HALF,
        maxX: live.length - HALF,
      }
      const loco = createLocomotion(live.startX)
      /** The nearest riser his mitts cannot catch is the wall, and the
       * room's far end past the last one. Never behind him
       * (`riserWallAt`). */
      const closeWalls = (): void => {
        walls.maxX = Math.min(
          live.length - HALF,
          riserWallAt(live, loco.x, loco.y, HALF),
        )
      }

      let voice = emptyVoice()
      /** A note held from the dev hook, so a room can be climbed without
       * a microphone. Never set outside DEV. */
      let forcedMidi: number | null = null
      let phaseNow: Phase = 'climbing'
      /** The shelf he last stood on: 0 is the floor. */
      let standingOn = 0
      /** Airborne from a leap, and carried toward the next shelf (§3.2):
       * at the leap's own speed while an aimed one rises, else at walking
       * pace. A step off a low edge is not carried. */
      let carrying = false
      /** Where the carry goes on to after a leap lands him on a higher
       * shelf: all of him past its lip. The catch takes him by the mitts
       * with most of him still over the drop, and left there he reads as
       * perched on the edge; "he is on" (§3.4) is a step onto it. */
      let boardTo: number | null = null
      /** The last stop only moved the reference, on the ground: he is
       * crouched, readying, while the note that did it is held. */
      let readying = false
      let crouch = 0
      let silentFor = 0
      /** Leaps launched this room, and the highest the last one got him,
       * for the dev hook: what a test checks a stop did. */
      let leaps = 0
      let apex = 0
      /** The leap in the air, or null on the ground. */
      let flight: Flight | null = null
      /** What each riser's leaps came to: riser k's at k - 1 (§7). */
      let grades: ShelfGrade[] = live.shelves.slice(1).map(() => NO_LEAPS)
      let wallSeconds = 0
      let clearedAtWall = 0
      let lastHeard = false
      let lastLevel = 0
      let lastMidi: number | null = null
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
        if (!loco.grounded || Math.abs(loco.vx) > 0.06) setPose('move')
        else if (lastHeard) setPose('sing')
        else setPose('listen')
      }

      /** Which shelf a height is the top of. Exact: the floor under him
       * is always one of these very numbers (`groundFor`). */
      const shelfAt = (y: number): number => {
        const i = tops.findIndex((t) => Math.abs(t - y) < 1e-6)
        return i < 0 ? standingOn : i
      }

      /** The top of the shelf under his centre, for the pool of light:
       * the one he is over, or below it while he is under its lip. */
      const surfaceUnder = (x: number, y: number): number => {
        let i = live.shelves.length - 1
        while (i > 0 && live.shelves[i]!.from > x) i--
        while (i > 0 && tops[i]! > y + 1e-6) i--
        return tops[i]!
      }

      const resetBody = (): void => {
        loco.x = live.startX
        loco.y = 0
        loco.vx = 0
        loco.vy = 0
        loco.grounded = true
        loco.facing = 1
        // The jump buffer only decays inside `stepLocomotion`, which the
        // 'cleared' branch skips; nothing here presses jump, but a key
        // held across the handover must not bank one either.
        loco.bufferLeft = 0
        loco.jumpWasDown = false
        standingOn = 0
        carrying = false
        boardTo = null
        readying = false
        crouch = 0
        leaps = 0
        apex = 0
        flight = null
      }

      const enterRoom = (next: ShelfLevel): void => {
        live = next
        setRoom(next)
        tops = topsOf(next)
        ground = groundFor(next, HALF)
        r.load(next)
        resetBody()
        grades = next.shelves.slice(1).map(() => NO_LEAPS)
        // A new room starts from no reference: a note held across the
        // handover settles as the first stop and readies him.
        voice = emptyVoice()
        closeWalls()
        setStanding(0)
        go('climbing')
      }
      goToRoom = enterRoom

      const launch = (leap: { height: number; interval: number }): void => {
        // The loop's own step, so the stepped apex is the height the
        // interval asked for to a twentieth of a millimetre (6a).
        loco.vy = leapVelocity(
          leap.height,
          cfg.locomotion,
          cfg.loop.stepSeconds,
        )
        // Aimed, in reach of the riser ahead: carried at the speed that
        // brings his front to it at the apex, so where he stood never
        // decides whether it lands (§3.2). Further out, a hop.
        const carry = leapCarry(
          live,
          loco.x,
          loco.y,
          leap.height,
          cfg.locomotion.gravity,
          HALF,
        )
        if (carry !== null) loco.vx = carry
        loco.grounded = false
        carrying = true
        boardTo = null
        readying = false
        leaps += 1
        apex = loco.y
        flight = {
          interval: leap.interval,
          riser: standingOn + 1,
          reached: false,
          flashed: false,
          carry,
        }
      }

      /** A leap has come down, on shelf `on`. It was aimed at its riser
       * if it reached it or landed past it, and then it is graded (§7);
       * a hop in the open, short of any riser, is aimed at nothing. */
      const grade = (f: Flight, on: number): void => {
        const target = live.shelves[f.riser]
        if (target === undefined) return
        const up = on >= f.riser
        if (!up && !f.reached) return
        const i = f.riser - 1
        grades[i] = withLeap(grades[i]!, f.interval, target.rise, up)
      }

      /** The room is climbed. Written the moment it happens, the Line's
       * way: a player who puts the phone down after room one has climbed
       * room one. The grade is §7's, kept per room for the best run. */
      const clearRoom = (): void => {
        const run = statsOf(grades)
        setLastRun(run)
        const next = shelfTrack.recordClear(track(), live.id, run.pct)
        setTrack(next)
        shelfTrack.writeTrack(next)
        const kept = keepBest(stats(), live.id, run)
        setStats(kept)
        writeStats(kept)
        clearedAtWall = wallSeconds
        if (replaying) {
          replaying = false
          go('done')
          return
        }
        go(shelfTrack.roomAfter(live.id) === null ? 'done' : 'cleared')
      }

      closeWalls()

      const view: ShelfView = {
        mercX: loco.x,
        mercY: 0,
        mercFacing: 1,
        shelfY: 0,
        surfaceY: 0,
        crouch: 0,
        exitOpen: false,
      }

      const loopState = createLoopState()
      let last = performance.now()
      let frame = 0

      const tick = (now: number): void => {
        const frameSeconds = (now - last) / 1000
        last = now
        wallSeconds += frameSeconds

        runLoop(loopState, frameSeconds, cfg.loop, (dt) => {
          if (phaseNow === 'cleared') {
            if (wallSeconds - clearedAtWall >= CLEARED_SECONDS) {
              const next = shelfTrack.roomAfter(live.id)
              if (next === null) go('done')
              else enterRoom(next)
            }
            return
          }
          if (phaseNow === 'done') return

          // The voice first: a stop this step launches him this step,
          // from where he stands.
          const pitch = driver?.latestPitch() ?? null
          lastLevel = driver?.latestLevel() ?? 0
          const sure =
            forcedMidi ??
            (pitch !== null && pitch.conf >= 0.5 ? pitch.midi : null)
          lastHeard = forcedMidi !== null || pitch !== null
          lastMidi = sure
          const heardStop = voiceStep(voice, sure, dt, loco.grounded)
          if (heardStop?.kind === 'leap') launch(heardStop)
          else if (heardStop?.kind === 'ready') readying = true
          silentFor = sure === null ? silentFor + dt : 0
          if (voice.slide.moving || silentFor > CROUCH_BREATH) {
            readying = false
          }

          closeWalls()
          // The carry: airborne from a leap he drifts toward the next
          // shelf whatever the thumb is doing (§3.2) -- at the leap's own
          // speed while an aimed one rises, at walking pace after its
          // apex and for a hop -- and on across the lip of the one it
          // lands him on.
          const aim = flight?.carry ?? null
          walls.walkSpeed =
            aim !== null && loco.vy > 0 ? aim : cfg.locomotion.walkSpeed
          const move = carrying || boardTo !== null ? 1 : input.read(now).move
          stepLocomotion(loco, { move, jump: false }, ground, dt, walls)
          if (flight !== null) {
            apex = Math.max(apex, loco.y)
            // His mitt at the riser: the leap is aimed at that shelf.
            const target = live.shelves[flight.riser]
            if (target !== undefined && loco.x >= target.from - HALF - 1e-3) {
              flight.reached = true
            }
            // The apex is the step his climb stopped on -- or the one the
            // catch took him on, which for a leap that lands is the same
            // step (§11, 6b).
            if (!flight.flashed && loco.vy <= 0) {
              flight.flashed = true
              const riser = live.shelves[flight.riser]
              r.flash(
                riser === undefined ? loco.x + HALF : riser.from,
                apex,
                intervalLabel(flight.interval),
              )
            }
          }
          if (loco.grounded) {
            const on = shelfAt(loco.y)
            if (flight !== null) grade(flight, on)
            if (carrying && on > standingOn) {
              boardTo = live.shelves[on]!.from + HALF
            }
            carrying = false
            flight = null
            standingOn = on
            if (
              boardTo !== null &&
              loco.x >= Math.min(boardTo, walls.maxX) - 1e-6
            ) {
              boardTo = null
            }
          } else {
            readying = false
          }

          if (
            phaseNow === 'climbing' &&
            loco.grounded &&
            standingOn === live.shelves.length - 1 &&
            loco.x >= live.exitX - ARRIVED
          ) {
            clearRoom()
          }
        })

        crouch +=
          ((readying ? 1 : 0) - crouch) *
          (1 - Math.exp(-CROUCH_RATE * frameSeconds))

        sinceText += frameSeconds
        if (sinceText >= TEXT_INTERVAL) {
          sinceText = 0
          setHeard(lastHeard)
          setLevel(lastLevel)
          setStanding(standingOn)
          setAsk(live.shelves[standingOn + 1]?.rise ?? null)
          setAbove(
            lastMidi === null || voice.reference === null
              ? null
              : lastMidi - voice.reference,
          )
        }

        poseNow()
        view.mercX = loco.x
        view.mercY = loco.y
        view.mercFacing = loco.facing
        view.shelfY = tops[standingOn]!
        view.surfaceY = surfaceUnder(loco.x, loco.y)
        view.crouch = crouch
        view.exitOpen = standingOn === live.shelves.length - 1
        r.render(view, frameSeconds)
        frame = requestAnimationFrame(tick)
      }

      if (import.meta.env.DEV) {
        devActions = [
          { label: 'Hold A3', run: () => (forcedMidi = 57) },
          {
            label: 'Up a fifth',
            run: () => (forcedMidi = (voice.reference ?? 57) + 7),
          },
          { label: 'Let go', run: () => (forcedMidi = null) },
          {
            label: 'To the riser',
            run: () => {
              closeWalls()
              loco.x = walls.maxX
            },
          },
          { label: 'Clear this room', run: () => clearRoom() },
        ]
        ;(window as unknown as Record<string, unknown>).__w3s = () => ({
          phase: phaseNow,
          room: live.id,
          x: loco.x,
          y: loco.y,
          grounded: loco.grounded,
          shelf: standingOn,
          reference: voice.reference,
          leaps,
          apex,
          grades: grades.map((g) => ({ ...g })),
          mercScreenBox: () => r.mercScreenBox(),
          move: (m: number) => input.setMove(m),
          warpTo: (x: number) => {
            closeWalls()
            loco.x = Math.max(walls.minX, Math.min(walls.maxX, x))
          },
          sing: (midi: number | null) => {
            forcedMidi = midi
          },
          clear: () => clearRoom(),
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
        setReady(true)
      })
      .catch((err: unknown) => {
        setBackend('no GPU')
        setMicError(err instanceof Error ? err.message : String(err))
      })

    onCleanup(() => {
      gone = true
      observer.disconnect()
      unbindKeys()
      stopLoop?.()
      driver?.stop()
      r.dispose()
      goToRoom = null
      delete (window as unknown as Record<string, unknown>).__w3s
    })
  })

  /** One startMic at a time: two taps during the permission prompt
   *  shared `driver`, and the first one's catch nulled the second's. */
  let micStarting = false
  /** The stage has been left. A permission prompt outlives a stage that
   *  was navigated away from; the driver it would have opened after the
   *  prompt had nobody to stop it. */
  let left = false
  onCleanup(() => {
    left = true
  })

  const startMic = async (): Promise<void> => {
    if (micStarting) return
    micStarting = true
    setMicError(null)
    try {
      await applyPreferredInput()
      if (left) return
      driver?.stop()
      driver = createSingDriver(MIC_ID)
      await driver.start()
      if (left) {
        driver.stop()
        driver = null
        return
      }
      setStarted(true)
    } catch (err) {
      setMicError(micErrorLine(err))
      driver = null
    } finally {
      micStarting = false
    }
  }

  const switchMic = async (): Promise<void> => {
    if (micStarting) return
    micStarting = true
    driver?.stop()
    driver = null
    setMicError(null)
    try {
      driver = createSingDriver(MIC_ID)
      await driver.start()
      if (left) {
        driver.stop()
        driver = null
        return
      }
      setStarted(true)
    } catch (err) {
      setMicError(micErrorLine(err))
      driver = null
    } finally {
      micStarting = false
    }
  }

  /** What the voice is doing, in the room's own words: a leap is an
   * interval, so the HUD names the one being sung. */
  const voiceWord = (): string => {
    const a = above()
    if (a === null) return 'hold a note'
    if (a <= 0.5) return 'ready'
    return intervalLabel(a)
  }

  const top = (): number => room().shelves.length - 1

  // The interval gauge (§6): the Line's tube, reading the voice above
  // the reference instead of a place in the range. The glass is his
  // spring, and the band is the next shelf's ask from the catch below
  // it to the ask itself -- the stretch that lands for free.
  const gaugeT = (): number =>
    Math.min(1, Math.max(0, (above() ?? 0) / SPRING_SEMIS))
  const gaugeBand = (): { lo: number; hi: number } | null => {
    const a = ask()
    return a === null
      ? null
      : { lo: (a - CATCH_SEMIS) / SPRING_SEMIS, hi: a / SPRING_SEMIS }
  }
  const inBandNow = (): boolean => {
    const a = ask()
    const v = above()
    return a !== null && v !== null && v >= a - CATCH_SEMIS && v <= a
  }

  return (
    <div class="stage3d" classList={{ 'has-controls': started() }}>
      <canvas class="stage3d__canvas" ref={canvas} />

      <span class="stage3d__chip">{backend()}</span>

      <Show when={DevDials !== null}>
        <button
          type="button"
          class="dev-dials__open"
          onClick={() => setDials((on) => !on)}
        >
          dials
        </button>
      </Show>
      <Show when={DevDials !== null && dials()}>
        {(() => {
          const Panel = DevDials!
          return (
            <Panel
              config={cfg}
              title="The Top Shelf"
              actions={devActions}
              onClose={() => setDials(false)}
            />
          )
        })()}
      </Show>

      <Show when={started() && phase() !== 'done'}>
        <Show when={showGauge()}>
          <ShapeGauge
            t={gaugeT()}
            heard={heard()}
            band={gaugeBand()}
            inBand={inBandNow()}
            semis={SPRING_SEMIS}
          />
        </Show>

        <div class="chamber-hud">
          <p class="chamber-hud__line">
            <Show
              when={phase() === 'cleared'}
              fallback={
                standing() === top() ? 'The way out is lit.' : room().teaches
              }
            >
              {room().name}
              {lastRun() === null ? '' : ` — ${roomLine(lastRun()!)}`}
            </Show>
          </p>
          <p class="chamber-hud__where">
            {ROOMS.findIndex((r) => r.id === room().id) + 1} of {ROOMS.length}
          </p>
          <p class="chamber-hud__count">
            <Show
              when={heard()}
              fallback={
                <span class="chamber-hud__quiet">
                  {level() > 0.005
                    ? 'no note yet'
                    : 'no sound reaching the mic'}
                </span>
              }
            >
              {voiceWord()}
            </Show>
            <i
              class="chamber-hud__level"
              style={{ width: `${Math.min(1, level() * 6) * 2.5}rem` }}
            />
            {' · '}
            {standing()} of {top()} up
          </p>
          <div class="chamber-hud__toggles">
            <button
              type="button"
              class="chamber-hud__toggle"
              aria-pressed={showGauge()}
              onClick={toggleGauge}
            >
              gauge
            </button>
          </div>
        </div>

        <TouchControls source={input} jump={false} />
      </Show>

      {/* The one-step hint, the Line's pattern: two sentences at the door
          and no guide. A leap the height of the gap between two notes
          explains itself the first time it happens. */}
      <Show when={!started() && phase() !== 'done'}>
        <div class="stage3d__gate">
          <p>{room().teaches}</p>
          <p class="stage3d__gate-how">{room().hint}</p>
          <button type="button" onClick={() => void startMic()}>
            Walk in
          </button>
          <Show when={micError() !== null}>
            <p class="stage3d__error">{micError()}</p>
            <Show when={noMicApi === null}>
              <MicInput listening={false} onChoose={() => void switchMic()} />
            </Show>
          </Show>
        </div>
      </Show>

      <Show when={phase() === 'done'}>
        <div class="stage3d__card chamber-done">
          <Show
            when={shelfTrack.isFinished(track())}
            fallback={
              <>
                <span>{room().name}, climbed.</span>
                <Show when={lastRun()}>
                  {(run) => (
                    <span class="stage3d__card-note">
                      {roomLine(run())}
                      <Medal pct={run().pct} />
                    </span>
                  )}
                </Show>
              </>
            }
          >
            <span>The Top Shelf, climbed.</span>
            <span class="stage3d__card-note">
              {walkLine(ROOMS.flatMap((l) => stats()[l.id] ?? []))}
              <Medal pct={shelfTrack.walkGrade(track()) ?? 0} />
            </span>
          </Show>
          <ul class="chamber-done__rooms">
            <For each={ROOMS}>
              {(level, i) => (
                <li>
                  <button
                    type="button"
                    class="chamber-done__room"
                    disabled={
                      !ready() || !shelfTrack.isCleared(track(), level.id)
                    }
                    onClick={() => replayRoom(level)}
                  >
                    <span class="chamber-done__n">{i() + 1}</span>
                    <span class="chamber-done__teaches">{level.teaches}</span>
                    <span class="chamber-done__best">
                      {shelfTrack.isCleared(track(), level.id)
                        ? `${String(track().best[level.id] ?? 0)}%`
                        : 'not yet'}
                    </span>
                  </button>
                </li>
              )}
            </For>
          </ul>
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
