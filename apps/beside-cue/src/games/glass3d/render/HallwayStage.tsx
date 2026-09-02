// The Hallway, mounted: slice 1's journey.
// ============================================================
//
// Merc hovers in, a pane blocks the way, the voice breaks it, he
// crosses through the wreckage. The component owns exactly what
// Stage3D owns for the Cabinet — canvas, mic lifecycle, HUD signals —
// plus the one thing slice 1 adds: the traversal script, a four-phase
// state machine simple enough to read as stage directions.

import { midiToFreq, midiToNote } from '@irchiinnuss/pitch-engine'
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { applyPreferredInput } from '@/audio/input-device'
import { MicInput } from '@/components/MicInput'
import { createSingDriver } from '@/games/glass/drivers/sing'
import type { InteractionDriver } from '@/games/glass/drivers/types'
import { micErrorLine } from '@/games/glass/mic-error'
import { createVibratoDetector } from '@/games/glass/vibrato'
import { createGlassTone } from '../audio/glass-tone'
import { createLoopState, runLoop } from '../runtime/loop'
import { accuracy, createResonance, stepResonance } from '../sim/resonance3d'
import type { ShardLaunch } from '../sim/shatter3d'
import { solveShatter } from '../sim/shatter3d'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { HallwayView } from './Hallway3D'
import { createHallway3D, PANE } from './Hallway3D'

const MIC_ID = 'glass3d-hallway'

/** The pane's note: G4. A third below the Cabinet's A4, so the two
 * rooms ask for different notes and the ear tells them apart. */
const TARGET_MIDI = 67

/** The journey, in corridor metres. */
const START_X = -1.5
const SING_X = -0.52
const EXIT_X = 1.45
const HOVER_SPEED = 0.42

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
  const [phase, setPhase] = createSignal<Phase>('enter')
  const [grade, setGrade] = createSignal<number | null>(null)

  let driver: InteractionDriver | null = null
  let stopLoop: (() => void) | null = null
  const tone = createGlassTone(midiToFreq(TARGET_MIDI))

  const cfg = WORLD3D_CONFIG
  const target = midiToNote(TARGET_MIDI)
  const targetName = `${target.name}${target.octave}`

  const heardLine = createMemo(() => {
    const midi = heardMidi()
    if (midi === null) return 'listening'
    const semis = midi - TARGET_MIDI
    const tol = cfg.ring.tolSemis + (ringing() ? cfg.ring.pumpTolBonus : 0)
    if (Math.abs(semis) <= tol) {
      const cents = Math.round(semis * 100)
      return `${cents >= 0 ? '+' : '−'}${Math.abs(cents)}¢`
    }
    const note = midiToNote(Math.round(midi))
    const way = semis > 0 ? 'too high' : 'too low'
    return `${way} (${note.name}${note.octave})`
  })

  const coachLine = createMemo(() => {
    switch (phase()) {
      case 'enter':
        return 'Merc has somewhere to be'
      case 'sing':
        return ringing()
          ? 'Now let it waver'
          : `Hold ${targetName} — ${heardLine()}`
      case 'celebrate':
      case 'crossing':
        return 'Through he goes'
      case 'done':
        return `${grade() ?? 0}% in tune`
    }
  })

  onMount(() => {
    const r = createHallway3D(canvas, cfg)

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
      let breakAt = 0
      let elapsed = 0
      let mercX = START_X
      let phaseNow: Phase = 'enter'
      let celebrateUntil = 0
      let lastWaveStrength = 0
      let lastMidi: number | null = null
      let sinceText = TEXT_INTERVAL

      const go = (p: Phase): void => {
        phaseNow = p
        setPhase(p)
        const actor = r.merc()
        if (p === 'enter' || p === 'crossing') actor?.play('move')
        if (p === 'sing') actor?.play('listen')
        if (p === 'celebrate') actor?.play('celebrate', { loop: false })
        if (p === 'done') actor?.play('sing')
      }
      go('enter')

      const doBreak = (acc: number): void => {
        launches = solveShatter(
          r.centroids(),
          { x: 0, y: PANE.height * 0.52, z: 0 },
          acc,
          cfg.shatter,
          11,
        )
        breakAt = elapsed
        tone.shatter(acc)
        setGrade(Math.round(acc * 100))
        celebrateUntil = elapsed + CELEBRATE_SECONDS
        go('celebrate')
      }

      const view: HallwayView = {
        mercX,
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

        runLoop(loopState, frameSeconds, cfg.loop, (dt) => {
          elapsed += dt

          switch (phaseNow) {
            case 'enter':
              mercX = Math.min(SING_X, mercX + HOVER_SPEED * dt)
              if (mercX >= SING_X) go('sing')
              break
            case 'sing': {
              const pitch = driver?.latestPitch() ?? null
              const wave =
                pitch === null
                  ? { active: false, strength: 0 }
                  : vib.feed(pitch.tAudio * 1000, pitch.midi)
              lastMidi = pitch?.midi ?? null
              lastWaveStrength = wave.active ? wave.strength : 0
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
              mercX = Math.min(EXIT_X, mercX + HOVER_SPEED * dt)
              if (mercX >= EXIT_X) go('done')
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
        }

        view.mercX = mercX
        view.resonance = ring.res
        view.ringing = ring.res >= cfg.ring.holdCap && launches === null
        view.launches = launches
        view.shatterSeconds = launches === null ? 0 : elapsed - breakAt

        r.render(view, frameSeconds)
        frame = requestAnimationFrame(tick)
      }

      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__w3h = () => ({
          phase: phaseNow,
          mercX,
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
    <div class="stage3d">
      <canvas class="stage3d__canvas" ref={canvas} />

      <span class="stage3d__chip">{backend()}</span>

      <Show when={started() && phase() !== 'done'}>
        <div class="stage3d__meter" classList={{ 'is-ringing': ringing() }}>
          <Show when={phase() === 'sing'}>
            <div class="stage3d__track">
              <i style={{ width: `${Math.round(charge() * 100)}%` }} />
              <b style={{ left: `${Math.round(cfg.ring.holdCap * 100)}%` }} />
            </div>
          </Show>
          <p class="stage3d__coach">{coachLine()}</p>
          <MicInput listening onChoose={() => void switchMic()} />
        </div>
      </Show>

      <Show when={!started()}>
        <div class="stage3d__gate">
          <p>
            A pane stands between Merc and the rest of the hallway. Hold{' '}
            {targetName} until it rings, then let the note waver.
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
