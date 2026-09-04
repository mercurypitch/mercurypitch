// Merc, alone in the Hallway, on a page that needs no plan and no mic.
// ============================================================
//
// Dev only: this file is reached from /merc-probe.html, which Vite serves
// in dev and does not build (the production input is index.html alone).
// It exists because looking at him in the real renderer, with the real
// environment, used to mean setting up a plan, opening Games, starting
// the Hallway and getting the mic prompt out of the way -- every time a
// shape key moved a millimetre. Now it is a URL.
//
//   /merc-probe.html?clip=sing          loop one clip
//   /merc-probe.html?clip=listen&t=0.37 freeze it at a time (a blink)
//   /merc-probe.html?x=-0.4             where he stands along the corridor
//   /merc-probe.html?shape=0.0          the Sorting Line's silhouette, held
//   /merc-probe.html?sweep=1            ...swept end to end instead
//   /merc-probe.html?voice=baritone     which range the mic reads against
//   /merc-probe.html?flat=0.32&tall=0.94  the two ends of the sweep, in metres
//   /merc-probe.html?gauge=0            hide the shape gauge on the right
//   /merc-probe.html?mic=1              the mic, without the game: runs the
//                                       sing driver as the stage does, prints
//                                       each step, and METERS EVERY INPUT so
//                                       a silent one is visible rather than
//                                       inferred (see below)
//
// Keys 1-5 switch clips live. The HUD prints the backend and what is
// playing, so a screenshot documents itself.

import { micManager, readMicLevel } from '@irchiinnuss/pitch-engine'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Box3, Vector3 } from 'three'
// The stage's own stylesheet, for the gauge: the probe page carries only
// the styles its canvas and HUD need, and a component positioned by a
// class it cannot see lands under the fold, unstyled, and reads as
// missing rather than as unstyled.
import '../screens/games.css'
import { acquireSharedAudioContext } from '@/audio/shared-audio-context'
import { createSingDriver } from '../games/glass/drivers/sing'
import type { InteractionDriver } from '../games/glass/drivers/types'
import { micErrorLine } from '../games/glass/mic-error'
import type { HallwayView } from '../games/glass3d/render/Hallway3D'
import { createHallway3D } from '../games/glass3d/render/Hallway3D'
import { ShapeGauge } from '../games/glass3d/render/ShapeGauge'
import { bandFor, inBand, LETTERBOX, REST_HEIGHT, REST_WIDTH, silhouetteFor, SWEEP, tFor, workingRange, } from '../games/glass3d/sim/tension3d'
import type { VoicePreset } from '../games/glass3d/voice-range'
import { readMeasuredRange, VOICE_PRESETS } from '../games/glass3d/voice-range'
import { WORLD3D_CONFIG } from '../games/glass3d/world3d-config'

const CLIPS = ['listen', 'sing', 'celebrate', 'move', 'fall'] as const

const params = new URLSearchParams(window.location.search)
let clip: string = params.get('clip') ?? 'listen'
const freezeAt = params.has('t') ? Number(params.get('t')) : null
const mercX = Number(params.get('x') ?? '-0.55')
const micMode = params.has('mic')
// Slice 4a, the squash test. `shape` is `t` in the Sorting Line's sense:
// 0 is a puddle, 1 is a thread, 0.5 is the Merc who already ships.
let shapeT = params.has('shape') ? Number(params.get('shape')) : 0.5
let sweeping = params.has('sweep')
/** True while the voice is driving him, so the slider stops fighting it. */
let shapeFromVoice = false
const metres = (key: string, fallback: number): number => {
  const n = Number(params.get(key))
  return params.has(key) && Number.isFinite(n) && n > 0 ? n : fallback
}
/** The sweep under test. Defaults to the shipped one; dial it from the URL. */
const sweep = {
  flat: metres('flat', SWEEP.flat),
  tall: metres('tall', SWEEP.tall),
}

const canvas = document.querySelector('canvas')!
const hud = document.querySelector<HTMLDivElement>('#hud')!
const r = createHallway3D(canvas, WORLD3D_CONFIG)

