// ============================================================
// What App gives a finished Merc tour to offer next: read from source
// ============================================================
//
// A tab's Merc tour ends on the plan's next stop (plan-handoff.ts). The plan
// imports the tours (enter-stop.ts starts a stop's tour through
// startRoomTour), so the tours cannot import the plan back without a loop:
// App, which imports both, hands the plan's half to room-tour.ts
// (provideTourHandoff). plan-handoff reads the plan store, which the native
// build must not carry, so App picks the importer with IS_NATIVE_BUILD before
// the import() is written, as it picks the plan store's, and never imports
// the hand-over statically: it loads with the tour, off every first paint,
// through load-plan-handoff.ts, whose own import() carries the long list of
// chunks Vite writes for preloading, so index.html's first paint does not.
//
// App is too large a world to render for this, so this reads its source, as
// app-plan-pause.test.ts does.

import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const APP = 'src/App.tsx'
/** The one step App takes towards plan-handoff.ts (load-plan-handoff.ts says why). */
const LOADER = '@/features/plan/load-plan-handoff'
const HANDOFF = '@/features/plan/plan-handoff'

const source = ts.createSourceFile(
  APP,
  readFileSync(APP, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)

/** Every node under `node`, itself included. */
function nodesOf(node: ts.Node): ts.Node[] {
  return [node, ...node.getChildren(source).flatMap(nodesOf)]
}

const all = nodesOf(source)

const callsTo = (name: string): ts.CallExpression[] =>
  all.filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) && node.expression.getText(source) === name,
  )

/** The initializer of the top-level `const name`, if App declares one. */
function constNamed(name: string): ts.Expression | undefined {
  for (const node of all) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === name &&
      node.initializer !== undefined
    ) {
      return node.initializer
    }
  }
  return undefined
}

describe("App and a Merc tour's hand-over", () => {
  it('hands the tours one importer, picked by the build', () => {
    const calls = callsTo('provideTourHandoff')
    expect(calls).toHaveLength(1)
    const [arg] = calls[0]?.arguments ?? []
    expect(arg !== undefined && ts.isIdentifier(arg)).toBe(true)

    const picked = constNamed(arg?.getText(source) ?? '')
    expect(picked !== undefined && ts.isConditionalExpression(picked)).toBe(
      true,
    )
    const choice = picked as ts.ConditionalExpression
    expect(choice.condition.getText(source)).toBe('IS_NATIVE_BUILD')
    // The native build hands over nothing; the web loads the plan's half.
    expect(choice.whenTrue.getText(source)).toBe('null')
    const web = choice.whenFalse.getText(source)
    expect(web).toContain(`import('${LOADER}')`)
    expect(web).toContain('loadPlanHandoff()')
  })

  it('never imports the hand-over, or its loader, statically', () => {
    const statics = source.statements.filter(
      (node) =>
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        [LOADER, HANDOFF].includes(node.moduleSpecifier.text) &&
        node.importClause?.isTypeOnly !== true,
    )
    expect(statics).toEqual([])
  })

  it('reaches the hand-over through a loader whose one import is a type', () => {
    const loader = readFileSync(
      'src/features/plan/load-plan-handoff.ts',
      'utf8',
    )
    const imports = [...loader.matchAll(/^import (type )?.*$/gm)]

    expect(imports.map((m) => m[1])).toEqual(['type '])
    expect(loader).toContain("import('./plan-handoff')")
  })
})
