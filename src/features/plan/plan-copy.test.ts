// ============================================================
// plan-copy: the words the plan says in more than one place are written once
// ============================================================
//
// build-plan.test.ts pins every line of the cards. This file holds R58 for the
// words that two screens share: the words over a stop's room (Start here,
// Learn, Play) are written once, in plan-copy.ts, and the plan's screen and
// Home's card both read them from there; and the notice that the menu was made
// whole is written once, in plan-copy.ts, and enter-stop.ts is what says it,
// for the plan layer and for Home's card alike. A second copy of either would
// be the one that falls behind when the other is reworded.
//
// It reads the plan's own source files, so it sees a word that was typed
// into a screen as well as one that was imported.

import { readdirSync, readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { MENU_WHOLE } from './plan-copy'

const PLAN = 'src/features/plan'

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

/** The plan's own sources: not a test, and not a fixture a test shares. */
const sources = readdirSync(PLAN).filter(
  (name) => /\.tsx?$/u.test(name) && !/\.(test|fixture)\.tsx?$/u.test(name),
)

/** The source files that write one of the words as a string or as text in markup. */
function filesSaying(words: string[]): string[] {
  return sources.filter((name) => {
    const file = parse(`${PLAN}/${name}`)
    return nodesOf(file, file).some((node) => {
      const text = ts.isStringLiteralLike(node)
        ? node.text
        : ts.isJsxText(node)
          ? node.text.trim()
          : null
      return text !== null && words.includes(text)
    })
  })
}

/** What `name` imports from plan-copy, as the names in its import clauses. */
function importedFromPlanCopy(name: string): string[] {
  return parse(`${PLAN}/${name}`)
    .statements.filter(ts.isImportDeclaration)
    .filter(
      (declaration) =>
        (declaration.moduleSpecifier as ts.StringLiteral).text ===
        './plan-copy',
    )
    .map((declaration) => declaration.importClause?.getText() ?? '')
}

// ── The words over a room ──────────────────────────────────────────────

describe('the kinds of stop', () => {
  const WORDS = ['Start here', 'Learn', 'Play']

  it('are written once, in plan-copy.ts', () => {
    expect(sources).toEqual(
      expect.arrayContaining([
        'plan-copy.ts',
        'PlanScreen.tsx',
        'HomePlanCard.tsx',
      ]),
    )
    expect(filesSaying(WORDS)).toEqual(['plan-copy.ts'])
  })

  it('are all three there, so the guard cannot pass because a word went', () => {
    for (const word of WORDS) {
      expect([word, filesSaying([word])]).toEqual([word, ['plan-copy.ts']])
    }
  })

  it('are read from plan-copy.ts by the plan screen and by the card', () => {
    for (const name of ['PlanScreen.tsx', 'HomePlanCard.tsx']) {
      expect([
        name,
        importedFromPlanCopy(name).some((clause) => /\bKICKER\b/u.test(clause)),
      ]).toEqual([name, true])
    }
  })
})

// ── The notice that the menu was made whole ────────────────────────────

describe('the notice that the menu was made whole', () => {
  it('says what happened and where to change it', () => {
    expect(MENU_WHOLE).toBe(
      'Your menu shows every room again. You can change it in Settings, App Mode.',
    )
  })

  it('is written once, in plan-copy.ts', () => {
    expect(filesSaying([MENU_WHOLE])).toEqual(['plan-copy.ts'])
  })

  it('is read from plan-copy.ts by enter-stop.ts, which says it, and by nothing else that says it', () => {
    const readers = sources.filter((name) =>
      importedFromPlanCopy(name).some((clause) =>
        /\bMENU_WHOLE\b/u.test(clause),
      ),
    )

    expect(readers).toEqual(['enter-stop.ts'])
  })
})
