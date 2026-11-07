// ============================================================
// ConstellationScreen — Voice Constellation, as the native app draws it
// ============================================================
//
// The web route draws the map in a full-screen dialog with a bar of its own
// (VoiceConstellationSurface). Opened from the app, that dialog covered the
// shell, and its bar sat at the very top of the screen: on an iPhone the
// mark that leads back and the Close beside it were under the status bar
// and the Dynamic Island, and the app's own way back was hidden under it.
//
// Here the map is a screen pushed over Progress, under the shell's own bar,
// which keeps below the status bar (`--safe-top`) and carries a 44 px Back
// (PushedScreen.tsx). Android's back closes a portrait's details first and
// then the screen (registerPushedBack); on an iPhone a swipe in from the
// left edge takes it off too (ShellScreens.tsx, `swipeBack`).
//
// The map, its words and its read of the saved voiceprints are the web's
// own (VoiceConstellationMap.tsx, useVoiceConstellation.ts). The bundle has
// no `/mirror` page, so this page offers no link to one, as the Progress
// page leaves out its "Map my voice again" (progress-lines.ts inAppAction).

import type { JSX } from 'solid-js'
import { onCleanup } from 'solid-js'
import './constellation.css'
import { useVoiceConstellation } from '@/features/voice-constellation/useVoiceConstellation'
import { VoiceConstellationPage } from '@/features/voice-constellation/VoiceConstellationMap'
import { registerPushedBack } from '../shell-navigation'

export function ConstellationScreen(): JSX.Element {
  const state = useVoiceConstellation()

  onCleanup(
    registerPushedBack(() => {
      if (state.selectedLegend() === undefined) return false
      state.closeLegend()
      return true
    }),
  )

  return (
    <div data-testid="native-constellation">
      <VoiceConstellationPage state={state} class="mp-constellation" />
    </div>
  )
}
