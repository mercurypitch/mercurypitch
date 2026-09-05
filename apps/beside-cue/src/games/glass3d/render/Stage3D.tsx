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
import { createMemo, createSignal, lazy, onCleanup, onMount, Show, } from 'solid-js'
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
  /** Displayed frames and f0 frames per second. The chip used to say
   * only which backend won, which answers the one question nobody was
   * asking when the thing feels slow. */
  const [fps, setFps] = createSignal(0)
  const [pitchHz, setPitchHz] = createSignal(0)
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

  /** Backend, drawn frames, and f0 frames. All three, because on a phone
   * the interesting failure is a renderer that is fine and an audio
   * thread that is starved -- and those are indistinguishable from
   * "slow". */
  const chipLine = createMemo(() =>
    fps() === 0 ? backend() : `${backend()} · ${fps()}fps · ${pitchHz()}Hz`,
  )

  onMount(() => {
    const r = createRenderer3D(canvas, cfg)
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
      .init()
      .then(() => {
        if (gone) return
        fit()
        setBackend(r.backend())
        begin()
      })
      .catch((err: unknown) => {
        // A renderer that never resolves is a black screen with no
        // explanation, which is the worst way to fail on a device.
        setBackend('no GPU')
        setMicError(err instanceof Error ? err.message : String(err))
      })

    onCleanup(() => {
      gone = true
      observer.disconnect()
      stopLoop?.()
      driver?.stop()
      tone.dispose()
      r.dispose()
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
    let lastPitchStamp = -1
    let pitchFrames = 0
    let drawnFrames = 0
    let statsAt = performance.now()

    const tick = (now: number): void => {
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
        // One f0 frame can be polled many times per simulation step, so
        // the stream's real rate is counted by CHANGE, not by reads.
        if (pitch !== null && pitch.tAudio !== lastPitchStamp) {
          lastPitchStamp = pitch.tAudio
          pitchFrames += 1
        }

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

      // Rates over a whole second: anything shorter is noise, and this
      // is a number a human reads off a phone in their hand.
      drawnFrames += 1
      if (now - statsAt >= 1000) {
        const span = (now - statsAt) / 1000
        setFps(Math.round(drawnFrames / span))
        setPitchHz(Math.round(pitchFrames / span))
        drawnFrames = 0
        pitchFrames = 0
        statsAt = now
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

      renderer?.render(view)
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
        fps: fps(),
        pitchHz: pitchHz(),
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
    <div class="stage3d">
      <canvas class="stage3d__canvas" ref={canvas} />

      {/* Top RIGHT. The Leave pill is fixed to the top left and sits on
          z-index 50, so anything put there is simply not on screen. */}
      <span class="stage3d__chip">{chipLine()}</span>

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
          <button type="button" onClick={() => void startMic()}>
            Sing to it
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
