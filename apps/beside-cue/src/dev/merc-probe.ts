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
//   /merc-probe.html?mic=1              a Start button that runs the sing
//                                       driver as the stage does, and prints
//                                       each step; the mic without the game
//
// Keys 1-5 switch clips live. The HUD prints the backend and what is
// playing, so a screenshot documents itself.

import { createSingDriver } from '../games/glass/drivers/sing'
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

// Mic diagnostics: the same driver, the same order of calls as
// HallwayStage.startMic, with each boundary logged so a failure names
// the layer it happened in instead of arriving as silence.
let micLine = ''
if (micMode) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Start mic'
  button.style.cssText =
    'position:fixed;right:12px;bottom:10px;font:14px monospace;padding:8px 12px'
  document.body.append(button)
  button.addEventListener('click', () => {
    const t0 = performance.now()
    const stamp = (msg: string): void => {
      micLine = `${msg} (+${Math.round(performance.now() - t0)}ms)`
      console.log(`[merc-probe mic] ${micLine}`)
    }
    const driver = createSingDriver('merc-probe')
    stamp(`driver created; ctx=${driver.ctx()?.state ?? 'none'}`)
    void driver
      .start()
      .then(() => {
        stamp(`started; ctx=${driver.ctx()?.state ?? 'none'}`)
        ;(window as unknown as Record<string, unknown>).__probe = { driver }
        setInterval(() => {
          const p = driver.latestPitch()
          console.log(
            `[merc-probe mic] level=${driver.latestLevel().toFixed(4)} pitch=${p ? p.midi.toFixed(1) : 'none'}`,
          )
        }, 1000)
        const poll = (): void => {
          const p = driver.latestPitch()
          micLine = p
            ? `pitch midi=${p.midi.toFixed(1)} rms=${p.rms.toFixed(3)} conf=${p.conf.toFixed(2)}`
            : `started, listening... level=${driver.latestLevel().toFixed(4)}`
          requestAnimationFrame(poll)
        }
        poll()
      })
      .catch((err: unknown) => {
        stamp(`FAILED: ${micErrorLine(err)}`)
        console.error('[merc-probe mic]', err)
      })
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