const fit = (): void =>
  r.resize(
    window.innerWidth,
    window.innerHeight,
    Math.min(window.devicePixelRatio, 2),
  )
fit()
addEventListener('resize', fit)

const view: HallwayView = {
  mercX,
  mercY: 0,
  mercFacing: 1,
  resonance: 0,
  ringing: false,
  shatterSeconds: 0,
  launches: null,
}

const play = (name: string): void => {
  clip = name
  r.merc()?.play(name, { loop: true, fade: 0 })
}

addEventListener('keydown', (e) => {
  const i = Number(e.key) - 1
  if (i >= 0 && i < CLIPS.length) play(CLIPS[i])
})

await r.init()
play(clip)

// The view is the probe's whole point, so hand it to the console too.
// `__merc()` is the actor, `__view` the frame the renderer is reading:
// enough to measure him, pose him, or ask where his feet actually are
// without editing this file again.
Object.assign(window as unknown as Record<string, unknown>, {
  __merc: () => r.merc(),
  __view: view,
  __shape: (t: number) => {
    shapeFromVoice = false
    sweeping = false
    setShapeT(t)
  },
  /**
   * Where he is on the screen, in CSS pixels, for the e2e that holds
   * him inside a phone at both ends of the sweep.
   *
   * POSED, not bind pose. A SkinnedMesh caches `boundingBox` from
   * whatever pose it was first asked in, and the bind pose has the
   * mitts flung wide -- 7 px past a phone's edge at the flat end while
   * the drawn `listen` pose tucks them in. `computeBoundingBox` on each
   * skin reads the bones as they are this frame, which is the box the
   * player sees.
   *
   * `feetPx` is his lowest point projected as a POINT, because the
   * bottom of the box is its nearest bottom corner, and a wider body's
   * corner sits lower on screen through perspective alone -- 16 px at
   * the flat end, with the feet themselves unmoved.
   */
  __mercScreenBox: () => {
    const actor = r.merc()
    if (actor === null) return null
    actor.root.updateWorldMatrix(true, true)
    actor.root.traverse((o) => {
      const skin = o as {
        isSkinnedMesh?: boolean
        computeBoundingBox?: () => void
      }
      if (skin.isSkinnedMesh === true) skin.computeBoundingBox?.()
    })
    const box = new Box3().setFromObject(actor.root)
    const cam = r.camera()
    const w = window.innerWidth
    const h = window.innerHeight
    let left = Infinity
    let right = -Infinity
    let top = Infinity
    let bottom = -Infinity
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = new Vector3(x, y, z).project(cam)
          const px = ((p.x + 1) / 2) * w
          const py = ((1 - p.y) / 2) * h
          left = Math.min(left, px)
          right = Math.max(right, px)
          top = Math.min(top, py)
          bottom = Math.max(bottom, py)
        }
    // His feet are the torso's bottom -- the thing `setShape` holds
    // still -- projected as a point. The mitts are not feet, and they
    // are not the part a slot has to admit either, so the torso's own
    // screen box rides along for the e2e.
    const torso = actor.root.getObjectByName('merc_body')
    const torsoBox = torso === undefined ? box : new Box3().setFromObject(torso)
    const rect = (b: Box3) => {
      let l = Infinity
      let r2 = -Infinity
      let tp = Infinity
      let bt = -Infinity
      for (const x of [b.min.x, b.max.x])
        for (const y of [b.min.y, b.max.y])
          for (const z of [b.min.z, b.max.z]) {
            const q = new Vector3(x, y, z).project(cam)
            const px = ((q.x + 1) / 2) * w
            const py = ((1 - q.y) / 2) * h
            l = Math.min(l, px)
            r2 = Math.max(r2, px)
            tp = Math.min(tp, py)
            bt = Math.max(bt, py)
          }
      return { left: l, right: r2, top: tp, bottom: bt }
    }
    const feet = new Vector3(
      actor.root.position.x,
      torsoBox.min.y,
      actor.root.position.z,
    ).project(cam)
    return {
      left,
      right,
      top,
      bottom,
      torso: rect(torsoBox),
      viewport: { w, h },
      feetY: torsoBox.min.y,
      feetPx: { x: ((feet.x + 1) / 2) * w, y: ((1 - feet.y) / 2) * h },
    }
  },
})

