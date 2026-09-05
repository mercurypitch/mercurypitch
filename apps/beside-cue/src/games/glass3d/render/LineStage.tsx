// The Sorting Line, played.
// ============================================================
//
// Slice 4's room. Merc walks it, and the voice shapes HIM: where you
// sit in your own range is his silhouette, low a puddle and high a
// thread, with the volume of mercury conserved between. The room is
// inert; every plate and slot would sit there unchanged if the mic
// never opened (docs/games/sorting-line.md §2).
//
// A fork of ChamberStage, not a lift (§10): the canvas, the mic
// lifecycle, the loop, the gate and the end card are the chamber's
// shape, carrying slice 3's review fixes -- the camera reset on load,
// the jump buffer cleared across a handover, the grounded-checked exit,
// `begin()` after unmount, the mic-switch double driver. What is new is
// one rule, in `sim/tension3d`, and one object on screen, the gauge.
//
//   THERE IS NO TARGET PITCH. Two players with nothing in common vocally
//   sing completely different notes through the same room and are both
//   right, because `t` is a position in the player's OWN range.

import { applyPreferredInput } from '@irchiinnuss/audio-io'
import { MicInput } from '@irchiinnuss/audio-io/solid'
import { createSignal, For, lazy, onCleanup, onMount, Show } from 'solid-js'
import { createSingDriver } from '@/games/glass/drivers/sing'
import type { InteractionDriver } from '@/games/glass/drivers/types'
import { micErrorLine } from '@/games/glass/mic-error'
import { micApiBlocker } from '@/platform/device-support'
import type { DevAction } from '../dev/DevDials'
import { bindKeyboard, createIntentSource } from '../input/pad-intent'
import { keepBest, readStats, writeStats } from '../levels/line-stats'
import { lineTrack } from '../levels/line-track'
import type { LineGate, LineLevel } from '../levels/lines'
import { admits, bandAt, bandsFor, crossed, fitFor, furnitureOf, LINES, overGaps, wallAt, } from '../levels/lines'
import { createLoopState, runLoop } from '../runtime/loop'
import type { GateGrade, RoomStats } from '../sim/line-grade'
import { emptySlide, medalFor, midiBandFor, NO_STOPS, roomLine, slideStep, statsOf, walkLine, withStop, } from '../sim/line-grade'
import { createLocomotion, stepLocomotion } from '../sim/locomotion3d'
import type { Band, Range, Spring } from '../sim/tension3d'
import { inBand, REST_HEIGHT, REST_WIDTH, restTFor, silhouetteFor, springAt, tensionStep, widenRange, workingRange, } from '../sim/tension3d'
import { readMeasuredRange, voiceCentre } from '../voice-range'
import { CHAMBER_CONFIG } from '../world3d-config'
import type { LineGateView, LineView } from './Line3D'
import { createLine3D } from './Line3D'
import { ShapeGauge } from './ShapeGauge'
import { TouchControls } from './TouchControls'

const MIC_ID = 'glass3d-line'
const TEXT_INTERVAL = 0.1
/** How close to the exit counts as reaching it, in metres. */
const ARRIVED = 0.02
/** The beat between rooms. */
const CLEARED_SECONDS = 1.4
const GAUGE_KEY = 'beside-cue:games:line-gauge'

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
 * The range a room reads against, at entry: the measurement if the
 * RangeFinder ever ran, else a two-octave span around wherever the
 * voice centre says the voice sits, trimmed a semitone at each end.
 * Nobody is stopped at a door; the range widens as they sing (§6).
 */
const entryRange = (): Range => {
  const measured = readMeasuredRange()
  if (measured !== null) return workingRange(measured)
  const centre = voiceCentre()
  return workingRange({ lowMidi: centre - 12, highMidi: centre + 12 })
}

type Phase = 'walking' | 'falling' | 'cleared' | 'done'

/** How long a drop takes, the chamber's number: the `fall` clip is a
 * topple, and he sinks through the grate over it. */
const FALL_SECONDS = 1.6

const DevDials = import.meta.env.DEV
  ? lazy(async () => ({ default: (await import('../dev/DevDials')).DevDials }))
  : null

interface LineStageProps {
  onExit: () => void
}

