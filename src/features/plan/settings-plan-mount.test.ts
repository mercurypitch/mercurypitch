// ============================================================
// How Settings reaches "Your plan": read from source
// ============================================================
//
// App draws the Settings page on the web only, but imports it statically, so
// whatever the page or its panel imports statically rides into the native
// bundle, where the plan must not be: the plan store makes persisted signals
// as it loads, a side effect Rollup keeps even from a dead branch. So the page
// (src/pages/SettingsPage.tsx) reaches the plan's section the way Home reaches
// its card: the constant picks a stand-in that renders nothing before `lazy()`
// is ever written, and the section draws inside a Suspense and an
// ErrorBoundary. The import() is of load-plan-settings.ts, whose only import
// of the section is a type, so the page's import() carries no list of chunks
// into Settings' first paint. SettingsPanel, a component, imports nothing of
// the plan's at all and says none of its words: the page hands it the section
// (`plan`), and gives none in the native build.
//
// A test that renders the panel would not see a static import slipped in
// beside the lazy one, so this reads the files, as home-card-mount.test.ts
// reads Home's. What the section does is PlanSettings.test.tsx's.

import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { PLAN_PLACES } from './plan-copy'

const PAGE = 'src/pages/SettingsPage.tsx'
const PANEL = 'src/components/SettingsPanel.tsx'
const SECTION = '@/features/plan/load-plan-settings'

/** A file, parsed, with every node of it. */
function read(file: string): { source: ts.SourceFile; all: ts.Node[] } {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const nodes = (node: ts.Node): ts.Node[] => [
    node,
    ...node.getChildren(source).flatMap(nodes),
  ]
  return { source, all: nodes(source) }
}

/** What a file imports from the plan, static and type-only alike. */
function planImports(source: ts.SourceFile): ts.ImportDeclaration[] {
  return source.statements
    .filter(ts.isImportDeclaration)
    .filter((declaration) =>
      (declaration.moduleSpecifier as ts.StringLiteral).text.includes(
        'features/plan',
      ),
    )
}

/** The `import()` calls among `all` that name `specifier`. */
const dynamicImports = (all: ts.Node[], specifier: string) =>
  all.filter(
    (node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === specifier,
  )

/** The conditional `node` is a branch of, nearest first, and which branch. */
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

describe('the Settings page', () => {
  const page = read(PAGE)
  const [call] = dynamicImports(page.all, SECTION)
  const choice = call === undefined ? null : enclosingChoice(call)

  it('takes nothing from the plan at run time but through import()', () => {
    expect(
      planImports(page.source).filter(
        (declaration) => declaration.importClause?.isTypeOnly !== true,
      ),
    ).toEqual([])
  })

  it('reaches the section through one import(), in the branch only a web build keeps', () => {
    expect(dynamicImports(page.all, SECTION)).toHaveLength(1)
    expect(choice?.conditional.condition.getText(page.source)).toBe(
      'IS_NATIVE_BUILD',
    )
    expect(choice?.branch).toBe('else')
  })

  it('picks a stand-in that renders nothing for the native build, before lazy() is written', () => {
    expect(choice?.conditional.whenTrue.getText(page.source)).toBe('() => null')
    expect(choice?.conditional.whenFalse.getText(page.source)).toMatch(
      /^lazy\(/u,
    )
  })

  it('hands the panel the section on the web only', () => {
    expect(page.source.getText()).toMatch(
      /<SettingsPanel plan=\{IS_NATIVE_BUILD \? undefined : PlanSection\} \/>/u,
    )
  })

  it('draws the section inside a Suspense inside an ErrorBoundary', () => {
    const drawn = page.all.find(
      (node) =>
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(page.source) === 'PlanSettings',
    )
    const around: string[] = []
    for (let up = drawn?.parent; up !== undefined; up = up.parent) {
      if (ts.isJsxElement(up)) {
        around.push(up.openingElement.tagName.getText(page.source))
      }
    }

    expect(around).toEqual(['Suspense', 'ErrorBoundary'])
  })
})

describe('the loader', () => {
  const loader = read('src/features/plan/load-plan-settings.ts')

  it('takes the section as a type only, and loads it with one import()', () => {
    const imports = loader.source.statements.filter(ts.isImportDeclaration)

    expect(imports.map((i) => i.importClause?.isTypeOnly)).toEqual([true])
    expect(dynamicImports(loader.all, './PlanSettings')).toHaveLength(1)
  })
})

describe('the Settings panel', () => {
  const panel = read(PANEL)

  it('imports nothing of the plan, not even a type', () => {
    expect(planImports(panel.source)).toEqual([])
    expect(dynamicImports(panel.all, SECTION)).toEqual([])
    expect(dynamicImports(panel.all, '@/features/plan/PlanSettings')).toEqual(
      [],
    )
  })

  it('draws the section it is given only where the native constant folds it away', () => {
    expect(panel.source.getText()).toMatch(
      /\{IS_NATIVE_BUILD \? null : props\.plan\?\.\(\)\}/u,
    )
  })

  it("says none of the section's words", () => {
    const words = [
      PLAN_PLACES.answeredLine,
      PLAN_PLACES.seePlan,
      PLAN_PLACES.changeAnswers,
      PLAN_PLACES.showOnHome,
      PLAN_PLACES.askLine,
      PLAN_PLACES.answer,
    ]

    expect(
      words.filter((word) => panel.source.getText().includes(word)),
    ).toEqual([])
  })
})
