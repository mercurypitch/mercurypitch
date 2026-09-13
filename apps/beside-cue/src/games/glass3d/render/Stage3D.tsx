// The 3D stage, mounted.
// ============================================================
//
// This component is deliberately thin, and the reason is written in the
// plan (§4): `JourneyPrototype.tsx` is 3,184 lines because runtime,
// simulation, rendering and UI all ended up in one file. That held for
// 2D. It will not hold for a scene, a character and a render loop, so
// the split is enforced from the first commit rather than promised for
// later.
//
// What lives here: the canvas, the mic lifecycle, and the signals the UI
// reads. What does not: any rule (that is `sim/`), any drawing (that is
// `render/Renderer3D.ts`), and the loop itself (`runtime/loop.ts`).

import { applyPreferredInput } from '@irchiinnuss/audio-io'
import { MicInput } from '@irchiinnuss/audio-io/solid'
import { midiToFreq, midiToNote } from '@irchiinnuss/pitch-engine'
import { createSignal, lazy, onCleanup, onMount, Show } from 'solid-js'
import { createSingDriver } from '@/games/glass/drivers/sing'
import type { InteractionDriver } from '@/games/glass/drivers/types'
import { micErrorLine } from '@/games/glass/mic-error'
import { createVibratoDetector } from '@/games/glass/vibrato'
import { micApiBlocker } from '@/platform/device-support'
import { createGlassTone } from '../audio/glass-tone'
import { createLoopState, runLoop } from '../runtime/loop'
import { accuracy, createResonance, stepResonance } from '../sim/resonance3d'
import type { ShardLaunch } from '../sim/shatter3d'
import { shatterDuration, solveShatter } from '../sim/shatter3d'
import { CABINET_CONFIG } from '../world3d-config'
import type { StageView } from './Renderer3D'
import { createRenderer3D } from './Renderer3D'
import { createStageFrame } from './stage-frame'
import { StageCorner } from './StageCorner'
import { VoiceCoach } from './VoiceCoach'

const MIC_ID = 'glass3d-cabinet'

/** The note the Cabinet's glass answers to: MIDI 69, A4, 440 Hz. High
 * enough that the harmonic reads as "glass" rather than "hum", and low
 * enough that most voices can reach it in some octave. */
const TARGET_MIDI = 69

/** How often the coaching text may change, in seconds. The meter tracks
 * every frame — it is one number and the eye reads it as motion — but a
 * note name rewritten sixty times a second is unreadable. */
const TEXT_INTERVAL = 0.1

interface Stage3DProps {
  onExit: () => void
}

/** The dev dials, behind a dynamic import behind `DEV` -- see
 * `ChamberStage` for why this shape rather than a plain import. */
const DevDials = import.meta.env.DEV
  ? lazy(async () => ({ default: (await import('../dev/DevDials')).DevDials }))
  : null

