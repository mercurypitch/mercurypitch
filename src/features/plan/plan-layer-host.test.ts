// ============================================================
// plan-layer-host: whether the plan layer is open
// ============================================================
//
// The open state is a small machine over four pieces of state (the store, once
// it has arrived; whether the layer was asked for before that; whether the
// store is on its way; whether a close came in the meantime) and it has four
// races that no screen test reaches: a close before the store lands, two asks
// before it lands, an import that fails and is asked again, and a layer that
// another path opened. Each is pinned below. The store is the real one and the
// importer is the test's, so a case can hold the store back, fail the import
// or hand it over. The last block reads the module's source: App imports it
// statically, in the native build too, so it must stay a module that carries
// no plan code and says no words.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createEffect, createRoot } from 'solid-js'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyPersistedValue } from '@/lib/storage'
import { PLAN_RECORD_KEY } from './plan-keys'
import type { PlanLayerHost, PlanStoreModule } from './plan-layer-host'
import { createPlanLayerHost } from './plan-layer-host'
import * as store from './plan-store'
import type { PlanChoices } from './questions'

const ANSWERS: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'tune'],
  q4: ['teacher'],
}
const NO_TEXTS = { q3other: '', q4app: '' }

// ── The importer, held back, failed or handed over ─────────────────────

interface Gate {
  promise: Promise<PlanStoreModule>
  open: () => void
}

/** An importer's answer that the case lets through when it chooses. */
function gate(): Gate {
  let open!: () => void
  const promise = new Promise<PlanStoreModule>((resolve) => {
    open = () => {
      resolve(store)
    }
  })
  return { promise, open }
}

