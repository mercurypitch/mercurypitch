// ============================================================
// How Home reaches its card: read from source
// ============================================================
//
// HomePage renders on the web only, but App imports it statically, so whatever
// HomePage imports statically rides into the native bundle, where the plan
// must not be: the plan store makes two persisted signals as it loads, a
// side effect Rollup keeps even from a dead branch. So Home reaches the card
// the way App reaches First Light, from src/pages/HomePlanCardMount.tsx: the
// constant picks a stand-in that renders nothing before `lazy()` is ever
// written, and the card draws inside a Suspense (so Home does not wait for it)
// and an ErrorBoundary (so a dead chunk, offline or after a deploy swapped the
// hashed assets, costs Home its card and not its page). Until the chunk is in,
// the Suspense keeps a slot for the card (the PR 1.3 gate, H-4: a card landing
// after Home's first paint pushed Home down), from plan-card-slot.ts, the one
// plan module the mount takes at run time: it makes no signal and says no
// words, and takes only the card's rules, the plan's keys, storage and first
// values with it (plan-card-slot.test.ts and plan-card-rules.test.ts hold the
// two to that). It is read only in the branch a web build keeps, and inside a
// guard, so a read that throws costs Home the slot and not the page.
//
// A test that renders HomePage would need its whole world, and would not see a
// static import slipped in beside the lazy one, so this reads the files the
// way plan-layer-host.test.ts reads its own. What the mount does when it runs
// is src/pages/HomePlanCardMount.test.ts's. The words over a stop's room are
// plan-copy.test.ts's, and the card's sheet is HomePlanCard.css.test.ts's.

import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const HOME = 'src/pages/HomePage.tsx'
const MOUNT = 'src/pages/HomePlanCardMount.tsx'
const CARD = '@/features/plan/HomePlanCard'

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

/** Every node under `node`, itself included. */
function nodesOf(node: ts.Node, source: ts.SourceFile): ts.Node[] {
  return [node, ...node.getChildren(source).flatMap((n) => nodesOf(n, source))]
}

/** A file, parsed once, with every node of it. */
function read(file: string): { source: ts.SourceFile; all: ts.Node[] } {
  const source = parse(file)
  return { source, all: nodesOf(source, source) }
}

/** The `import()` calls among `all` that name `specifier`. */
const dynamicImports = (
  all: ts.Node[],
  specifier: string,
): ts.CallExpression[] =>
  all.filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === specifier,
  )

/**
 * The conditional `node` is a branch of, nearest first, and which branch. A
 * node in a conditional's condition is in no branch of it, so the walk goes on.
 */
function enclosingChoice(
  node: ts.Node,
): { conditional: ts.ConditionalExpression; branch: 'then' | 'else' } | null {
  for (let at: ts.Node = node; at.parent !== undefined; at = at.parent) {
    const up = at.parent
    if (ts.isConditionalExpression(up)) {
      if (at === up.whenTrue) return { conditional: up, branch: 'then' }
      if (at === up.whenFalse) return { conditional: up, branch: 'else' }
    }
  }
  return null
}

/** What a JSX parent holds that is not whitespace or a comment, in order. */
function meaningfulChildren(element: ts.JsxElement): ts.JsxChild[] {
  return element.children.filter(
    (child) =>
      !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces) &&
      !(ts.isJsxExpression(child) && child.expression === undefined),
  )
}

/** The tag of a JSX element, whether it is written open and shut or self-closing. */
function tagOf(child: ts.Node | undefined, source: ts.SourceFile): string {
  if (child !== undefined && ts.isJsxElement(child)) {
    return child.openingElement.tagName.getText(source)
  }
  if (child !== undefined && ts.isJsxSelfClosingElement(child)) {
    return child.tagName.getText(source)
  }
  return ''
}