// The squash test (slice 4a).
// ============================================================
//
// The Sorting Line poses Merc from where the voice sits in its own
// range, and the one thing that cannot be settled on paper is whether
// the flat end reads as a puddle or as a broken character. So: the
// silhouette, on the real asset, in the real environment, driven either
// by a slider or by a voice, before a single room exists to be wrong
// about.
//
// The rule itself lives in `sim/tension3d.ts` and is tested there. This
// only turns it into something to look at.

/** Which span the mic reads against: the measurement if the RangeFinder
 * ever ran, else a named preset, else tenor. `?voice=bass` etc. */
const askedVoice = params.get('voice')
const presetNamed = (id: string | null): VoicePreset | undefined =>
  VOICE_PRESETS.find((v) => v.id === id)
const voiceRange = workingRange(
  presetNamed(askedVoice) ??
    readMeasuredRange() ??
    presetNamed('tenor') ??
    VOICE_PRESETS[2]!,
)

const slider = document.createElement('input')
slider.type = 'range'
slider.min = '0'
slider.max = '1'
slider.step = '0.001'
slider.style.cssText =
  'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;width:min(28rem,72vw);accent-color:#cfd6dc'
document.body.append(slider)

const setShapeT = (next: number): void => {
  shapeT = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 0.5
  const s = silhouetteFor(shapeT, sweep)
  // Ratios against rest, not metres: `merc.ts` has no opinion about
  // what this world calls a puddle, and `setShape(1, 1)` is the Merc
  // who already ships.
  r.merc()?.setShape(s.width / REST_WIDTH, s.height / REST_HEIGHT)
  slider.value = String(shapeT)
}

slider.addEventListener('input', () => {
  shapeFromVoice = false
  sweeping = false
  setShapeT(Number(slider.value))
})

addEventListener('keydown', (e) => {
  if (e.key === '[' || e.key === ']') {
    shapeFromVoice = false
    sweeping = false
    setShapeT(shapeT + (e.key === ']' ? 0.05 : -0.05))
  }
  if (e.key === 's') sweeping = !sweeping
})

setShapeT(shapeT)

// The shape gauge, beside him, reading the same t. Room 1's letterbox
// band is drawn so the band and its warming can be seen without a room.
const [gaugeT, setGaugeT] = createSignal(shapeT)
const [gaugeHeard, setGaugeHeard] = createSignal(true)
const letterbox = bandFor(LETTERBOX, voiceRange)
if (params.get('gauge') !== '0') {
  const host = document.createElement('div')
  document.body.append(host)
  render(
    () =>
      ShapeGauge({
        get t() {
          return gaugeT()
        },
        get heard() {
          return gaugeHeard()
        },
        band: letterbox,
        get inBand() {
          return inBand(gaugeT(), letterbox)
        },
        semis: voiceRange.highMidi - voiceRange.lowMidi,
      }),
    host,
  )
}

// Mic diagnostics.
// ============================================================
//
// Two halves, because "the microphone does not work" is two questions.
//
// The DRIVER half runs the same calls in the same order as
// HallwayStage.startMic and prints each boundary, so a failure names its
// layer instead of arriving as silence.
//
// The METER half is the one that earns this file. It bypasses
// pitch-engine entirely -- getUserMedia straight into an AnalyserNode --
// and does it for EVERY input device at once. A stream can open, report
// `running`, hold the permission, light Chrome's recording dot, and
// still carry nothing, because the device that opened is not the one
// being sung into: on an audio interface the default input is whichever
// channel the OS picked, and a microphone on another channel is silence
// with every light green. Only a per-device meter can tell that apart
// from a broken graph, and the app has no input picker to try it with
// (mercurypitch has one; this app takes the browser default and hopes).
//
// Click a row to make that device the preferred one and restart the
// driver on it.

let micLine = ''

interface Meter {
  readonly label: string
  readonly deviceId: string
  level: number
  note: string
}

