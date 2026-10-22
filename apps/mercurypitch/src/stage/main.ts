// Mercury Pitch native — the TV stage page.
//
// The Karaoke room's stage on a TV connected to the iPhone, drawn in the
// TV's own landscape while the phone stays the room (TVStage.swift puts
// this page in a web view of its own on the TV's screen). It is NOT the
// app: no Capacitor, no plugins, no storage, no audio. It draws what the
// room sends and nothing else (src/lib/tv-stage/): the app hands each
// message to `window.__mpStage.receive` as JSON, and every frame of the
// TV's display draws the state those messages built.
//
// A message this page does not understand is dropped (protocol.ts). Opened
// in a browser it shows the idle screen and waits, which is how it can be
// looked at without a TV: call `__mpStage.receive` from the console.

import type { TvStageState } from '@/lib/tv-stage/model'
import { applyTvStageMessage, EMPTY_TV_STAGE } from '@/lib/tv-stage/model'
import { readTvStageMessage } from '@/lib/tv-stage/protocol'
import { drawTvStage } from '@/lib/tv-stage/renderer'

declare global {
  interface Window {
    /** Where the app hands this page the room's messages. */
    __mpStage?: { receive: (json: string) => void }
  }
}

let state: TvStageState = EMPTY_TV_STAGE

window.__mpStage = {
  receive: (json) => {
    const message = readTvStageMessage(json)
    if (message !== null) state = applyTvStageMessage(state, message)
  },
}

const canvas = document.getElementById('stage')
const ctx = canvas instanceof HTMLCanvasElement ? canvas.getContext('2d') : null

/** The canvas's backing store at the screen's own pixels. */
function fit(target: HTMLCanvasElement): { width: number; height: number } {
  const scale = window.devicePixelRatio || 1
  const width = Math.round(target.clientWidth * scale)
  const height = Math.round(target.clientHeight * scale)
  if (target.width !== width) target.width = width
  if (target.height !== height) target.height = height
  return { width, height }
}

function frame(): void {
  if (canvas instanceof HTMLCanvasElement && ctx !== null) {
    drawTvStage(ctx, state, Date.now(), fit(canvas))
  }
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