/** The source text of a JSX attribute's value: `{null}` for `fallback={null}`. */
function attributeOf(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  name: string,
  source: ts.SourceFile,
): string | undefined {
  const attributes = ts.isJsxElement(element)
    ? element.openingElement.attributes
    : element.attributes
  return attributes.properties
    .filter(ts.isJsxAttribute)
    .find((attribute) => attribute.name.getText(source) === name)
    ?.initializer?.getText(source)
    .replace(/\s+/gu, ' ')
}

/** The ErrorBoundary and Suspense elements `node` is drawn inside, nearest first. */
function boundariesAround(
  node: ts.Node | undefined,
  source: ts.SourceFile,
): string[] {
  const found: string[] = []
  for (let up = node?.parent; up !== undefined; up = up.parent) {
    const tag = tagOf(up, source)
    if (tag === 'ErrorBoundary' || tag === 'Suspense') found.push(tag)
  }
  return found
}

/** The first JSX element, open and shut or self-closing, whose `name` attribute reads `value`. */
function elementWith(
  { source, all }: { source: ts.SourceFile; all: ts.Node[] },
  name: string,
  has: (value: string) => boolean,
): ts.JsxElement | ts.JsxSelfClosingElement | undefined {
  return all.find(
    (node): node is ts.JsxElement | ts.JsxSelfClosingElement =>
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
      has(attributeOf(node, name, source) ?? ''),
  )
}

// ── Neither file puts the plan in the native bundle ────────────────────

describe('the files that reach the card', () => {
  it.each([
    [HOME, []],
    [MOUNT, ['@/features/plan/plan-card-slot']],
  ])(
    '%s takes from the plan at run time only %j, since a static import rides into the native bundle',
    (file, allowed) => {
      const imports = read(file)
        .source.statements.filter(ts.isImportDeclaration)
        .filter((declaration) =>
          (declaration.moduleSpecifier as ts.StringLiteral).text.includes(
            'features/plan',
          ),
        )

      expect(
        imports
          .filter(
            (declaration) => declaration.importClause?.isTypeOnly !== true,
          )
          .map(
            (declaration) =>
              (declaration.moduleSpecifier as ts.StringLiteral).text,
          ),
      ).toEqual(allowed)
    },
  )
})

// ── The mount ──────────────────────────────────────────────────────────

