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
// The stage's glass (the lane's panel, its notes, the singer's dot) is
// painted once per screen size onto canvases of its own and stamped from
// then on (src/lib/tv-stage/sprites.ts); the view keeps them across frames.
//
// A message this page does not understand is dropped (protocol.ts). Opened
// in a browser it shows the idle screen and waits, which is how it can be
// looked at without a TV: call `__mpStage.receive` from the console.

import { readTvStageMessage } from '@/lib/tv-stage/protocol'
import { startTvStageLoop } from '@/lib/tv-stage/stage-loop'

declare global {
  interface Window {
    /** Where the app hands this page the room's messages. */
    __mpStage?: { receive: (json: string) => void }
  }
}

const canvas = document.getElementById('stage')
const stage = startTvStageLoop(
  canvas instanceof HTMLCanvasElement ? canvas : null,
)

window.__mpStage = {
  receive: (json) => {
    const message = readTvStageMessage(json)
    if (message !== null) stage.receive(message)
  },
}
