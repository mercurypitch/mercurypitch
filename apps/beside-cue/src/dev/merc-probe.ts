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
//   /merc-probe.html?mic=1              the mic, without the game: runs the
//                                       sing driver as the stage does, prints
//                                       each step, and METERS EVERY INPUT so
//                                       a silent one is visible rather than
//                                       inferred (see below)
//
// Keys 1-5 switch clips live. The HUD prints the backend and what is
// playing, so a screenshot documents itself.

import { micManager } from '@irchiinnuss/pitch-engine'
import { createSingDriver } from '../games/glass/drivers/sing'
import type { InteractionDriver } from '../games/glass/drivers/types'
import { micErrorLine } from '../games/glass/mic-error'
import type { HallwayView } from '../games/glass3d/render/Hallway3D'
import { createHallway3D } from '../games/glass3d/render/Hallway3D'
import { WORLD3D_CONFIG } from '../games/glass3d/world3d-config'

const CLIPS = ['listen', 'sing', 'celebrate', 'move', 'fall'] as const

const params = new URLSearchParams(window.location.search)
let clip: string = params.get('clip') ?? 'listen'
const freezeAt = params.has('t') ? Number(params.get('t')) : null
const mercX = Number(params.get('x') ?? '-0.55')
const micMode = params.has('mic')

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

const startMeters = async (row: HTMLDivElement): Promise<void> => {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'audioinput',
  )
  const meters: Meter[] = []
  const context = new AudioContext()
  await context.resume()

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
            restart()
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

const restart = (): void => {
  const t0 = performance.now()
  const stamp = (msg: string): void => {
    micLine = `${msg} (+${Math.round(performance.now() - t0)}ms)`
    console.log(`[merc-probe mic] ${micLine}`)
  }
  driver?.stop()
  const next = createSingDriver('merc-probe')
  driver = next
  stamp(`driver created; ctx=${next.ctx()?.state ?? 'none'}`)
  void next
    .start()
    .then(() => {
      stamp(`started; ctx=${next.ctx()?.state ?? 'none'}`)
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
    restart()
    void startMeters(rows)
  })
}

let last = performance.now()
let frozen = false
const tick = (now: number): void => {
  let dt = (now - last) / 1000
  last = now
  if (freezeAt !== null) {
    // One big step to the asked-for time, then hold still.
    dt = frozen ? 0 : freezeAt
    frozen = true
  }
  r.render(view, dt)
  hud.textContent = `${r.backend()}  clip=${clip}${freezeAt !== null ? `  t=${freezeAt}` : ''}  x=${mercX}${micMode ? `\nmic: ${micLine || 'press Start mic'}` : ''}`
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