describe('the mount', () => {
  const mount = read(MOUNT)
  const [call] = dynamicImports(mount.all, CARD)

  it('reaches the card through one import(), in the branch only a web build keeps', () => {
    const choice = call === undefined ? null : enclosingChoice(call)

    expect(dynamicImports(mount.all, CARD)).toHaveLength(1)
    expect(choice?.conditional.condition.getText(mount.source)).toBe(
      'IS_NATIVE_BUILD',
    )
    expect(choice?.branch).toBe('else')
  })

  it('picks a stand-in that renders nothing for the native build, before lazy() is written', () => {
    const choice = call === undefined ? null : enclosingChoice(call)

    expect(choice?.conditional.whenTrue.getText(mount.source)).toBe(
      '() => null',
    )
    expect(choice?.conditional.whenFalse.getText(mount.source)).toMatch(
      /^lazy\(/u,
    )
  })

  it('reads the slot it keeps only in the branch a web build keeps', () => {
    const reads = mount.all.filter(
      (node): node is ts.CallExpression =>
        ts.isCallExpression(node) &&
        node.expression.getText(mount.source) === 'readPlanCardSlot',
    )
    const choice = reads[0] === undefined ? null : enclosingChoice(reads[0])

    expect(reads).toHaveLength(1)
    expect(choice?.conditional.condition.getText(mount.source)).toBe(
      'IS_NATIVE_BUILD',
    )
    expect(choice?.branch).toBe('else')
    expect(choice?.conditional.whenTrue.getText(mount.source)).toBe('null')
  })

  it('reads the slot inside a guard: a read that throws keeps no slot', () => {
    const [read] = mount.all.filter(
      (node): node is ts.CallExpression =>
        ts.isCallExpression(node) &&
        node.expression.getText(mount.source) === 'readPlanCardSlot',
    )
    let guard: ts.Node | undefined = read
    while (guard !== undefined && !ts.isTryStatement(guard)) {
      guard = guard.parent
    }
    const caught =
      guard !== undefined && ts.isTryStatement(guard)
        ? guard.catchClause?.block.statements
        : undefined

    expect(read).toBeDefined()
    expect(caught?.at(-1)?.getText(mount.source)).toBe('return null')
  })

  it('draws the card in a Suspense that keeps its slot, inside an ErrorBoundary, and hands it what Home does for its session', () => {
    const boundary = mount.all.find(
      (node): node is ts.JsxElement =>
        ts.isJsxElement(node) && tagOf(node, mount.source) === 'ErrorBoundary',
    )
    expect(boundary).toBeDefined()
    if (boundary === undefined) return

    const [suspense, ...others] = meaningfulChildren(boundary)
    expect(tagOf(suspense, mount.source)).toBe('Suspense')
    expect(others).toEqual([])
    // Home does not wait for the card, and keeps its slot meanwhile.
    expect(
      attributeOf(suspense as ts.JsxElement, 'fallback', mount.source),
    ).toBe('{<CardSlot slot={slot} />}')
    const [card, ...rest] = meaningfulChildren(suspense as ts.JsxElement)
    expect(tagOf(card, mount.source)).toBe('HomePlanCard')
    expect(rest).toEqual([])
    expect(
      attributeOf(
        card as ts.JsxSelfClosingElement,
        'onHomeSession',
        mount.source,
      ),
    ).toBe('{props.onHomeSession}')
  })
})

// ── Home ───────────────────────────────────────────────────────────────

describe('Home', () => {
  const home = read(HOME)

  it('reaches the card only through the mount: no import() or boundary of its own for it', () => {
    const fromMount = home.source.statements
      .filter(ts.isImportDeclaration)
      .filter(
        (declaration) =>
          (declaration.moduleSpecifier as ts.StringLiteral).text ===
          './HomePlanCardMount',
      )
      .map((declaration) => declaration.importClause?.getText() ?? '')

    expect(dynamicImports(home.all, CARD)).toEqual([])
    expect(fromMount.join(' ')).toMatch(/\bHomePlanCardMount\b/u)
    expect(fromMount.join(' ')).toMatch(/\bstartPlannedSession\b/u)
    // The boundary the card needs is the mount's: the mount is not drawn inside
    // an ErrorBoundary or a Suspense of Home's, at any distance.
    const drawn = home.all.find(
      (node) => tagOf(node, home.source) === 'HomePlanCardMount',
    )
    expect(drawn).toBeDefined()
    expect(boundariesAround(drawn, home.source)).toEqual([])
  })

  it("draws the mount first in the grid, giving it what Home does for today's session", () => {
    const grid = elementWith(home, 'class', (v) => v === '{styles.grid}')
    expect(grid !== undefined && ts.isJsxElement(grid)).toBe(true)
    if (grid === undefined || !ts.isJsxElement(grid)) return

    const [first] = meaningfulChildren(grid)
    expect(tagOf(first, home.source)).toBe('HomePlanCardMount')
    // The handler is the one call, with Home's routine and Home's session card.
    expect(
      attributeOf(
        first as ts.JsxSelfClosingElement,
        'onHomeSession',
        home.source,
      ),
    ).toBe('{() => startPlannedSession(routine, sessionCard)}')
  })

  it("holds Home's session card in the ref that handler reads", () => {
    const card = elementWith(home, 'class', (v) =>
      v.includes('home-session-card'),
    )

    expect(card).toBeDefined()
    expect(attributeOf(card as ts.JsxElement, 'ref', home.source)).toBe(
      '{sessionCard}',
    )
  })
})
