// ============================================================
// No em dash in the copy of the Ear Lab, Home, Voice Mirror, the karaoke
// playlist overlay and the plan
// ============================================================
//
// The owner's product voice keeps the em dash out of visible English: a full
// stop, a colon, parentheses or a shorter sentence does the job instead. The
// 0.9.20 store frames still showed "grid — except one", "Today counts —" and
// "±19 cents —", so these features were swept: The Grid first, then every
// Ear Lab drill so their feedback lines share one shape ("Right. The …"),
// and the profile's voice twin with the rest of Voice Mirror. This guard keeps
// a dash from coming back to them. The plan (src/features/plan) joined as it
// was written; its folder is read in full, so a screen added to it later is
// swept without a change here.
//
// It reads the source rather than a rendered screen, because most of these
// lines appear only after a sung take or a finished session. The TypeScript
// parser hands over every string, template and JSX text node, and comments
// are not nodes, so the many dashes in comments stay out of it. Two things are
// exempt: a literal that is the dash alone (the empty-value placeholder in a
// stat that has no number yet) and arguments to `console.*`, which no singer
// reads.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const EM_DASH = '—'

/** The source of each swept feature: a file, or a directory read in full. */
const SWEPT: readonly (readonly [string, string])[] = [
  ['the Ear Lab', 'src/features/ear-lab'],
  ['the Ear Lab', 'src/lib/ear/desk.ts'],
  ['Home', 'src/pages/HomePage.tsx'],
  ['Home', 'src/features/home'],
  ['Voice Mirror', 'src/features/mirror'],
  ['Voice Mirror', 'src/lib/mirror/cosmic-melodies.ts'],
  ['Voice Mirror', 'src/features/community/ProfileView.tsx'],
  ['the karaoke playlist overlay', 'src/components/KaraokePlaylistOverlay.tsx'],
  ['the plan', 'src/features/plan'],
]

function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path]
  return readdirSync(path)
    .flatMap((name) => sourceFiles(join(path, name)))
    .filter((file) => /\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file))
}

const TEXT_KINDS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
])

/** Every string, template piece and JSX text in `code` that holds an em
 *  dash, as `file:line: text`. */
function emDashLines(file: string, code: string): string[] {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      /^console\./u.test(node.expression.getText(source))
    ) {
      return
    }
    if (TEXT_KINDS.has(node.kind)) {
      const raw = node.getText(source)
      const text =
        node.kind === ts.SyntaxKind.JsxText ? raw.trim() : raw.slice(1, -1)
      if (text.includes(EM_DASH) && text !== EM_DASH) {
        const { line } = source.getLineAndCharacterOfPosition(
          node.getStart(source),
        )
        found.push(`${file}:${line + 1}: ${text.replace(/\s+/gu, ' ')}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('the em dash scan', () => {
  it('finds a dash in a string, a template and JSX text, and not in a comment or a placeholder', () => {
    const code = [
      "const a = 'one — two'",
      'const b = `three — ${a}`',
      '// four — five',
      "const c = () => <p>six — seven {a ?? '—'}</p>",
      "console.warn('eight — nine')",
    ].join('\n')

    const found = emDashLines('sample.tsx', code)

    expect(found).toEqual([
      'sample.tsx:1: one — two',
      'sample.tsx:2: three — $',
      'sample.tsx:4: six — seven',
    ])
  })
})

describe('visible copy without an em dash', () => {
  it.each(SWEPT)('%s keeps it out of %s', (_, path) => {
    const found = sourceFiles(path).flatMap((file) =>
      emDashLines(file, readFileSync(file, 'utf8')),
    )

    expect(found).toEqual([])
  })
})
