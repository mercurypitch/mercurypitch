// ============================================================
// App's takeover glue, run as App writes it
// ============================================================
//
// App is too large a world to render, and app-plan-pause.test.ts reads its
// source for the shape of what it wires. Two pieces of that wiring are rules
// that only running them proves, so this lifts them out of App.tsx and runs
// them: App's own lines, not a copy of them.
//
// - What a visit's arrival keeps the takeover away from (`takeoverSuppressed`),
//   for a visitor who is returning and one who is not. A lesson's practice link
//   asked for its room whoever follows it, and `lessonArrival()` is set only
//   for the visitor whose welcome the link spent.
// - What holds the tour offer back (the pause and `onDecided`). The takeover
//   opens its layer through the store it imported itself, and the host App
//   draws the layer by reads the store only once its own import has landed, a
//   little later. The pause has to hold across that gap: a production build
//   measured the order (open, decide, the host sees it), and the offer ran in
//   the gap and was spent under the layer.
//
// When a line of App's stops running here (a name changes, a line moves), the
// failure names it, and `initializerOf` and `givenToMount` are where to look.
// A `ReferenceError` out of `new Function` is a name App's line now uses that
// the run was not given: add it to the scope literal it runs over, in
// `staysAway` or in `loadTakeover`.

import { cleanup, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { createEffect, createRoot, createSignal } from 'solid-js'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routeSuppressesAnnouncement } from '@/features/whats-new/whats-new-release'
import { parseHash } from '@/lib/hash-router'
import { lessonFromSearch } from '@/lib/lesson-marker'
import { pickOpeningTakeover } from './opening-takeover'
import type { PlanStoreModule } from './plan-layer-host'
import { createPlanLayerHost } from './plan-layer-host'

vi.mock('@/db/services/auth-service', () => ({
  hasUpgradedAccount: () => false,
}))
vi.mock('@/db/services/settings-service', () => ({
  settingsPulled: async () => undefined,
}))

// ── App's lines, lifted out ────────────────────────────────────────────