/** Lets every promise the host waits on settle: one turn of the event loop drains them all. */
const settle = async (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

const handOver = async (): Promise<PlanStoreModule> => store

// ── The host, built the way App builds it ──────────────────────────────

let disposers: (() => void)[] = []

function mount(
  importStore: () => Promise<PlanStoreModule> = handOver,
): PlanLayerHost {
  return createRoot((dispose) => {
    disposers.push(dispose)
    return createPlanLayerHost(importStore)
  })
}

beforeEach(() => {
  localStorage.clear()
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  store.closePlanLayer()
})

afterEach(() => {
  for (const dispose of disposers) dispose()
  disposers = []
  store.closePlanLayer()
})

// ── Asking before the store has landed ─────────────────────────────────

describe('a layer asked for before the store has arrived', () => {
  it('counts as open at once, so the address is not rewritten in the gap, and then opens as a skipper', async () => {
    const held = gate()
    const host = mount(async () => held.promise)

    host.open()

    expect(host.isOpen()).toBe(true)
    expect(host.mode()).toBeNull()
    held.open()
    await settle()
    expect(host.mode()).toBe('skipper')
    expect(host.isOpen()).toBe(true)
  })

  it('is one import and one opening when it is asked for twice', async () => {
    const held = gate()
    let calls = 0
    const host = mount(async () => {
      calls += 1
      return held.promise
    })
    const modes: (string | null)[] = []
    createRoot(() => {
      createEffect(() => {
        modes.push(host.mode())
      })
    })

    host.open()
    host.open()
    held.open()
    await settle()

    // The effect also runs when the store lands, with the mode it already had;
    // the layer's Show drops that, so only a change of mode is a new opening.
    const changes = modes.filter((mode, i) => i === 0 || mode !== modes[i - 1])
    expect(changes).toEqual([null, 'skipper'])
    expect(host.isOpen()).toBe(true)
    // The import the host makes itself once the app is up, and both asks, share one.
    expect(calls).toBe(1)
  })

  it('never opens when it is closed before the store lands, and stops counting as open', async () => {
    const held = gate()
    const host = mount(async () => held.promise)
    host.open()
    expect(host.isOpen()).toBe(true)

    host.close()

    expect(host.isOpen()).toBe(false)
    held.open()
    await settle()
    expect(host.mode()).toBeNull()
    expect(host.isOpen()).toBe(false)
  })

  it('clears the ask when the import fails, and the next open tries again', async () => {
    let calls = 0
    const host = mount(async () => {
      calls += 1
      if (calls <= 2) throw new Error('the chunk is gone')
      return store
    })
    // The first call is the one the host makes itself once the app is up, and
    // it fails quietly.
    await settle()
    expect(calls).toBe(1)

    host.open()
    expect(host.isOpen()).toBe(true)
    await settle()
    expect(calls).toBe(2)
    expect(host.isOpen()).toBe(false)

    host.open()
    await settle()
    expect(calls).toBe(3)
    expect(host.mode()).toBe('skipper')
  })

  it('stops counting as open once the layer it opened is closed, whoever closes it', async () => {
    const held = gate()
    const host = mount(async () => held.promise)
    host.open()
    held.open()
    await settle()
    expect(host.mode()).toBe('skipper')

    store.closePlanLayer()

    expect(host.mode()).toBeNull()
    expect(host.isOpen()).toBe(false)
  })

  it('leaves a layer another path opened while it waited', async () => {
    const held = gate()
    const host = mount(async () => held.promise)
    host.open()

    store.openPlanLayer('existing')
    held.open()
    await settle()

    expect(host.mode()).toBe('existing')
    expect(host.isOpen()).toBe(true)
  })
})

// ── Asking once the store is there ─────────────────────────────────────

describe('a layer asked for once the store is there', () => {
  it('opens at once, as a skipper when nothing is answered', async () => {
    const host = mount()
    await settle()

    host.open()

    expect(host.mode()).toBe('skipper')
  })

  it('opens an answered plan as a review', async () => {
    store.savePlanAnswers(ANSWERS, NO_TEXTS, null)
    const host = mount()
    await settle()
    expect(host.answered()).toBe(true)

    host.open()

    expect(host.mode()).toBe('review')
  })

  it('does not take over a layer another path opened', async () => {
    const host = mount()
    await settle()
    store.openPlanLayer('existing')
    expect(host.isOpen()).toBe(true)

    host.open()

    expect(host.mode()).toBe('existing')
  })

  it('is shut by close, and a second opening is a fresh one, by the record as it is then', async () => {
    const host = mount()
    await settle()
    host.open()
    expect(host.mode()).toBe('skipper')

    host.close()
    expect(host.mode()).toBeNull()
    expect(host.isOpen()).toBe(false)

    store.savePlanAnswers(ANSWERS, NO_TEXTS, null)
    host.open()
    expect(host.mode()).toBe('review')
  })
})

describe('whether the plan is answered', () => {
  it('is false until the store is there, and follows the record after', async () => {
    const host = mount()
    expect(host.answered()).toBe(false)
    await settle()
    expect(host.answered()).toBe(false)

    store.savePlanAnswers(ANSWERS, NO_TEXTS, null)

    expect(host.answered()).toBe(true)
  })

  it('loads the store once the app is up, without being asked to open', async () => {
    let calls = 0
    mount(async () => {
      calls += 1
      return store
    })

    await settle()

    expect(calls).toBe(1)
  })
})

// ── What the module is ─────────────────────────────────────────────────

describe('the module', () => {
  const file = resolve(__dirname, 'plan-layer-host.ts')
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const imports = source.statements.filter(ts.isImportDeclaration)
  const specifier = (declaration: ts.ImportDeclaration): string =>
    (declaration.moduleSpecifier as ts.StringLiteral).text

  /** Every node under `node`, itself included. */
  function nodes(node: ts.Node): ts.Node[] {
    return [node, ...node.getChildren(source).flatMap(nodes)]
  }

  it('takes other plan modules only as types, and nothing else but Solid', () => {
    const plan = imports.filter((i) => specifier(i).startsWith('./'))

    expect(plan.length).toBeGreaterThan(0)
    expect(plan.filter((i) => i.importClause?.isTypeOnly !== true)).toEqual([])
    expect(
      imports
        .filter((i) => !plan.includes(i))
        .map(specifier)
        .sort(),
    ).toEqual(['solid-js'])
  })

  it('imports nothing at run time: the store arrives by the importer it is given', () => {
    const dynamic = nodes(source).filter(
      (node) =>
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword,
    )

    expect(dynamic).toEqual([])
  })

  it('does nothing when it is imported: only declarations stand at its top level', () => {
    const doing = source.statements.filter(
      (statement) =>
        !ts.isImportDeclaration(statement) &&
        !ts.isFunctionDeclaration(statement) &&
        !ts.isInterfaceDeclaration(statement) &&
        !ts.isTypeAliasDeclaration(statement),
    )

    expect(doing.map((statement) => statement.getText(source))).toEqual([])
  })

  it('says no words: its only strings are the record status and the modes it opens the layer in', () => {
    const strings = nodes(source)
      .filter(
        (node) =>
          (ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node)) &&
          !ts.isImportDeclaration(node.parent),
      )
      .map((node) => (node as ts.StringLiteral).text)

    expect([...new Set(strings)].sort()).toEqual([
      'answered',
      'review',
      'skipper',
    ])
  })
})
