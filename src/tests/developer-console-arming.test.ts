// ============================================================
// The developer console loads when it is switched on, and not before
// ============================================================
//
// Every entry arms it, and for almost everybody the answer is "not today" —
// so an unconditional `import('@/components/ConsoleLog')` was pulling the
// panel, its stylesheet and its icons into every production page load, and
// appending a host to `<body>` on a page that would never show one. The
// standalone rooms spend real effort keeping their first paint empty; a debug
// panel is the last thing that should undo it.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const loaded = vi.hoisted(() => ({ count: 0 }))

vi.mock('@/components/ConsoleLog', () => ({
  setupDeveloperConsole: () => {
    loaded.count += 1
  },
}))

import { armDeveloperConsole, DEVELOPER_CONSOLE_KEY, } from '@/lib/developer-console'

/** The dynamic import resolves on a microtask; let it. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  loaded.count = 0
  localStorage.clear()
})

describe('arming the developer console', () => {
  it('loads nothing while the toggle is off', async () => {
    armDeveloperConsole()
    await settle()

    expect(loaded.count).toBe(0)
  })

  it('loads nothing when the flag was never written', async () => {
    armDeveloperConsole()
    await settle()

    expect(localStorage.getItem(DEVELOPER_CONSOLE_KEY)).toBeNull()
    expect(loaded.count).toBe(0)
  })

  it('loads and mounts when the flag says the console is on', async () => {
    // The shape `createPersistedSignal` writes a boolean in — a mismatch here
    // is the whole feature silently not arming.
    localStorage.setItem(DEVELOPER_CONSOLE_KEY, 'true')

    armDeveloperConsole()
    await settle()

    expect(loaded.count).toBe(1)
  })

  it('is not fooled by a value that merely looks true', async () => {
    localStorage.setItem(DEVELOPER_CONSOLE_KEY, '"true"')

    armDeveloperConsole()
    await settle()

    expect(loaded.count).toBe(0)
  })
})
