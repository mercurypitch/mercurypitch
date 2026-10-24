// ============================================================
// OpeningTakeover: the hook wired to the real plan, the real account check and the real pull
// ============================================================
//
// useOpeningTakeover.test.ts holds the hook to its rules over doubles; this is
// the component App mounts, which fills the seams with the real thing: the
// plan store (the layer it opens is the store's own mode), the account check,
// the settings service's pull and the build flag. Only the account and the
// pull are stood in for here, since each is a network and a token. So the one
// table below is a table of "each thing App or the build gives it reaches the
// hook", and the rules the hook applies to them are the hook's own tests.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_LINES, NOW, TYPED } from './plan-sync.fixture'

const world = vi.hoisted(() => ({
  native: false,
  upgraded: false,
  pulled: async (): Promise<void> => undefined,
}))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  get IS_NATIVE_BUILD() {
    return world.native
  },
}))
vi.mock('@/db/services/auth-service', () => ({
  hasUpgradedAccount: () => world.upgraded,
}))
vi.mock('@/db/services/settings-service', () => ({
  settingsPulled: async () => world.pulled(),
}))

/** A page load: fresh modules over whatever storage the last one left. */
async function load() {
  vi.resetModules()
  const store = await import('./plan-store')
  const { OpeningTakeover } = await import('./OpeningTakeover')
  return { store, OpeningTakeover }
}

type Loaded = Awaited<ReturnType<typeof load>>
type Props = Parameters<Loaded['OpeningTakeover']>[0]

/** A returning visitor with nothing due; each case changes what it is about. */
function props(change: Partial<Props> = {}): Props {
  return {
    routeSuppressed: false,
    welcomeDue: false,
    whatsNewDue: () => false,
    announceWhatsNew: vi.fn(),
    onDecided: vi.fn(),
    ...change,
  }
}

/** Lets what is waiting on a promise or a timer of zero run. */
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  localStorage.clear()
  world.native = false
  world.upgraded = false
  // A pull that never lands: only a visitor who is waited for notices.
  world.pulled = async () => new Promise<void>(() => undefined)
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('OpeningTakeover', () => {
  it('draws nothing of its own', async () => {
    const { OpeningTakeover } = await load()

    const { container } = render(() => <OpeningTakeover {...props()} />)

    expect(container.innerHTML).toBe('')
  })

  it.each<{
    given: string
    setUp?: (store: Loaded['store']) => void
    props?: Partial<Props>
    layer: 'existing' | null
    announced: number
    decided: number
  }>([
    {
      given:
        "nothing due and no account, so no wait: the existing user's layer opens (R66's store mode), and it has decided",
      layer: 'existing',
      announced: 0,
      decided: 1,
    },
    {
      given: 'the arrival App read at its mount: nothing opens',
      props: { routeSuppressed: true },
      layer: null,
      announced: 0,
      decided: 1,
    },
    {
      given: "First Light's due flag: nothing opens, not even What's New",
      props: { welcomeDue: true, whatsNewDue: () => true },
      layer: null,
      announced: 0,
      decided: 1,
    },
    {
      given:
        "What's New's due flag and its opener, with the plan on file: it is announced",
      setUp: (store) => {
        store.savePlanAnswers(TYPED, NO_LINES, null, NOW)
      },
      props: { whatsNewDue: () => true },
      layer: null,
      announced: 1,
      decided: 1,
    },
    {
      given: 'the build flag: nothing opens in the native build',
      setUp: () => {
        world.native = true
      },
      layer: null,
      announced: 0,
      decided: 1,
    },
    {
      given:
        'the account check and the pull: a signed-in singer is waited for while the pull is out',
      setUp: () => {
        world.upgraded = true
      },
      layer: null,
      announced: 0,
      decided: 0,
    },
    {
      given:
        'the account check and the pull: a signed-in singer is asked once the pull has landed with none',
      setUp: () => {
        world.upgraded = true
        world.pulled = async () => undefined
      },
      layer: 'existing',
      announced: 0,
      decided: 1,
    },
  ])('given $given', async (row) => {
    const { store, OpeningTakeover } = await load()
    row.setUp?.(store)
    const given = props(row.props)

    render(() => <OpeningTakeover {...given} />)
    await settle()

    expect(store.planLayerMode()).toBe(row.layer)
    expect(given.announceWhatsNew).toHaveBeenCalledTimes(row.announced)
    expect(given.onDecided).toHaveBeenCalledTimes(row.decided)
  })
})