// Only ever called AFTER a stream has been granted, and that ordering is
// load-bearing twice over. Before permission, enumerateDevices returns a
// single placeholder audioinput with an empty id and an empty label --
// and asking for `{ deviceId: { exact: '' } }` is an OverconstrainedError,
// which is a confusing way to say "not allowed yet". Labels are blank
// before permission too, so an early list is unreadable as well as
// unopenable.
const startMeters = async (row: HTMLDivElement): Promise<void> => {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'audioinput' && d.deviceId.length > 0,
  )
  const meters: Meter[] = []
  // The app's one context, not a second of its own: audio/
  // shared-audio-context.ts owns every lane, and a test asserts that no
  // other module constructs one. A meter is not a good enough reason to
  // be the exception.
  const lease = acquireSharedAudioContext('merc-probe-meters')
  const context = lease.ensure()
  if (context === null) return
  await lease.unlock()

  for (const device of devices) {
    const meter: Meter = {
      label: device.label || `(unlabelled ${device.deviceId.slice(0, 8)})`,
      deviceId: device.deviceId,
      level: 0,
      note: '',
    }
    meters.push(meter)
    try {
      // Raw: none of the analysis constraints, nothing but the device.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: device.deviceId } },
      })
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      context.createMediaStreamSource(stream).connect(analyser)
      const buffer = new Float32Array(analyser.fftSize)
      const read = (): void => {
        analyser.getFloatTimeDomainData(buffer)
        let sum = 0
        for (const v of buffer) sum += v * v
        meter.level = Math.sqrt(sum / buffer.length)
        requestAnimationFrame(read)
      }
      read()
    } catch (err) {
      meter.note = err instanceof Error ? err.name : 'failed'
    }
  }

  const paint = (): void => {
    row.replaceChildren(
      ...meters.map((m) => {
        const line = document.createElement('div')
        const bars = Math.min(20, Math.round(m.level * 400))
        line.textContent = `${'\u2588'.repeat(bars).padEnd(20, '\u00b7')} ${m.level.toFixed(4)}  ${m.label}${m.note ? `  [${m.note}]` : ''}`
        line.style.cssText = 'cursor:pointer;padding:1px 0'
        line.addEventListener('click', () => {
          void micManager.setPreferredDevice(m.deviceId).then(() => {
            console.log(`[merc-probe mic] preferred device -> ${m.label}`)
            void restart()
          })
        })
        return line
      }),
    )
    requestAnimationFrame(paint)
  }
  paint()
}

let driver: InteractionDriver | null = null

/**
 * The signal chain, stage by stage, so a loss can be pinned to a link.
 *
 * The per-device meters answer "does this device carry sound". They said
 * yes -- 0.40 on both -- while the driver said 0.0000, and those two
 * facts together mean the loss is inside our own pipeline. But "our
 * pipeline" is four things in a row, so it gets four readouts:
 *
 *   A  the stream the APP opened, measured by a plain analyser. Differs
 *      from the per-device meter in one way that matters: micManager
 *      asks for echoCancellation/noiseSuppression/autoGainControl OFF,
 *      and a device that is happy to open raw can answer a constrained
 *      request with a different route, or with silence.
 *   B  what the capture worklet published (readMicLevel).
 *   C  what the detector worker returned, via the frame assembler --
 *      this is what the GAME reads, and the only one it reads.
 *
 * A alone means the worklet never attached. A and B mean the worker is
 * not answering. None of them means the app's own stream is silent
 * while a raw one is not, which points at the constraints or the device
 * the constraints picked -- and the track settings printed beside it
 * name that device.
 */
let chain = ''

const watchChain = (): void => {
  const stream = micManager.getStream()
  if (stream === null) return
  const lease = acquireSharedAudioContext('merc-probe-chain')
  const context = lease.ensure()
  if (context === null) return
  const track = stream.getAudioTracks()[0]
  const settings = track?.getSettings?.() ?? {}
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  context.createMediaStreamSource(stream).connect(analyser)
  const buffer = new Float32Array(analyser.fftSize)
  const read = (): void => {
    analyser.getFloatTimeDomainData(buffer)
    let sum = 0
    for (const v of buffer) sum += v * v
    const a = Math.sqrt(sum / buffer.length)
    const b = readMicLevel()
    const pitch = driver?.latestPitch()
    chain =
      `A app stream ${a.toFixed(4)} (${track?.label ?? 'no track'}` +
      `${settings.sampleRate !== undefined ? `, ${settings.sampleRate}Hz` : ''}` +
      `${settings.channelCount !== undefined ? `, ${settings.channelCount}ch` : ''})` +
      `\n     B worklet    ${b.toFixed(4)}` +
      `\n     C detector   ${(driver?.latestLevel() ?? 0).toFixed(4)}` +
      `  pitch ${pitch ? pitch.midi.toFixed(1) : 'none'}`
    requestAnimationFrame(read)
  }
  read()
}

