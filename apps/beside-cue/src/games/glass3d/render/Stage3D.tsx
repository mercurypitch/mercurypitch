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

import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { createSingDriver } from '@/games/glass/drivers/sing'
import type { InteractionDriver } from '@/games/glass/drivers/types'
import { JOURNEY_CONFIG } from '@/games/glass/journey-config'
import { micErrorLine } from '@/games/glass/mic-error'
import { createVibratoDetector } from '@/games/glass/vibrato'
import { createLoopState, runLoop } from '../runtime/loop'
import { accuracy, createResonance, stepResonance } from '../sim/resonance3d'
import type { ShardLaunch } from '../sim/shatter3d'
import { shatterDuration, solveShatter } from '../sim/shatter3d'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { StageView } from './Renderer3D'
import { createRenderer3D } from './Renderer3D'

const MIC_ID = 'glass3d-cabinet'

/** The note the Cabinet's glass answers to. A5 — comfortably in range
 * for most voices an octave down, and high enough that the harmonic
 * reads as "glass" rather than "hum". */
const TARGET_MIDI = 69

interface Stage3DProps {
  onExit: () => void
}

export const Stage3D = (props: Stage3DProps) => {
  let canvas!: HTMLCanvasElement
  const [micError, setMicError] = createSignal<string | null>(null)
  const [started, setStarted] = createSignal(false)
  const [backend, setBackend] = createSignal('…')
  const [charge, setCharge] = createSignal(0)
  const [broken, setBroken] = createSignal(false)
  const [grade, setGrade] = createSignal<number | null>(null)

  let driver: InteractionDriver | null = null
  let stopLoop: (() => void) | null = null
  let renderer: ReturnType<typeof createRenderer3D> | null = null

  const cfg = WORLD3D_CONFIG

  onMount(() => {
    const r = createRenderer3D(canvas, cfg)
    renderer = r

    const fit = (): void => {
      const rect = canvas.getBoundingClientRect()
      // Capped pixel ratio: fill cost scales with its square, and this is
      // the single biggest lever on a phone (§5.4).
      r.resize(rect.width, rect.height, Math.min(window.devicePixelRatio, 1.5))
    }

    void r.init().then(() => {
      fit()
      setBackend(r.backend())
      begin()
    })

    window.addEventListener('resize', fit)
    onCleanup(() => {
      window.removeEventListener('resize', fit)
      stopLoop?.()
      driver?.stop()
      r.dispose()
      renderer = null
    })
  })

  /** The whole game, such as it is in this slice: hold the note, wave it,
   * watch it break. */
  const begin = (): void => {
    const ring = createResonance(TARGET_MIDI)
    const vib = createVibratoDetector(JOURNEY_CONFIG.vibrato)
    let launches: readonly ShardLaunch[] | null = null
    let breakAt = 0
    let elapsed = 0

    const view: StageView = {
      shatterProgress: 0,
      shatterSeconds: 0,
      resonance: 0,
      launches: null,
    }

    // runLoop is the fixed-step accumulator, not a scheduler — it is
    // pure so it can be tested without a clock. Driving it is this
    // component's job, and rAF is the only part that needs a browser.
    const loopState = createLoopState()
    let last = performance.now()
    let frame = 0

    const tick = (now: number): void => {
      const frameSeconds = (now - last) / 1000
      last = now

      runLoop(loopState, frameSeconds, cfg.loop, (dt) => {
        elapsed += dt
        const pitch = driver?.latestPitch() ?? null
        const wave =
          pitch === null
            ? { active: false, strength: 0 }
            : vib.feed(pitch.tAudio * 1000, pitch.midi)

        if (launches === null) {
          const broke = stepResonance(
            ring,
            {
              midi: pitch?.midi ?? null,
              vibrato: wave.active,
              vibratoStrength: wave.strength,
            },
            dt,
            cfg.ring,
          )
          setCharge(ring.res)
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
            breakAt = elapsed
            setGrade(Math.round(acc * 100))
            setBroken(true)
          }
        }
      })

      view.resonance = ring.res
      view.launches = launches
      view.shatterSeconds = launches === null ? 0 : elapsed - breakAt
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
          breakAt = elapsed
          setGrade(Math.round(acc * 100))
          setBroken(true)
        },
      })
      onCleanup(() => {
        delete (window as unknown as Record<string, unknown>).__w3
      })
    }

    frame = requestAnimationFrame(tick)
    stopLoop = () => cancelAnimationFrame(frame)
  }

  const startMic = async (): Promise<void> => {
    setMicError(null)
    try {
      driver = createSingDriver(MIC_ID)
      await driver.start()
      setStarted(true)
    } catch (err) {
      // Say WHICH failure it was — the 2D game learned this the hard way.
      setMicError(micErrorLine(err))
    }
  }

  return (
    <div class="stage3d">
      <canvas class="stage3d__canvas" ref={canvas} />

      <div class="stage3d__hud">
        <span class="stage3d__backend">{backend()}</span>
        <div class="stage3d__charge" aria-hidden="true">
          <i style={{ width: `${Math.round(charge() * 100)}%` }} />
        </div>
      </div>

      <Show when={!started()}>
        <div class="stage3d__gate">
          <p>Hold A above middle C until the glass rings, then let it waver.</p>
          <button type="button" onClick={() => void startMic()}>
            Sing to it
          </button>
          <Show when={micError() !== null}>
            <p class="stage3d__error">{micError()}</p>
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
