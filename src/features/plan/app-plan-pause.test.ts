// ============================================================
// What App holds back while the plan layer is up: read from source
// ============================================================
//
// The plan layer covers the whole window (z-index 3000), and two things App
// raises on their own would be spent under it or land over it: a tab's
// first-visit tour offer, a chip at the top of the main column (TourChipHost)
// that writes its once-per-tab key as it shows, so an offer made under the
// layer is spent where nobody sees it (the corner toast the chip replaced
// stood over the layer, and its Start tour ran that tab's tour over the
// plan); and the deferred feedback survey (GH #97), which waits for no guide
// or tour surface to be up. Ruling R83: both count the open layer, through the
// host's `plan.isOpen()` (plan-layer-host.ts), which is true from the moment
// the layer is asked for. The chip host removes a shown offer when its pause
// rises and offers the tab on screen when it falls, so an offer that was
// never shown comes once the layer closes (TourChipHost.test.tsx runs that
// part).
//
// What's New joins them (the one takeover per visit): the offer would be spent
// under the release page the same way, so its pause counts `whatsNew.open()`
// as well. A Merc tour joins the survey's list: it is a tour surface too.
//
// The same reading holds how App mounts the opening takeover, the other half of
// that rule: the picker's component is web-only (R9, R32), the arrival and
// First Light's flag it is given are read once when App sets up, what the old
// boot line did for a visitor who is not returning still happens, and the tour
// offer waits for the takeover to say it has decided (it writes its once-per-tab
// key as its chip shows). app-takeover-glue.test.tsx runs that wait and the
// arrival's rules; this is where their wiring is read.
//
// App is too large a world to render for these conditions, so this reads its
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

/** The calls of `whatsNew.open` inside `node`. */
const whatsNewChecks = (node: ts.Node): ts.CallExpression[] =>
  nodesOf(node).filter(
    (n): n is ts.CallExpression =>
      ts.isCallExpression(n) &&
      n.expression.getText(source) === 'whatsNew.open' &&
      n.arguments.length === 0,
  )

/** The tag of a JSX element, opening or self-closing. */
const tagOf = (node: ts.Node): string | null =>
  ts.isJsxElement(node)
    ? node.openingElement.tagName.getText(source)
    : ts.isJsxSelfClosingElement(node)
      ? node.tagName.getText(source)
      : null

/** The text of a JSX attribute's value, or undefined when it is not given. */
function attributeOf(node: ts.Node, name: string): string | undefined {
  const opening = ts.isJsxElement(node) ? node.openingElement : node
  if (!ts.isJsxOpeningLikeElement(opening)) return undefined
  return opening.attributes.properties
    .filter(ts.isJsxAttribute)
    .find((attribute) => attribute.name.getText(source) === name)
    ?.initializer?.getText(source)
}

/** The function `node` is written in, nearest first. */
function enclosingFunction(node: ts.Node): ts.Node | undefined {
  for (let up = node.parent; up !== undefined; up = up.parent) {
    if (ts.isFunctionLike(up)) return up
  }
  return undefined
}

/** App's chip hosts: the tab's tour offer, by the page title. */
const chipHosts = all.filter((node) => tagOf(node) === 'TourChipHost')

/** The `const` App hands its one chip host as `paused`: what the offer waits for. */
function offerPause(): ts.VariableDeclaration | undefined {
  const given =
    chipHosts.length === 1 ? attributeOf(chipHosts[0], 'paused') : undefined
  const name = given?.match(/^\{\s*(\w+)\s*\}$/u)?.[1]
  const found = name === undefined ? [] : declared(name)
  return found.length === 1 ? found[0] : undefined
}