const restart = (): Promise<void> => {
  const t0 = performance.now()
  const stamp = (msg: string): void => {
    micLine = `${msg} (+${Math.round(performance.now() - t0)}ms)`
    console.log(`[merc-probe mic] ${micLine}`)
  }
  driver?.stop()
  const next = createSingDriver('merc-probe')
  driver = next
  stamp(`driver created; ctx=${next.ctx()?.state ?? 'none'}`)
  return next
    .start()
    .then(() => {
      stamp(`started; ctx=${next.ctx()?.state ?? 'none'}`)
      watchChain()
      const poll = (): void => {
        if (driver !== next) return
        const p = next.latestPitch()
        micLine = p
          ? `pitch midi=${p.midi.toFixed(1)} rms=${p.rms.toFixed(3)} conf=${p.conf.toFixed(2)}`
          : `listening, no pitch yet; level=${next.latestLevel().toFixed(4)}`
        requestAnimationFrame(poll)
      }
      poll()
    })
    .catch((err: unknown) => {
      stamp(`FAILED: ${micErrorLine(err)}`)
      console.error('[merc-probe mic]', err)
    })
}

if (micMode) {
  const panel = document.createElement('div')
  panel.style.cssText =
    'position:fixed;right:12px;bottom:10px;font:12px/1.4 monospace;color:#cfd6dc;text-align:right'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Start mic'
  button.style.cssText = 'font:14px monospace;padding:8px 12px;margin-top:6px'
  const rows = document.createElement('div')
  panel.append(rows, button)
  document.body.append(panel)
  button.addEventListener('click', () => {
    // Meter only once the grant has landed; see startMeters.
    void restart().then(() => startMeters(rows))
  })
}

let last = performance.now()
let frozen = false
let sweepPhase = 0
const tick = (now: number): void => {
  let dt = (now - last) / 1000
  last = now
  if (freezeAt !== null) {
    // One big step to the asked-for time, then hold still.
    dt = frozen ? 0 : freezeAt
    frozen = true
  }

  // The voice wins whenever there is one; the slider takes over the
  // moment it is touched, and a sweep runs when neither is driving.
  const heard = driver?.latestPitch() ?? null
  if (heard !== null) {
    shapeFromVoice = true
    sweeping = false
    setShapeT(tFor(heard.midi, voiceRange))
  } else if (sweeping) {
    sweepPhase += dt * 0.35
    setShapeT((1 - Math.cos(sweepPhase * Math.PI * 2)) / 2)
  }
  setGaugeT(shapeT)
  // With no mic running the gauge is "heard" so the slider reads lit;
  // once a driver exists, silence greys it, as the world will.
  setGaugeHeard(driver === null || heard !== null)

  r.render(view, dt)
  const body = silhouetteFor(shapeT, sweep)
  const shapeLine =
    `t=${shapeT.toFixed(3)} ${shapeFromVoice ? '(voice)' : sweeping ? '(sweep)' : '(held)'}` +
    `  ${body.height.toFixed(2)}m tall x ${body.width.toFixed(2)}m wide` +
    `  sweep ${sweep.flat}-${sweep.tall}m  range ${voiceRange.lowMidi}-${voiceRange.highMidi}`
  hud.textContent = `${r.backend()}  clip=${clip}${freezeAt !== null ? `  t=${freezeAt}` : ''}  x=${mercX}\n${shapeLine}${micMode ? `\nmic: ${micLine || 'press Start mic'}${chain ? `\n     ${chain}` : ''}` : ''}`
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
