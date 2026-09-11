// ============================================================
// A three-line render for the shell's own suites
// ============================================================
//
// Deliberately not `@solidjs/testing-library`: this package does not declare
// it, and a test that reaches through the workspace for a dependency its own
// package.json does not name is one `pnpm install --filter` away from
// failing in CI for a reason nobody can see from here. `render` from
// solid-js/web is a dependency this package DOES declare.

import type { JSX } from 'solid-js'
import { render } from 'solid-js/web'

export interface RenderedShell {
  container: HTMLElement
  unmount: () => void
}

export function renderShell(code: () => JSX.Element): RenderedShell {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const dispose = render(code, container)
  return {
    container,
    unmount: () => {
      dispose()
      container.remove()
    },
  }
}
