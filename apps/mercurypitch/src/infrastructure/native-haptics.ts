// ============================================================
// Native haptics — the rooms' ticks, on the device
// ============================================================
//
// The premium rooms under `src/` fire their haptics through `@/lib/haptics`
// (a wave or an arch lit, a note landed, a hold kept, a full run), whose
// web implementation is `navigator.vibrate`: an Android browser has it,
// iOS WebKit does not, so on an iPhone every one of them did nothing.
// Installed once, from `main.tsx`, the device's own haptics take its place
// (Warm-up 13f), the same three moments the shell's own controls use: a
// light impact, a success, a warning; and the Ear Lab's seal, the heaviest
// impact, for a calibration marked.
//
// Like native-shell.ts, it reaches the plugin only through the platform
// package's wrappers, which answer a device without it by doing nothing,
// never by throwing into a room.

import { hapticSeal, hapticSuccess, hapticTap, hapticWarning, } from '@irchiinnuss/mobile-runtime/platform'
import { installHaptics } from '@/lib/platform'

/** A haptic is never worth an unhandled rejection. */
const quietly = (felt: Promise<void>): void => {
  void felt.catch(() => undefined)
}

/** Install the device's haptics for every web-side caller; returns the release. */
export function installNativeHaptics(): () => void {
  return installHaptics({
    tapLight: () => quietly(hapticTap()),
    success: () => quietly(hapticSuccess()),
    warning: () => quietly(hapticWarning()),
    seal: () => quietly(hapticSeal()),
  })
}