describe('while the plan layer is up', () => {
  const [host] = declared('plan')
  const decided = all.find(
    (node): node is ts.VariableDeclaration =>
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.name.getText(source) === '[takeoverDecided, setTakeoverDecided]',
  )

  it("App's `plan` is the layer's host", () => {
    expect(declared('plan')).toHaveLength(1)
    expect(host?.initializer?.getText(source)).toBe('createPlanHost()')
  })

  it("a tab's tour offer waits, beside First Light", () => {
    expect(chipHosts).toHaveLength(1)
    const pause = offerPause()
    const paused = pause?.initializer

    expect(paused).toBeDefined()
    if (pause === undefined || paused === undefined) return
    expect(layerChecks(paused)).toHaveLength(1)
    // The pauses it had keep their place.
    expect(paused.getText(source)).toMatch(/\bshowWelcome\(\)/u)
    expect(paused.getText(source)).toMatch(/\bflowOpen\(\)/u)
    // The host it asks is the one the layer is drawn by, in the same component.
    expect(enclosingFunction(pause)).toBe(
      host === undefined ? 'no host' : enclosingFunction(host),
    )
  })

  it("a tab's tour offer waits while What's New is up as well", () => {
    const pause = offerPause()
    const paused = pause?.initializer

    expect(paused).toBeDefined()
    if (pause === undefined || paused === undefined) return
    expect(whatsNewChecks(paused)).toHaveLength(1)
    // And the controller it asks is the one that draws the page, in the same component.
    const [controller] = declared('whatsNew')
    expect(controller?.initializer?.getText(source)).toMatch(
      /^createWhatsNewController\(/u,
    )
    expect(enclosingFunction(pause)).toBe(
      controller === undefined
        ? 'no controller'
        : enclosingFunction(controller),
    )
  })

  it("a tab's tour offer waits until the takeover has decided", () => {
    const paused = offerPause()?.initializer

    expect(paused?.getText(source)).toMatch(/!takeoverDecided\(\)/u)
  })

  it('the takeover starts decided in the native build, which has none, in the same component as the offer', () => {
    const pause = offerPause()

    expect(decided).toBeDefined()
    expect(decided?.initializer?.getText(source)).toBe(
      'createSignal(IS_NATIVE_BUILD)',
    )
    expect(pause).toBeDefined()
    if (pause === undefined) return
    expect(enclosingFunction(pause)).toBe(
      decided === undefined ? 'no signal' : enclosingFunction(decided),
    )
  })

  it("the tour chip's host is drawn on the web only, as tours are", () => {
    const [chipHost] = chipHosts
    let condition: string | undefined
    for (let up = chipHost?.parent; up !== undefined; up = up.parent) {
      if (ts.isConditionalExpression(up)) {
        condition = up.condition.getText(source)
        break
      }
    }

    expect(condition).toBe('IS_NATIVE_BUILD')
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

  it('the deferred survey waits for a Merc tour as well', () => {
    const [surfaces] = declared('tourSurfaceOpen')

    expect(surfaces?.initializer?.getText(source)).toMatch(
      /\bcoachActive\(\) !== null/u,
    )
  })
})

describe('the one takeover per visit', () => {
  const [host] = declared('plan')

  /** The imports of App from the plan, as the module is written; a type import is gone from the bundle. */
  const planImports = source.statements
    .filter(ts.isImportDeclaration)
    .filter(
      (statement) =>
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text.startsWith('@/features/plan/'),
    )

  const isValueImport = (statement: ts.ImportDeclaration): boolean => {
    const clause = statement.importClause
    if (clause === undefined) return true
    if (clause.isTypeOnly) return false
    const bindings = clause.namedBindings
    return !(
      clause.name === undefined &&
      bindings !== undefined &&
      ts.isNamedImports(bindings) &&
      bindings.elements.length > 0 &&
      bindings.elements.every((element) => element.isTypeOnly)
    )
  }

  // R9: a module-level createPersistedSignal is a side effect Rollup keeps, so
  // one static import of the store, or of the takeover that reads it, puts the
  // plan in the phone's bundle. App holds the host (which takes the store as a
  // type), the sync gate (which imports its module inside a function) and the
  // record's sync rule with its key (R108, registered on the web only), and
  // reaches everything else through a constant-picked dynamic import. App
  // loads the rule on every visit, so plan-precedence.ts has no runtime import:
  // through plan-record.ts it would bring the questions into every first paint.
  it('imports nothing from the plan statically but the host, the sync gate and the record rule', () => {
    const named = planImports
      .filter(isValueImport)
      .map((statement) => statement.moduleSpecifier.getText(source))
    const rule = ts.createSourceFile(
      'src/features/plan/plan-precedence.ts',
      readFileSync('src/features/plan/plan-precedence.ts', 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const ruleImports = rule.statements.filter(
      (statement) =>
        (ts.isImportDeclaration(statement) && isValueImport(statement)) ||
        (ts.isExportDeclaration(statement) &&
          statement.moduleSpecifier !== undefined),
    )

    expect(named.sort()).toEqual([
      "'@/features/plan/plan-keys'",
      "'@/features/plan/plan-layer-host'",
      "'@/features/plan/plan-precedence'",
      "'@/features/plan/sync-for-account'",
    ])
    expect(ruleImports.map((statement) => statement.getText(rule))).toEqual([])
  })

  it('registers the record rule on the web only, and before the sync starts', () => {
    const registers = callsTo('registerSyncPrecedence')
    const [init] = callsTo('initSettingsSync')

    expect(registers.map((call) => call.getText(source))).toEqual([
      'registerSyncPrecedence(PLAN_RECORD_KEY, preferPlanRecord)',
    ])
    const guard = registers[0].parent.parent
    expect(ts.isIfStatement(guard) && guard.expression.getText(source)).toBe(
      '!IS_NATIVE_BUILD',
    )
    expect(registers[0].end < init.getStart(source)).toBe(true)
    expect(enclosingFunction(registers[0])).toBe(enclosingFunction(init))
  })

  it('reaches the rest of the plan only through an import that IS_NATIVE_BUILD folds away', () => {
    const imports = all.filter(
      (node): node is ts.CallExpression =>
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text.startsWith('@/features/plan/'),
    )
    const foldedAway = (call: ts.CallExpression): boolean => {
      for (let up = call.parent; up !== undefined; up = up.parent) {
        if (
          ts.isConditionalExpression(up) &&
          up.condition.getText(source) === 'IS_NATIVE_BUILD' &&
          call.pos >= up.whenFalse.pos &&
          call.end <= up.whenFalse.end
        ) {
          return true
        }
      }
      return false
    }

    expect(
      imports.map((call) => call.arguments[0].getText(source)).sort(),
    ).toEqual([
      "'@/features/plan/OpeningTakeover'",
      "'@/features/plan/PlanLayer'",
      "'@/features/plan/plan-store'",
    ])
    expect(imports.filter((call) => !foldedAway(call))).toEqual([])
  })

  it('picks the takeover component by IS_NATIVE_BUILD before lazy() is written', () => {
    const declarations = declared('OpeningTakeover')

    expect(declarations).toHaveLength(1)
    const picked = declarations[0].initializer
    expect(picked !== undefined && ts.isConditionalExpression(picked)).toBe(
      true,
    )
    if (picked === undefined || !ts.isConditionalExpression(picked)) return
    expect(picked.condition.getText(source)).toBe('IS_NATIVE_BUILD')
    expect(picked.whenTrue.getText(source)).toBe('() => null')
    expect(picked.whenFalse.getText(source)).toMatch(/^lazy\(/u)
  })

  // The router's first dispatch rewrites the address (it erases #/plan unless
  // the layer is up, and a Stripe return's hash is one-shot), so the arrival
  // is read in AppShell's own setup, a value and not a function. The address
  // is parsed once there, and every check reads that.
  it('reads the arrival when App sets up, not when the takeover asks', () => {
    const declarations = declared('takeoverSuppressed')

    expect(declarations).toHaveLength(1)
    const arrival = declarations[0].initializer
    expect(arrival !== undefined && !ts.isFunctionLike(arrival)).toBe(true)
    const text = arrival?.getText(source) ?? ''
    expect(text).toContain('routeSuppressesAnnouncement(arrivalRoute)')
    // A restored release page is a full-screen surface the visitor came back
    // to. It is here and not on the announcement's list, which also decides
    // whether the release is marked as told (use-whats-new.test.ts).
    expect(text).toContain("arrivalRoute.type === 'whats-new'")
    // A lesson's practice link asked for its room whoever follows it, so the
    // marker is read: lessonArrival() is set only for a first run's welcome.
    expect(text).toContain('arrivalLesson !== null')
    expect(text).not.toContain('lessonArrival')
    expect(text).not.toContain('parseHash(')
    expect(declared('arrivalRoute')[0]?.initializer?.getText(source)).toBe(
      'parseHash(window.location.hash)',
    )
    expect(declared('arrivalLesson')[0]?.initializer?.getText(source)).toBe(
      'lessonFromSearch(window.location.search)',
    )
    expect(enclosingFunction(declarations[0])).toBe(
      host === undefined ? 'no host' : enclosingFunction(host),
    )
  })

  // First Light can be spent before the takeover's chunk lands, and a first-run
  // visitor would then read as returning (D3): the flag is read here, once.
  it("reads First Light's flag when App sets up, beside the arrival", () => {
    const [flag] = declared('takeoverWelcomeDue')
    const [arrival] = declared('takeoverSuppressed')

    expect(flag?.initializer?.getText(source)).toBe('showWelcome()')
    expect(enclosingFunction(flag)).toBe(enclosingFunction(arrival))
  })

  it("hands the takeover the arrival, First Light's due flag and what the old boot line asked", () => {
    const mounts = all.filter(
      (node): node is ts.JsxSelfClosingElement =>
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(source) === 'OpeningTakeoverMount',
    )

    expect(mounts).toHaveLength(1)
    const given = new Map(
      mounts[0].attributes.properties
        .filter(ts.isJsxAttribute)
        .map((attribute) => [
          attribute.name.getText(source),
          attribute.initializer?.getText(source) ?? '',
        ]),
    )
    expect(given.get('routeSuppressed')).toBe('{takeoverSuppressed}')
    expect(given.get('welcomeDue')).toBe('{takeoverWelcomeDue}')
    // App's own argument, as the boot line passed it: not welcomeSeen() !== ''.
    expect(given.get('whatsNewDue')).toContain(
      'whatsNew.isDue(returningVisitor())',
    )
    expect(given.get('announceWhatsNew')).toContain(
      'whatsNew.announceIfNew(returningVisitor())',
    )
    // What releases the tour offer's pause, once the host has seen the open.
    expect(given.get('onDecided')).toMatch(
      /plan\.ready\.then\([\s\S]*setTakeoverDecided\(true\)/u,
    )
  })

  // A dead chunk (offline, or a deploy swapped the hashed assets) costs the
  // visit its takeover and nothing else: the boundary keeps App up, says so
  // once, and lets the tour offer go (a tick later: a fallback is render work).
  it('draws the takeover in a Suspense inside an ErrorBoundary whose fallback warns and decides', () => {
    const [mount] = declared('OpeningTakeoverMount')
    const picked = mount?.initializer
    expect(picked !== undefined && ts.isConditionalExpression(picked)).toBe(
      true,
    )
    if (picked === undefined || !ts.isConditionalExpression(picked)) return

    const drawn = nodesOf(picked.whenFalse).filter(
      (node) => tagOf(node) !== null,
    )
    expect(drawn.map(tagOf)).toEqual([
      'ErrorBoundary',
      'Suspense',
      'OpeningTakeover',
    ])
    const fallback = attributeOf(drawn[0], 'fallback') ?? ''
    expect(fallback).toContain('console.warn(')
    expect(fallback).toContain('queueMicrotask(props.onDecided)')
    expect(attributeOf(drawn[1], 'fallback')).toBe('{null}')
    expect(drawn[2].getText(source)).toBe('<OpeningTakeover {...props} />')
  })

  // announceIfNew had two jobs on every boot: announce to a returning visitor,
  // which is the takeover's now, and catch a first-ever visitor up on the
  // release line (use-whats-new.ts), which is no takeover and stays here. A
  // visitor who is not returning is never shown the page, so asking is safe.
  it('still catches a visitor who is not returning up on the release line', () => {
    const asked = callsTo('whatsNew.announceIfNew')
    const [catchUp] = asked.filter(
      (call) => call.arguments[0]?.getText(source) === 'false',
    )

    expect(catchUp).toBeDefined()
    const guards: string[] = []
    for (let up = catchUp?.parent; up !== undefined; up = up.parent) {
      if (ts.isIfStatement(up)) guards.push(up.expression.getText(source))
    }
    expect(guards).toEqual(['!returningVisitor()'])
  })
})