export const Stage3D = (props: Stage3DProps) => {
  let canvas!: HTMLCanvasElement
  // A page with no microphone API says so before the tap rather than
  // after it: there is nothing to grant and nothing to retry, and the
  // fix is in the address bar (see platform/device-support).
  const noMicApi = micApiBlocker()
  const [micError, setMicError] = createSignal<string | null>(noMicApi)
  const [started, setStarted] = createSignal(false)
  /** The stage itself failed to come up (an asset that would not
   *  fetch, a renderer that threw). Kept apart from the mic error: the
   *  mic path cleared that one, and a tap on the gate then put the HUD
   *  over a black canvas for good. */
  const [renderError, setRenderError] = createSignal<string | null>(null)
  const [backend, setBackend] = createSignal('…')
  const [charge, setCharge] = createSignal(0)
  const [ringing, setRinging] = createSignal(false)
  const [wavering, setWavering] = createSignal(false)
  /** The wave as measured, not as judged. Shown while ringing because
   * "let it waver" with no readout is unanswerable: a player who cannot
   * break the glass has no way to tell a wave that is too slow from one
   * that is too shallow from one the mic never heard. */
  const [waveRate, setWaveRate] = createSignal(0)
  const [waveDepth, setWaveDepth] = createSignal(0)
  const [heardMidi, setHeardMidi] = createSignal<number | null>(null)
  const [broken, setBroken] = createSignal(false)
  const [grade, setGrade] = createSignal<number | null>(null)

  let driver: InteractionDriver | null = null
  let stopLoop: (() => void) | null = null
  let renderer: ReturnType<typeof createRenderer3D> | null = null
  // The glass's voice (§7). Built here, started inside the mic gesture --
  // the same click has to unlock both directions of audio.
  const tone = createGlassTone(midiToFreq(TARGET_MIDI))

  // The Cabinet's own config: the Hallway's ring, ear and loop, with the
  // break rescaled to a world about a fifth the size. Absolute metres
  // per second in a small room read as a much faster break.
  const cfg = CABINET_CONFIG
  const [dials, setDials] = createSignal(false)
  const target = midiToNote(TARGET_MIDI)
  const targetName = `${target.name}${target.octave}`

  /** The chip and calm mode (render/stage-frame.ts). The Cabinet's chip
   * was the only one with frame and f0 rates; every stage now carries
   * the same one, with frame time and the load breakdown beside them. */
  const pace = createStageFrame({
    calm: () => cfg.calm,
    backend: () => backend(),
  })

  onMount(() => {
    // Timed apart from the loads: it is synchronous, and it runs before
    // any file is asked for.
    const sceneFrom = performance.now()
    const r = createRenderer3D(canvas, cfg)
    pace.mark('scene', performance.now() - sceneFrom)
    renderer = r

    const fit = (): void => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      // Capped pixel ratio: fill cost scales with its square, and this is
      // the single biggest lever on a phone (§5.4).
      r.resize(rect.width, rect.height, Math.min(window.devicePixelRatio, 1.5))
    }

    // ResizeObserver rather than a window resize listener, because the
    // canvas can change size without the window doing anything: the
    // stage mounts before layout has settled, a soft keyboard opens, a
    // parent animates in. A window listener misses all three, and what
    // it leaves behind is a drawing buffer stuck at whatever size the
    // element had at mount -- 0x0 if it had not been laid out yet, which
    // renders as a black screen with no error anywhere.
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)

    /** Set the moment the stage goes away. `begin` runs from an async
     * init, so without this a player who leaves during the load starts a
     * frame loop after teardown that nothing holds a handle to. */
    let gone = false

    void r
      .init(pace.mark)
      .then(() => {
        if (gone) return
        fit()
        setBackend(r.backend())
        pace.refresh()
        begin()
      })
      .catch((err: unknown) => {
        // A renderer that never resolves is a black screen with no
        // explanation, which is the worst way to fail on a device.
        setBackend('no GPU')
        pace.refresh()
        setRenderError(err instanceof Error ? err.message : String(err))
      })

    onCleanup(() => {
      gone = true
      observer.disconnect()
      stopLoop?.()
      driver?.stop()
      tone.dispose()
      r.dispose()
      pace.dispose()
      renderer = null
      delete (window as unknown as Record<string, unknown>).__w3
    })
  })

  /** The whole game, such as it is in this slice: hold the note, wave it,
   * watch it break. */
  const begin = (): void => {
    const ring = createResonance(TARGET_MIDI)
    const vib = createVibratoDetector(cfg.vibrato)
    let launches: readonly ShardLaunch[] | null = null
    // Wall time, and the wall time the pane broke at. The shatter plays
    // back on these rather than on the fixed-step simulation clock; see
    // HallwayStage for why that clock is the wrong thing to animate from.
    // This stage kept no simulation time of its own for anything else, so
    // the accumulator that fed it is gone with it.
    let wallSeconds = 0
    let breakAtWall = 0

    const view: StageView = {
      shatterProgress: 0,
      shatterSeconds: 0,
      resonance: 0,
      ringing: false,
      launches: null,
    }

    // runLoop is the fixed-step accumulator, not a scheduler — it is
    // pure so it can be tested without a clock. Driving it is this
    // component's job, and rAF is the only part that needs a browser.
    const loopState = createLoopState()
    let last = performance.now()
    let frame = 0
    let sinceText = TEXT_INTERVAL
    let lastMidi: number | null = null
    let lastWave = false
    let lastWaveStrength = 0
    let lastWaveRate = 0
    let lastWaveDepth = 0

    const tick = (now: number): void => {
      pace.begin(now)
      const frameSeconds = (now - last) / 1000
      last = now
      wallSeconds += frameSeconds

      runLoop(loopState, frameSeconds, cfg.loop, (dt) => {
        const pitch = driver?.latestPitch() ?? null
        const wave =
          pitch === null
            ? { active: false, strength: 0 }
            : vib.feed(pitch.tAudio * 1000, pitch.midi)
        lastMidi = pitch?.midi ?? null
        lastWave = wave.active
        lastWaveStrength = wave.active ? wave.strength : 0
        lastWaveRate = 'rateHz' in wave ? wave.rateHz : 0
        lastWaveDepth = 'depthCents' in wave ? wave.depthCents : 0
        // One f0 frame is polled by many simulation steps, so its rate is
        // counted by change of level rather than by reads. It used to be
        // counted by change of `tAudio`, which is the audio clock at the
        // moment of the poll rather than a stamp on the frame -- so what
        // the chip showed was how often that clock moved while voiced.
        pace.level(driver?.latestLevel() ?? 0)

        if (launches === null) {
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
          if (broke) {
            // Everything about how the glass flies apart is decided here,
            // once, from how well the note was actually sung.
            const acc = accuracy(ring, cfg.ring)
            launches = solveShatter(
              renderer?.centroids() ?? [],
              { x: 0, y: 0.17, z: 0 },
              acc,
              cfg.shatter,
              7,
            )
            breakAtWall = wallSeconds
            tone.shatter(acc)
            setGrade(Math.round(acc * 100))
            setBroken(true)
          }
        }
      })
      tone.update(ring.res, lastWaveStrength)

      // Signals are written once a frame, not once a simulation step:
      // the loop runs at 120 Hz and Solid would otherwise be asked to
      // reconcile the HUD twice per displayed frame for no gain.
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

      view.resonance = ring.res
      view.ringing = ring.res >= cfg.ring.holdCap && launches === null
      view.launches = launches
      view.shatterSeconds = launches === null ? 0 : wallSeconds - breakAtWall
      view.shatterProgress =
        launches === null
          ? 0
          : Math.min(
              1,
              view.shatterSeconds /
                Math.max(shatterDuration(launches, cfg.shatter), 0.001),
            )

      // Calm (P3). Nothing in the Cabinet moves on its own but the
      // shards, so a voice or a touch is what wakes it.
      const drawn = pace.draw({
        voiced: lastMidi !== null,
        moving: launches !== null && view.shatterProgress < 1,
      })
      if (drawn !== null) renderer?.render(view)
      pace.end()
      frame = requestAnimationFrame(tick)
    }

    if (import.meta.env.DEV) {
      // The probe the plan asks for (§8): the E2E harness and a human
      // with no microphone both need to see a shatter on demand. It
      // reports state rather than faking it -- `break` runs the same
      // solveShatter call the voice does.
      ;(window as unknown as Record<string, unknown>).__w3 = () => ({
        charge: ring.res,
        ringing: ring.res >= cfg.ring.holdCap,
        wavering: lastWave,
        waveRate: lastWaveRate,
        waveDepth: lastWaveDepth,
        heard: lastMidi,
        fps: pace.stats().window?.fps ?? 0,
        pitchHz: pace.stats().window?.f0Hz ?? 0,
        perf: pace.stats(),
        broken: launches !== null,
        shards: renderer?.centroids().length ?? 0,
        backend: backend(),
        break: (acc = 1) => {
          if (launches !== null) return
          launches = solveShatter(
            renderer?.centroids() ?? [],
            { x: 0, y: 0.17, z: 0 },
            acc,
            cfg.shatter,
            7,
          )
          breakAtWall = wallSeconds
          tone.shatter(acc)
          setGrade(Math.round(acc * 100))
          setBroken(true)
        },
        /** Charge without singing, to inspect the ringing state. */
        setCharge: (to = cfg.ring.holdCap) => {
          ring.res = Math.min(0.999, to)
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
    pace.micAsked()
    tone.start()
    try {
      // The remembered input, if it is still plugged in -- see
      // audio/input-device.ts. Must happen before acquire(), because the
      // device is chosen by the constraints that open the stream.
      await applyPreferredInput()
      if (left) return
      // A previous attempt may have left a live driver: a second tap while
      // the permission prompt is up, or a switch that came good. Overwriting
      // it stranded its detector worker, its worklet and its share of the
      // audio lease for the life of the page.
      driver?.stop()
      driver = createSingDriver(MIC_ID)
      await driver.start()
      if (left) {
        driver.stop()
        driver = null
        return
      }
      pace.micLive()
      setStarted(true)
    } catch (err) {
      setMicError(micErrorLine(err))
      driver = null
    } finally {
      micStarting = false
    }
  }

  /** Re-open on a different input, without leaving the game. */
  const switchMic = async (): Promise<void> => {
    if (micStarting) return
    micStarting = true
    driver?.stop()
    driver = null
    setMicError(null)
    pace.micAsked()
    // The switch may be the first way in: the game's tone starts with it.
    if (!started()) tone.start()
    try {
      driver = createSingDriver(MIC_ID)
      await driver.start()
      if (left) {
        driver.stop()
        driver = null
        return
      }
      // The switch IS the retry. Leaving the gate up after a device that
      // works is what put two drivers on the same capture.
      pace.micLive()
      setStarted(true)
    } catch (err) {
      setMicError(micErrorLine(err))
      driver = null
    } finally {
      micStarting = false
    }
  }

  return (
    <div class="stage3d">
      <canvas class="stage3d__canvas" ref={canvas} />

      <StageCorner
        chipOn={pace.chipOn}
        lines={pace.lines()}
        onDials={DevDials === null ? undefined : () => setDials((on) => !on)}
      />
      <Show when={DevDials !== null && dials()}>
        {(() => {
          const Panel = DevDials!
          return (
            <Panel
              config={cfg}
              title="The Cabinet"
              onClose={() => setDials(false)}
            />
          )
        })()}
      </Show>

      <Show when={started() && !broken()}>
        <VoiceCoach
          cfg={cfg}
          targetMidi={TARGET_MIDI}
          charge={charge()}
          ringing={ringing()}
          heardMidi={heardMidi()}
          waveRate={waveRate()}
          waveDepth={waveDepth()}
          wavering={wavering()}
          listening
          onChooseMic={() => void switchMic()}
        />
      </Show>

      <Show when={!started()}>
        <div class="stage3d__gate">
          <p>
            Hold {targetName} until the glass rings, then let it waver — a
            steady note alone will not break it.
          </p>
          <button
            type="button"
            disabled={renderError() !== null}
            onClick={() => void startMic()}
          >
            Sing to it
          </button>
          <Show when={renderError() !== null}>
            <p class="stage3d__error">{renderError()}</p>
          </Show>
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

      <Show when={broken()}>
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
