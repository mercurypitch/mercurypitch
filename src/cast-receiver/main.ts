// Mercury Pitch — the Cast receiver: the Karaoke room's stage on a Google
// Cast device.
//
// A Cast device loads this page (cast-receiver.html, at /cast-receiver)
// when a sender starts a session with one of the registered receiver
// applications (src/lib/cast-receiver/cast-config.ts). It is the same stage
// the iPhone's second screen draws (src/lib/tv-stage/), fed by a Cast
// sender instead of the app: Google's Web Receiver SDK, loaded by the page
// before this script, carries the room's messages on the stage's own
// namespace (src/lib/cast-receiver/). Like the iPhone's stage page it loads
// nothing of the app: no fonts, no stores, no storage, no analytics.
//
// In a browser with no SDK it shows the idle screen and takes messages from
// the console (local-host.ts). `?diagnostics` draws the meter from the
// start, for a device with no sender of ours to turn it on.

import './cast-receiver.css'
import type { CafFramework } from '@/lib/cast-receiver/caf-host'
import { startCafHost } from '@/lib/cast-receiver/caf-host'
import type { CapabilityScope, CastCapabilities, } from '@/lib/cast-receiver/capabilities'
import { probeCastCapabilities } from '@/lib/cast-receiver/capabilities'
import { drawCastDiagnostics } from '@/lib/cast-receiver/diagnostics-paint'
import type { HeapSource } from '@/lib/cast-receiver/frame-meter'
import { createFrameMeter } from '@/lib/cast-receiver/frame-meter'
import type { LocalCastControls } from '@/lib/cast-receiver/local-host'
import { createLocalHost } from '@/lib/cast-receiver/local-host'
import type { CastReceiverHost } from '@/lib/cast-receiver/receiver'
import { runCastReceiver } from '@/lib/cast-receiver/receiver'
import { startTvStageLoop } from '@/lib/tv-stage/stage-loop'

declare global {
  interface Window {
    /** Google's Web Receiver SDK, on a Cast device. */
    cast?: { framework?: CafFramework }
    /** The console's way in, in a browser with no SDK. */
    __mpCast?: LocalCastControls
  }
}

const meter = createFrameMeter(performance as HeapSource)
let diagnostics = new URLSearchParams(window.location.search).has('diagnostics')
let capabilities: CastCapabilities | null = null

const probe = async (): Promise<CastCapabilities> => {
  capabilities = await probeCastCapabilities(
    window as unknown as CapabilityScope,
  )
  return capabilities
}

const canvas = document.getElementById('stage')
const stage = startTvStageLoop(
  canvas instanceof HTMLCanvasElement ? canvas : null,
  {
    afterDraw: (ctx, size, frameTime) => {
      meter.tick(frameTime)
      if (diagnostics)
        drawCastDiagnostics(ctx, size, meter.reading(), capabilities)
    },
  },
)

/** The console's host, for a browser with no SDK. */
function consoleHost(): CastReceiverHost {
  const local = createLocalHost()
  window.__mpCast = local.controls
  return local.host
}

const framework = window.cast?.framework
const host = framework === undefined ? consoleHost() : startCafHost(framework)

runCastReceiver(host, {
  stage,
  now: () => Date.now(),
  probe,
  meter,
  setDiagnostics: (on) => {
    diagnostics = on
    if (on && capabilities === null) void probe()
  },
  every: (task, ms) => {
    const id = setInterval(task, ms)
    return () => {
      clearInterval(id)
    }
  },
  after: (task, ms) => {
    const id = setTimeout(task, ms)
    return () => {
      clearTimeout(id)
    }
  },
})

if (diagnostics) void probe()
