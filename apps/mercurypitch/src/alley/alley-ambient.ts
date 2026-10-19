// ============================================================
// The alley's one ambient, bound to the device
// ============================================================
//
// The doors' sound (alley-audio.ts) with the device's parts handed in: its
// AudioContext, the packaged files' loader, the audio unlock and the
// Developer screen's report. Made on first use and kept for the app's
// life. RoomsAlley starts and stops it inside a door tap; the Developer
// screen's Audio panel reads it.

import { fetchAssetRead } from '@irchiinnuss/mobile-runtime/asset-fetch'
import { audioReporter } from '@/lib/audio-diagnostics'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import type { AlleyAmbient } from './alley-audio'
import { createAlleyAmbient } from './alley-audio'

let instance: AlleyAmbient | null = null

/** The alley's one ambient. Exported for the Developer screen's Audio panel. */
export function ambient(): AlleyAmbient {
  instance ??= createAlleyAmbient({
    createContext: () => {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      return Ctor === undefined ? null : new Ctor()
    },
    // Not `response.ok`: iOS serves a packaged .m4a with status 0 and the
    // whole body (@irchiinnuss/mobile-runtime/asset-fetch). The status is
    // kept for the report, which is the Developer screen's Audio section.
    load: (url) => fetchAssetRead(url),
    activate: (target) => activateAudioPlayback(target),
    report: audioReporter('alley'),
  })
  return instance
}

/** The ambient if it has been made, else null: asking makes none. */
export function madeAmbient(): AlleyAmbient | null {
  return instance
}