const source = ts.createSourceFile(
  'src/App.tsx',
  readFileSync('src/App.tsx', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
const nodes: ts.Node[] = []
const gather = (node: ts.Node): void => {
  nodes.push(node)
  ts.forEachChild(node, gather)
}
gather(source)

/** The text of App's one `const name = ...`. */
function initializerOf(name: string): string {
  const found = nodes.filter(
    (node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && node.name.getText(source) === name,
  )
  const initializer = found.length === 1 ? found[0].initializer : undefined
  if (initializer === undefined) {
    throw new Error(`App.tsx has no single "const ${name} = ..."`)
  }
  return initializer.getText(source)
}

/** The text of what App hands the takeover's mount as `name`. */
function givenToMount(name: string): string {
  const attribute = nodes
    .filter(
      (node): node is ts.JsxSelfClosingElement =>
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(source) === 'OpeningTakeoverMount',
    )
    .flatMap((mount) => mount.attributes.properties.filter(ts.isJsxAttribute))
    .find((candidate) => candidate.name.getText(source) === name)
  const given = attribute?.initializer
  if (
    given === undefined ||
    !ts.isJsxExpression(given) ||
    given.expression === undefined
  ) {
    throw new Error(
      `App.tsx does not hand the mount "${name}" as an expression`,
    )
  }
  return given.expression.getText(source)
}

/** What App holds the tour offer back for: the `const` its one `<TourChipHost>` is handed as `paused`. */
function offerPause(): string {
  const attribute = nodes
    .filter(
      (node): node is ts.JsxSelfClosingElement =>
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(source) === 'TourChipHost',
    )
    .flatMap((host) => host.attributes.properties.filter(ts.isJsxAttribute))
    .find((candidate) => candidate.name.getText(source) === 'paused')
  const given = attribute?.initializer
  if (
    given === undefined ||
    !ts.isJsxExpression(given) ||
    given.expression === undefined ||
    !ts.isIdentifier(given.expression)
  ) {
    throw new Error('App.tsx does not hand the chip host a named "paused"')
  }
  return initializerOf(given.expression.text)
}

/** Runs a piece of App's source, with the names it reads from the code around it. */
function asWritten(code: string, scope: Record<string, unknown>): unknown {
  const js = ts.transpileModule(`(${code})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const run = new Function(...Object.keys(scope), `return ${js}`) as (
    ...given: unknown[]
  ) => unknown
  return run(...Object.values(scope))
}

/** Lets what waits on a promise or a timer of zero run. */
const settle = async (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

let disposers: (() => void)[] = []

/** A reactive root that is disposed when the test ends. */
function inRoot<T>(build: () => T): T {
  return createRoot((dispose) => {
    disposers.push(dispose)
    return build()
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  for (const dispose of disposers) dispose()
  disposers = []
  window.history.replaceState(null, '', '/')
})

// ── The arrival ────────────────────────────────────────────────────────

const WELCOME_KEY = 'pitchperfect_welcome_version'

/**
 * Does App's takeover stay away from this visit? A visit is a page load: fresh
 * stores over what this device holds, then index.tsx's step-aside for a
 * lesson's link, then App's setup, whose lines run here.
 */
async function staysAway(url: string, returning: boolean): Promise<boolean> {
  if (returning) localStorage.setItem(WELCOME_KEY, '1')
  window.history.replaceState(null, '', url)
  vi.resetModules()
  const onboarding = await import('@/stores/onboarding-store')
  const ui = await import('@/stores/ui-store')
  onboarding.stepAsideForLesson(window.location.search)
  // The seed took: a renamed welcome key would make every row a first visit.
  expect(onboarding.returningVisitor()).toBe(returning)
  const lines = ['arrivalRoute', 'arrivalLesson', 'takeoverSuppressed']
    .map((name) => `const ${name} = ${initializerOf(name)}`)
    .join('\n')
  const run = asWritten(`() => {\n${lines}\nreturn takeoverSuppressed\n}`, {
    parseHash,
    routeSuppressesAnnouncement,
    lessonFromSearch,
    lessonArrival: onboarding.lessonArrival,
    firstVisitThroughRoom: ui.firstVisitThroughRoom,
  }) as () => boolean
  return run()
}

describe('the visits the takeover stays away from', () => {
  it.each<{ given: string; url: string; returning: boolean; away: boolean }>([
    {
      given: "a first-ever visitor on a lesson's practice link",
      url: '/ear-lab?lesson=02#/ear-lab',
      returning: false,
      away: true,
    },
    {
      given: "a returning visitor on a lesson's practice link",
      url: '/ear-lab?lesson=02#/ear-lab',
      returning: true,
      away: true,
    },
    {
      given: "a returning visitor on the Ascent lesson's link",
      url: '/?lesson=09#/path',
      returning: true,
      away: true,
    },
    {
      given: "a returning visitor on a drill's lesson link",
      url: '/exercises/speed-scales?lesson=04',
      returning: true,
      away: true,
    },
    {
      given: 'a returning visitor on #/plan',
      url: '/#/plan',
      returning: true,
      away: true,
    },
    {
      given: 'a returning visitor back from checkout',
      url: '/#/billing/success',
      returning: true,
      away: true,
    },
    {
      given: "a returning visitor on a restored What's New page",
      url: '/#/whats-new',
      returning: true,
      away: true,
    },
    {
      given: 'a returning visitor behind a marker the app does not read',
      url: '/ear-lab?lesson=29#/ear-lab',
      returning: true,
      away: false,
    },
    {
      given: 'a returning visitor with the marker behind the hash',
      url: '/#/ear-lab?lesson=02',
      returning: true,
      away: false,
    },
    {
      given: 'a returning visitor on a plain visit',
      url: '/',
      returning: true,
      away: false,
    },
    {
      given: "a first-ever visitor on a room's own document",
      url: '/ear-lab#/ear-lab',
      returning: false,
      away: true,
    },
    {
      given: "a returning visitor on a room's own document",
      url: '/ear-lab#/ear-lab',
      returning: true,
      away: false,
    },
  ])('$given: away is $away', async (row) => {
    expect(await staysAway(row.url, row.returning)).toBe(row.away)
  })
})

// ── The welcome a visit is due ─────────────────────────────────────────

/** What one page load showed and what its takeover picked, for a visitor with no plan. */
interface Arrival {
  opens: boolean
  returning: boolean
  pick: string | null
}

/**
 * A page load at `url` over what this device holds: fresh stores, index.tsx's
 * step-aside for a lesson's link, then App's setup, as App writes it: its lines
 * for what the takeover stays away from and the welcome it is told opens, and
 * First Light's own gate, which opens the welcome or, on a room's document,
 * notes that the device has been here.
 */
async function arrive(url: string): Promise<Arrival> {
  cleanup()
  window.history.replaceState(null, '', url)
  vi.resetModules()
  const onboarding = await import('@/stores/onboarding-store')
  const ui = await import('@/stores/ui-store')
  const { useFirstLight } = await import('@/features/onboarding/useFirstLight')
  onboarding.stepAsideForLesson(window.location.search)
  const names = [
    'arrivalRoute',
    'arrivalLesson',
    'takeoverSuppressed',
    'takeoverWelcomeDue',
  ]
  const lines = names
    .map((name) => `const ${name} = ${initializerOf(name)}`)
    .join('\n')
  const told = asWritten(
    `() => {\n${lines}\nreturn [takeoverSuppressed, takeoverWelcomeDue]\n}`,
    {
      parseHash,
      routeSuppressesAnnouncement,
      lessonFromSearch,
      lessonArrival: onboarding.lessonArrival,
      firstVisitThroughRoom: ui.firstVisitThroughRoom,
      firstLightNeverOffered: ui.firstLightNeverOffered,
      showWelcome: ui.showWelcome,
    },
  ) as () => [boolean, boolean]
  const [routeSuppressed, welcomeDue] = told()
  render(() => {
    useFirstLight(() => false)
    return null
  })
  const pick = pickOpeningTakeover({
    native: false,
    routeSuppressed,
    welcomeDue,
    planDue: true,
    whatsNewDue: false,
  })
  return {
    opens: onboarding.flowOpen(),
    returning: onboarding.returningVisitor(),
    pick,
  }
}

// First Light opens by itself on the home document and not on a room's entry
// document (src/lib/first-light-landing.ts). A device's first visit there is
// the room's: the takeover stays away, so no plan or What's New covers the room
// a search asked for. Every visit after it is an existing user's, whichever
// document it comes in on, so a device that only ever arrives on /jam is not
// a first run for good, with no plan and no What's New ever.
describe('the welcome a visit is due, by its document', () => {
  it.each(['/ear-lab#/ear-lab', '/jam#/jam', '/pitch-training#/exercises'])(
    'leaves the first visit to %s to its room, and takes over the next',
    async (url) => {
      const first = await arrive(url)
      const next = await arrive(url)

      expect(first).toEqual({ opens: false, returning: false, pick: null })
      expect(next).toEqual({ opens: false, returning: true, pick: 'plan' })
    },
  )

  it('opens First Light by itself on a first visit to the home document', async () => {
    const home = await arrive('/')

    expect(home).toEqual({ opens: true, returning: false, pick: 'first-light' })
  })

  it('still opens it on the home document after visits through a room', async () => {
    await arrive('/jam#/jam')
    await arrive('/jam#/jam')

    const home = await arrive('/')

    expect(home).toEqual({ opens: true, returning: true, pick: 'first-light' })
  })

  it("takes over for a returning visitor on a room's document", async () => {
    localStorage.setItem(WELCOME_KEY, '1')

    const room = await arrive('/ear-lab#/ear-lab')

    expect(room).toEqual({ opens: false, returning: true, pick: 'plan' })
  })
})

// ── The tour offer ─────────────────────────────────────────────────────

/** A page load of the takeover over its real store, with a host whose own import of that store is `importStore`. */
async function loadTakeover(
  importStore: (store: PlanStoreModule) => Promise<PlanStoreModule>,
) {
  vi.resetModules()
  const store = await import('./plan-store')
  const { OpeningTakeover } = await import('./OpeningTakeover')
  const host = inRoot(() => createPlanLayerHost(async () => importStore(store)))
  const [decided, setDecided] = createSignal(false)
  const scope = {
    plan: host,
    setTakeoverDecided: setDecided,
    takeoverDecided: decided,
    showWelcome: () => false,
    flowOpen: () => false,
    whatsNew: { open: () => false },
  }
  const paused = asWritten(offerPause(), scope) as () => boolean
  const onDecided = asWritten(givenToMount('onDecided'), scope) as () => void
  const pauses: boolean[] = []
  inRoot(() => {
    createEffect(() => {
      pauses.push(paused())
    })
  })
  const mount = (suppressed: boolean) => {
    render(() => (
      <OpeningTakeover
        routeSuppressed={suppressed}
        welcomeDue={false}
        whatsNewDue={() => false}
        announceWhatsNew={vi.fn()}
        onDecided={onDecided}
      />
    ))
  }
  return { store, host, paused, pauses, mount }
}

describe("the tour offer's pause, with App's own onDecided", () => {
  it('holds from the takeover opening the layer until the host has seen it, and lifts when the layer closes', async () => {
    let release!: () => void
    const { store, host, paused, pauses, mount } = await loadTakeover(
      async (store) =>
        new Promise<PlanStoreModule>((resolve) => {
          release = () => {
            resolve(store)
          }
        }),
    )

    mount(false)
    await settle()
    // The order a production build measured: the takeover has opened the layer
    // and said it has decided, and the host's own import has not landed.
    expect(store.planLayerMode()).toBe('existing')
    expect(host.isOpen()).toBe(false)
    expect(paused()).toBe(true)

    release()
    await settle()
    expect(host.isOpen()).toBe(true)
    expect(paused()).toBe(true)
    expect(pauses).not.toContain(false)

    store.closePlanLayer()
    expect(paused()).toBe(false)
  })

  it('lets the offer go once the host is ready, when the takeover opens nothing', async () => {
    const { host, paused, mount } = await loadTakeover(async (store) => store)

    mount(true)
    await host.ready
    await settle()

    expect(paused()).toBe(false)
  })

  it('does not hold the offer for good when the host never gets the store', async () => {
    const { host, paused, mount } = await loadTakeover(async () => {
      throw new Error('the chunk is gone')
    })

    mount(true)
    await host.ready
    await settle()

    expect(paused()).toBe(false)
  })
})