/** The app's medal, at the app's thresholds, with nothing gated on it
 * (§9). Renders nothing below bronze: the units are the grade then. */
const Medal = (props: { pct: number }) => (
  <Show when={medalFor(props.pct)}>
    {(medal) => <i class={`line-medal line-medal--${medal()}`}>{medal()}</i>}
  </Show>
)

export const LineStage = (props: LineStageProps) => {
  let canvas!: HTMLCanvasElement
  // Only locomotion and the loop are read from it; the ring and vibrato
  // branches are a chamber's. A LINE_CONFIG sibling arrives with the
  // tension dials.
  const cfg = CHAMBER_CONFIG
  const input = createIntentSource()
  const noMicApi = micApiBlocker()

  const [track, setTrack] = createSignal(lineTrack.readTrack())
  const [room, setRoom] = createSignal<LineLevel>(
    lineTrack.currentRoom(lineTrack.readTrack()),
  )
  const [micError, setMicError] = createSignal<string | null>(noMicApi)
  const [started, setStarted] = createSignal(false)
  const [backend, setBackend] = createSignal('…')
  const [phase, setPhase] = createSignal<Phase>(
    lineTrack.isFinished(lineTrack.readTrack()) ? 'done' : 'walking',
  )
  const [ready, setReady] = createSignal(false)
  const [heard, setHeard] = createSignal(false)
  const [level, setLevel] = createSignal(0)
  const [shapeT, setShapeT] = createSignal(restTFor())
  const [band, setBand] = createSignal<Band | null>(null)
  const [span, setSpan] = createSignal(24)
  const [passed, setPassed] = createSignal(0)
  /** Every room's best run, in §9's units, for the walk card. */
  const [stats, setStats] = createSignal(readStats())
  /** The run just finished, for the room card. */
  const [lastRun, setLastRun] = createSignal<RoomStats | null>(null)
  const [showGauge, setShowGauge] = createSignal(readToggle(GAUGE_KEY))
  const [dials, setDials] = createSignal(false)

  let driver: InteractionDriver | null = null
  let stopLoop: (() => void) | null = null
  let goToRoom: ((next: LineLevel) => void) | null = null
  let devActions: readonly DevAction[] = []
  let replaying = false

  const toggleGauge = (): void => {
    const on = !showGauge()
    setShowGauge(on)
    writeToggle(GAUGE_KEY, on)
  }

  const replayRoom = (next: LineLevel): void => {
    replaying = true
    goToRoom?.(next)
  }

  onMount(() => {
    const r = createLine3D(canvas, cfg, room())
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
      let live: LineLevel = room()
      let range: Range = entryRange()

      interface GateState {
        spec: LineGate
        /** Where he has to be to get through: the gauge's band, and
         * what a stop is graded against. A wedge's closes as he walks
         * into it (`bandAt`), so it is set per frame. */
        band: Band
        /** Its bands as built, for `bandAt`. */
        bands: { band: Band; entry: Band }
        /** Its derived numbers: slot height, slot width, gap, or a
         * wedge's two ceilings. */
        size: number
        sizeOut: number
        open: boolean
        passed: boolean
      }

      /** A gate's furniture, for THIS player's range. Rebuilt when the
       * range widens, which is what "the room re-scales" means. */
      const buildGates = (): GateState[] =>
        live.gates.map((spec) => {
          const bands = bandsFor(spec, range)
          const fit = fitFor(spec, bands)
          return {
            spec,
            band: bands.band,
            bands,
            size: fit.size,
            sizeOut: fit.sizeOut,
            open: false,
            passed: false,
          }
        })
      let gates = buildGates()

      const refit = (): void => {
        for (const g of gates) {
          const bands = bandsFor(g.spec, range)
          const fit = fitFor(g.spec, bands)
          g.bands = bands
          g.band = bands.band
          g.size = fit.size
          g.sizeOut = fit.sizeOut
        }
        setSpan(range.highMidi - range.lowMidi)
      }

      const walls = { ...cfg.locomotion, minX: 0, maxX: live.length }
      /** The nearest thing he may not pass is the wall: a shut plate
       * ahead, or a wedge wherever its ceiling meets his head. Never
       * behind him (`wallAt`): a gate that closes on him pins him. */
      const closeWalls = (): void => {
        const body = silhouetteFor(spring.t)
        let stop = live.length
        for (const g of gates) {
          if (g.passed) continue
          const at = wallAt(g.spec, g, body, loco.x, g.open)
          if (at < stop) stop = at
        }
        walls.maxX = stop
      }
      const loco = createLocomotion(live.startX)
      /** The floor is flat everywhere he can stand. A grate that does
       * not hold him is not a lower floor, it is a drop, which is a
       * phase rather than a height (§5: the topple, not the plummet). */
      const ground = (): number => 0

      let spring: Spring = springAt(restTFor())
      /** A t held from the dev hook, so the room can be walked and looked
       * at without a microphone. Never set outside DEV. */
      let forcedT: number | null = null
      let phaseNow: Phase = 'walking'
      let wallSeconds = 0
      let clearedAtWall = 0
      let fellAtWall = 0
      /** Drops this room, for the card (§9). */
      let drops = 0
      /** The slide, and what each gate's stops came to (§9). */
      let slide = emptySlide()
      let grades: GateGrade[] = gates.map(() => NO_STOPS)
      let lastHeard = false
      let lastLevel = 0
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
        if (phaseNow === 'falling') return
        if (!loco.grounded || Math.abs(loco.vx) > 0.06) setPose('move')
        else if (lastHeard) setPose('sing')
        else setPose('listen')
      }

      /** The view's per-gate rows, remade with the gates: a room with
       * more furniture than the last one has more rows. Set once the
       * view exists, below. */
      let rebuildViews: (() => void) | null = null

      const enterRoom = (next: LineLevel): void => {
        live = next
        setRoom(next)
        gates = buildGates()
        rebuildViews?.()
        r.load(
          next,
          gates.map((g) => furnitureOf(g.spec)),
        )
        loco.x = next.startX
        loco.y = 0
        loco.vx = 0
        loco.vy = 0
        loco.grounded = true
        loco.facing = 1
        // The jump buffer only decays inside `stepLocomotion`, which the
        // 'cleared' branch skips; a press made during the last room's
        // final step would otherwise fire at the new start line.
        loco.bufferLeft = 0
        loco.jumpWasDown = false
        closeWalls()
        drops = 0
        slide = emptySlide()
        grades = gates.map(() => NO_STOPS)
        setPassed(0)
        setSpan(range.highMidi - range.lowMidi)
        go('walking')
      }

      /** The grate let go. He topples where he stands and sinks through
       * it; the chute takes him back to the lip. Nothing else resets:
       * gates already passed stay passed, and his shape is whatever his
       * voice is making it. */
      const drop = (): void => {
        drops += 1
        fellAtWall = wallSeconds
        go('falling')
        setPose('fall', false)
      }
      const returnHim = (): void => {
        loco.x = live.returnX ?? live.startX
        loco.y = 0
        loco.vx = 0
        loco.vy = 0
        loco.grounded = true
        loco.facing = 1
        loco.bufferLeft = 0
        loco.jumpWasDown = false
        closeWalls()
        go('walking')
      }
      goToRoom = enterRoom

      /** The room is finished. Written the moment it happens: a player
       * who puts the phone down after room one has finished room one.
       * The grade is §9's: where each glide stopped against its gate's
       * band, first tries, drops -- kept per room for the best run. */
      const clearRoom = (): void => {
        const run = statsOf({
          gates: grades,
          bands: gates.map((g) => midiBandFor(g.band, range)),
          drops,
        })
        setLastRun(run)
        const next = lineTrack.recordClear(track(), live.id, run.pct)
        setTrack(next)
        lineTrack.writeTrack(next)
        const kept = keepBest(stats(), live.id, run)
        setStats(kept)
        writeStats(kept)
        clearedAtWall = wallSeconds
        if (replaying) {
          replaying = false
          go('done')
          return
        }
        go(lineTrack.roomAfter(live.id) === null ? 'done' : 'cleared')
      }

      closeWalls()
      r.load(
        live,
        gates.map((g) => furnitureOf(g.spec)),
      )

      const viewsFor = (): LineGateView[] =>
        gates.map((g) => ({
          size: g.size,
          sizeOut: g.sizeOut,
          open: false,
          passed: false,
        }))
      let gateViews: LineGateView[] = viewsFor()
      const view: LineView = {
        mercX: loco.x,
        mercY: 0,
        mercFacing: 1,
        widthScale: 1,
        heightScale: 1,
        gates: gateViews,
        exitOpen: false,
        falling: 0,
      }
      rebuildViews = () => {
        gateViews = viewsFor()
        view.gates = gateViews
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
              const next = lineTrack.roomAfter(live.id)
              if (next === null) go('done')
              else enterRoom(next)
            }
            return
          }
          if (phaseNow === 'done') return

          // A drop is a phase: he does not walk, and the voice keeps
          // shaping him, because the shape is the lesson. Locomotion
          // resumes at the lip.
          const falling = phaseNow === 'falling'
          if (falling && wallSeconds - fellAtWall >= FALL_SECONDS) {
            returnHim()
          }
          if (!falling) {
            closeWalls()
            stepLocomotion(loco, input.read(now), ground, dt, walls)
          }

          const pitch = driver?.latestPitch() ?? null
          lastLevel = driver?.latestLevel() ?? 0
          lastHeard = pitch !== null
          // The grade listens to the voice, not to the shape: a stop
          // is where a glide settled, judged against the band of the
          // gate he is on his way to.
          const sure = pitch !== null && pitch.conf >= 0.5 ? pitch.midi : null
          const stop = slideStep(slide, sure, dt)
          if (stop !== null) {
            const aim = gates.findIndex((g) => !g.passed)
            if (aim >= 0) {
              const g = gates[aim]!
              grades[aim] = withStop(
                grades[aim]!,
                stop,
                midiBandFor(g.band, range),
              )
            }
          }
          if (pitch !== null && pitch.conf >= 0.5) {
            const wider = widenRange(range, pitch.midi)
            if (wider !== range) {
              range = wider
              refit()
            }
          }
          spring = tensionStep(
            spring,
            { midi: pitch?.midi ?? null, confidence: pitch?.conf ?? 0 },
            range,
            dt,
          )
          if (forcedT !== null) spring = { t: forcedT, v: 0 }
          const body = silhouetteFor(spring.t)

          for (const g of gates) {
            g.band = bandAt(g.spec, g.bands, g, body, loco.x)
            g.open = admits(g.spec, body, g, loco.x)
            // Passing is crossing, which the walls only allow while he
            // fits a plate, and which a grate only allows by holding
            // him all the way. Passed stays passed (§5).
            if (!g.passed && !falling && crossed(g.spec, loco.x)) {
              g.passed = true
            }
          }
          if (!falling && loco.grounded) {
            for (const g of gates) {
              if (g.spec.kind !== 'mesh' || g.open) continue
              if (overGaps(g.spec, loco.x, g.size)) {
                drop()
                break
              }
            }
          }

          if (
            phaseNow === 'walking' &&
            loco.x >= live.exitX - ARRIVED &&
            loco.grounded &&
            gates.every((g) => g.passed)
          ) {
            clearRoom()
          }
        })

        sinceText += frameSeconds
        if (sinceText >= TEXT_INTERVAL) {
          sinceText = 0
          setHeard(lastHeard)
          setLevel(lastLevel)
          setShapeT(spring.t)
          const aim = gates.find((g) => !g.passed)
          setBand(aim === undefined ? null : aim.band)
          setPassed(gates.filter((g) => g.passed).length)
        }

        poseNow()
        const body = silhouetteFor(spring.t)
        // Through the grate: the clip topples him, and he sinks with
        // it, slowly then not, so the last of him goes as the chute
        // is brightest.
        const sink =
          phaseNow === 'falling'
            ? Math.min(1, (wallSeconds - fellAtWall) / FALL_SECONDS)
            : 0
        view.falling = sink
        view.mercX = loco.x
        view.mercY = phaseNow === 'falling' ? -0.55 * sink * sink : loco.y
        view.mercFacing = loco.facing
        view.widthScale = body.width / REST_WIDTH
        view.heightScale = body.height / REST_HEIGHT
        for (let i = 0; i < gates.length; i++) {
          const g = gates[i]!
          const v = gateViews[i]!
          v.size = g.size
          v.sizeOut = g.sizeOut
          v.open = g.open
          v.passed = g.passed
        }
        view.exitOpen = gates.every((g) => g.passed)
        r.render(view, frameSeconds)
        frame = requestAnimationFrame(tick)
      }

      if (import.meta.env.DEV) {
        devActions = [
          {
            label: 'Hold flat',
            run: () => (forcedT = forcedT === 0.05 ? null : 0.05),
          },
          {
            label: 'Hold tall',
            run: () => (forcedT = forcedT === 0.95 ? null : 0.95),
          },
          { label: 'Let go', run: () => (forcedT = null) },
          {
            label: 'To the exit',
            run: () => {
              for (const g of gates) g.passed = true
              closeWalls()
              loco.x = live.exitX
            },
          },
          { label: 'Clear this room', run: () => clearRoom() },
        ]
        ;(window as unknown as Record<string, unknown>).__w3l = () => ({
          phase: phaseNow,
          x: loco.x,
          t: spring.t,
          range,
          gates: gates.map((g) => ({ ...g })),
          drops,
          grades: grades.map((g) => ({ ...g })),
          move: (m: number) => input.setMove(m),
          drop: () => drop(),
          warpTo: (x: number) => {
            closeWalls()
            loco.x = Math.max(walls.minX, Math.min(walls.maxX, x))
          },
          sing: (t: number | null) => {
            forcedT = t
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
      delete (window as unknown as Record<string, unknown>).__w3l
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

  const inBandNow = (): boolean => {
    const b = band()
    return b !== null && inBand(shapeT(), b)
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
              title="The Sorting Line"
              actions={devActions}
              onClose={() => setDials(false)}
            />
          )
        })()}
      </Show>

      <Show when={started() && phase() !== 'done'}>
        <Show when={showGauge()}>
          <ShapeGauge
            t={shapeT()}
            heard={heard()}
            band={band()}
            inBand={inBandNow()}
            semis={span()}
          />
        </Show>

        <div class="chamber-hud">
          <p class="chamber-hud__line">
            <Show
              when={phase() === 'cleared'}
              fallback={
                passed() === room().gates.length
                  ? 'The way out is lit.'
                  : room().teaches
              }
            >
              Through. {lastRun() === null ? '' : roomLine(lastRun()!)}
            </Show>
          </p>
          <p class="chamber-hud__where">
            {lineTrack.roomIndex(room().id) + 1} of {LINES.length}
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
              {shapeT() < restTFor() - 0.05
                ? 'flat'
                : shapeT() > restTFor() + 0.05
                  ? 'tall'
                  : 'a drop'}
            </Show>
            <i
              class="chamber-hud__level"
              style={{ width: `${Math.min(1, level() * 6) * 2.5}rem` }}
            />
            {' · '}
            {passed()} of {room().gates.length} through
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

        <TouchControls source={input} jump={room().jump} />
      </Show>

      {/* The one-step hint. This world's idea is simple enough to say in
          two sentences, so it gets two sentences at the door and no guide.
          The chamber needs its full guide because vibrato does not explain
          itself; a voice that changes a shape does. */}
      <Show when={!started() && phase() !== 'done'}>
        <div class="stage3d__gate">
          <p>{room().teaches}</p>
          <p class="stage3d__gate-how">
            {room().hint ??
              'Your voice is his body: sing low and he spreads flat, sing high and he draws up thin. Walk him to the far end, and change shape to get through what is in the way.'}
          </p>
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
            when={lineTrack.isFinished(track())}
            fallback={
              <>
                <span>Through.</span>
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
            <span>The Sorting Line, walked.</span>
            <span class="stage3d__card-note">
              {walkLine(LINES.flatMap((l) => stats()[l.id] ?? []))}
              <Medal pct={lineTrack.walkGrade(track()) ?? 0} />
            </span>
          </Show>
          <ul class="chamber-done__rooms">
            <For each={LINES}>
              {(level, i) => (
                <li>
                  <button
                    type="button"
                    class="chamber-done__room"
                    disabled={
                      !ready() || !lineTrack.isCleared(track(), level.id)
                    }
                    onClick={() => replayRoom(level)}
                  >
                    <span class="chamber-done__n">{i() + 1}</span>
                    <span class="chamber-done__teaches">{level.teaches}</span>
                    <span class="chamber-done__best">
                      {lineTrack.isCleared(track(), level.id)
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
