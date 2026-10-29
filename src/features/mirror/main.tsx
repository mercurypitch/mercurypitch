// ============================================================
// Voice Mirror — standalone entry point (mirror.html).
//
// A separate Vite entry, not a chunk of the main app: the mirror
// must hit interactive fast on mobile 4G, so it mounts its own
// tiny Solid tree and imports none of the app shell, no ONNX,
// and no model weights.
// ============================================================

// quiet-console comes before every app module: it silences production
// console narration before anything can log (src/lib/quiet-console.ts).
import { render } from 'solid-js/web'
import '@/lib/quiet-console'
import './mirror.css'
import { setupConsent } from '@/components/ConsentBanner'
import { armDeveloperConsole } from '@/components/developer-console-arming'
import { consumeGoogleRedirect } from '@/db/services/auth-service'
import { adoptAfterGoogleSignup } from '@/db/services/voiceprint-service'
import { announceVoiceDiagnostics, initVoiceDiagnostics, } from '@/features/voice-control/voice-diagnostics'
import { leaveMirrorSubdomain } from '@/lib/mirror-subdomain'
import { takeGoogleLanding } from './account-ask'
import { mirrorEntryIntent } from './entry-intent'
import { MirrorAccountHostSlot } from './MirrorAccountAsk'
import { MirrorApp } from './MirrorApp'

// mirror.* is the old address. The worker redirects the paths it sees, and
// this catches the ones the asset layer serves without it: the visitor goes
// to the same path on the apex before anything boots, so nothing here is
// counted twice (lib/mirror-subdomain.ts).
if (!leaveMirrorSubdomain(window.location)) boot()

function boot(): void {
  // Voice control and the on-device console are per DOCUMENT, and several rooms
  // here are separate documents — walking into Karaoke Night is a full page
  // load. Wiring only the main entry left the one transition worth watching
  // unrecorded (2026-09-10).
  // Synchronously, before anything can start listening. Voice control resumes
  // from a saved preference during boot, so a recorder that waited even one
  // tick missed the session it was built to watch — which is what happened on
  // the 2026-09-10 retest: Karaoke Night logged a page turn with `live=true`
  // and not one line about the session that made it live.
  initVoiceDiagnostics()

  // The flag is read inline rather than imported from `lib/defaults`, because
  // that module is pinned into the `pitch-core` chunk and one constant would
  // drag the whole thing into this room's first paint. Vite substitutes the
  // literal either way, so a normal build still folds this to `if (false)` and
  // never bundles the module.
  if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true') {
    void import('@/components/PortableConsole').then((m) => {
      m.setupPortableConsole()
      // The capture missed the opening lines by a tick; say them again.
      announceVoiceDiagnostics()
    })
  }

  // The shipping in-app console, on whichever page the bug is on, toggled from
  // Settings' danger zone. Nothing of it loads until somebody turns it on; the
  // buffer behind it is filled by initGlobalErrorHandlers either way. Unrelated
  // to the portable console above, which is dev-only and must never reach a
  // build.
  armDeveloperConsole()

  // The Mirror is the ad landing page: boot Consent Mode + the cookie banner
  // before the tag loads, so EEA/UK/CH clicks are gated from the first paint.
  setupConsent()

  // A Google sign-in started from the account ask under the results comes back
  // to THIS page, with the session in the fragment (#gauth=...). It is stored
  // before anything renders, so the results' #take-N is back in the address
  // when MirrorApp reads it, and a return that created the account adopts this
  // browser's voiceprints (REQ-VPR-014). These are the main app's own calls,
  // not the rooms' lazy helper (lib/room-google-return): the Mirror's first
  // paint carries the auth and voiceprint layers already, and a third importer
  // would split that helper into a chunk of its own, which took Drum Night's
  // first paint over its boundary (2026-10-11).
  consumeGoogleRedirect()
  void adoptAfterGoogleSignup()
  takeGoogleLanding()

  const root = document.getElementById('root')
  if (root) {
    const entryIntent = mirrorEntryIntent(window.location.pathname)
    render(
      () => (
        <>
          <MirrorApp entryIntent={entryIntent} />
          <MirrorAccountHostSlot />
        </>
      ),
      root,
    )
  }
}
