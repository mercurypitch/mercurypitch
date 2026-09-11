// ============================================================
// RoomVoiceControl — voice control for a standalone room, loaded late
// ============================================================
//
// The listener, the pill, the "what can I say" overlay, the V shortcut and
// the room's command set, in one component with a default export so a room
// can reach it through `lazy()`.
//
// That indirection is the whole point. Voice control's static graph is
// expensive: the command set reaches the app's router and half its stores
// (karaoke playlists, UVR sessions, settings, UI), the HUD reaches the
// practice timer, and the controller reaches the local Whisper engine and
// its speech-to-text service. In the studio all of that is already loaded.
// In a standalone room it is a chunk nobody has paid for, and
// `assert-piano-night-bundle.mjs` and its drum twin fail the build rather
// than let a room quietly start dragging the whole application into its
// first paint.
//
// Nothing here is first-paint work: a room cannot be spoken to before it is
// on screen. So it arrives a tick late and costs the room nothing.
//
// Karaoke Night and Guitar Night still wire the same pieces by hand — they
// have no bundle audit to answer to, and Guitar Night docks the pill into
// its top bar rather than floating it.

import { createSignal, onCleanup, Show } from 'solid-js'
import { createLeaveForStudioVoiceCommands, createVoiceHelpCommands, } from './room-navigation-commands'
import { useVoiceControlController } from './useVoiceControlController'
import { useVoiceToggleKey } from './useVoiceToggleKey'
import { registerVoiceCommands } from './voice-command-registry'
import { VoiceCommandsOverlay } from './VoiceCommandsOverlay'
import { VoiceControlHud } from './VoiceControlHud'

export default function RoomVoiceControl() {
  const controller = useVoiceControlController()
  const [showHelp, setShowHelp] = createSignal(false)
  useVoiceToggleKey(controller.toggle, () => setShowHelp(true))

  onCleanup(
    registerVoiceCommands(() =>
      createVoiceHelpCommands({ openVoiceHelp: () => setShowHelp(true) }),
    ),
  )
  // The way out, spoken. A standalone document never loads the shell's tab
  // set, so without this a room reached by voice is a room voice cannot
  // leave — which is what Piano Night and Drum Night were until now.
  onCleanup(registerVoiceCommands(() => createLeaveForStudioVoiceCommands()))

  return (
    <>
      <VoiceControlHud
        controller={controller}
        onShowCommands={() => setShowHelp(true)}
      />
      <Show when={showHelp()}>
        <VoiceCommandsOverlay close={() => setShowHelp(false)} />
      </Show>
    </>
  )
}
