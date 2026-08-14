// ============================================================
// MercurySingStage — engine lifecycle, wired to the panel
// ============================================================
//
// Mounted (lazily) inside <Show when={mercurySingOpen()}> by App and the
// standalone Karaoke Night page, so mounting IS opening: the engine spins
// up in the component body and everything releases on unmount. All logic
// lives in the engine and all pixels in MercurySingPanel — this file only
// joins them and owns the keyboard.

import { onCleanup, onMount } from 'solid-js'
import { lastHeardSpeech } from '@/features/voice-control/voice-command-registry'
import { createMercurySingEngine, WHEEL_SLOTS } from './mercury-sing-engine'
import { closeMercurySing, setMercurySingPickHandler, } from './mercury-sing-store'
import { MercurySingPanel } from './MercurySingPanel'

export function MercurySingStage() {
  const engine = createMercurySingEngine()
  setMercurySingPickHandler(engine.pick)
  onCleanup(() => {
    setMercurySingPickHandler(null)
    engine.dispose()
  })

  // Capture phase so Escape closes THIS surface, not a modal underneath.
  // 1-4 pick a wheel quadrant, mirroring "sing number one".
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeMercurySing()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const slot = Number(e.key)
    if (Number.isInteger(slot) && slot >= 1 && slot <= WHEEL_SLOTS) {
      if (engine.pick(slot - 1)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }
  onMount(() => window.addEventListener('keydown', handleKey, true))
  onCleanup(() => window.removeEventListener('keydown', handleKey, true))

  return (
    <MercurySingPanel
      status={engine.status()}
      candidates={engine.candidates()}
      leaderId={engine.armed().leaderId}
      armedFraction={engine.armed().armedFraction}
      elapsedSec={engine.elapsedSec()}
      trail={engine.trail()}
      library={engine.library()}
      libraryCount={engine.libraryCount()}
      fingerprinting={engine.fingerprinting()}
      frozen={engine.frozen()}
      heard={lastHeardSpeech()}
      onPick={(index) => engine.pick(index)}
      onOpenLibrary={(sessionId) => engine.openFromLibrary(sessionId)}
      onClose={() => closeMercurySing()}
    />
  )
}
