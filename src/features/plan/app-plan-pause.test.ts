// ============================================================
// What App holds back while the plan layer is up: read from source
// ============================================================
//
// The plan layer covers the whole window (z-index 3000), and two things App
// raises on their own would land over it or under it: a tab's first-visit
// tour offer, a toast whose region sits at z-index 20000, so it is drawn on
// top of the layer and its Start tour runs that tab's tour over the plan; and
// the deferred feedback survey (GH #97), which waits for no guide or tour
// surface to be up. Ruling R83: both count the open layer, through the host's
// `plan.isOpen()` (plan-layer-host.ts), which is true from the moment the layer
// is asked for. usePageTourOffer removes a shown offer when its pause rises
// and offers the tab on screen when it falls, so an offer that was never shown
// comes once the layer closes (usePageTourOffer.test.tsx runs that part).
//
// App is too large a world to render for two conditions, so this reads its
// source, as home-card-mount.test.ts reads Home's.

import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const APP = 'src/App.tsx'

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

/** The calls to `name` in App. */
const callsTo = (name: string): ts.CallExpression[] =>
  all.filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) && node.expression.getText(source) === name,
  )

/** The `const name = ...` declarations in App. */
const declared = (name: string): ts.VariableDeclaration[] =>
  all.filter(
    (node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) && node.name.getText(source) === name,
  )

/** The calls of `plan.isOpen` inside `node`. */
const layerChecks = (node: ts.Node): ts.CallExpression[] =>
  nodesOf(node).filter(
    (n): n is ts.CallExpression =>
      ts.isCallExpression(n) &&
      n.expression.getText(source) === 'plan.isOpen' &&
      n.arguments.length === 0,
  )

/** The function `node` is written in, nearest first. */
function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isFunctionLike(up)) return up
  }
  return undefined
}

describe('while the plan layer is up', () => {
  const [host] = declared('plan')

  it("App's `plan` is the layer's host", () => {
    expect(declared('plan')).toHaveLength(1)
    expect(host?.initializer?.getText(source)).toBe('createPlanHost()')
  })

  it("a tab's tour offer waits, beside First Light", () => {
    const offers = callsTo('usePageTourOffer')
    expect(offers).toHaveLength(1)
    const [, paused] = offers[0].arguments

    expect(paused).toBeDefined()
    expect(layerChecks(paused)).toHaveLength(1)
    // The pauses it had keep their place.
    expect(paused.getText(source)).toMatch(/\bshowWelcome\(\)/u)
    expect(paused.getText(source)).toMatch(/\bflowOpen\(\)/u)
    // The host it asks is the one the layer is drawn by, in the same component.
    expect(enclosingFunction(offers[0])).toBe(
      host === undefined ? 'no host' : enclosingFunction(host),
    )
  })

  it('the deferred survey counts the layer as a surface it must not cover', () => {
    const surfaces = declared('tourSurfaceOpen')
    expect(surfaces).toHaveLength(1)
    const body = surfaces[0].initializer

    expect(body !== undefined && ts.isArrowFunction(body)).toBe(true)
    if (body === undefined) return
    expect(layerChecks(body)).toHaveLength(1)
    // The surfaces it had keep their place.
    for (const surface of [
      'showGuideSelection()',
      'walkthroughActive()',
      'showSelection()',
      'walkthroughModalOpen()',
    ]) {
      expect(body.getText(source)).toContain(surface)
    }
    expect(enclosingFunction(surfaces[0])).toBe(
      host === undefined ? 'no host' : enclosingFunction(host),
    )
  })
})
