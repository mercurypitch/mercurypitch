// Which build is on the glass.
// ============================================================
//
// A corner chip on every screen of every non-release build, because the
// question it answers is asked on a device, mid-test, with no console:
// is this the build I just pushed, or the one from this morning?
//
// It is deliberately not conditional on `import.meta.env.DEV`. A CI
// build of a PR branch is production-mode code and is exactly the build
// most likely to be confused with another one; a tagged release is the
// only build whose identity is already obvious, so it is the only one
// that hides the chip.

import { Show } from 'solid-js'
import { BUILD, buildLabel } from '@/build-info'

export function BuildStamp() {
  return (
    <Show when={BUILD.channel !== 'release'}>
      <p
        class="build-stamp"
        classList={{ 'build-stamp--dirty': BUILD.dirty }}
        title={
          BUILD.dirty
            ? 'Built from a working tree with uncommitted changes — the sha does not reproduce it'
            : undefined
        }
      >
        {buildLabel()}
      </p>
    </Show>
  )
}
