// ── A stored secret's hash is compared in constant time ──────────────
//
// `===` and `!==` on strings stop at the first byte that differs, so how
// long a refusal took says how much of a guess was right. Every secret in
// auth.ts goes through timingSafeEqual for that reason; the device-link poll
// compared its token's hash with `!==`, the one site that did not.
//
// A timing difference cannot be asserted from a test, so this reads auth.ts
// the way the compiler does and refuses any equality test on a secret hash
// field, other than the null and empty checks that guard one.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SECRET_HASHES = new Set([
  'passwordHash',
  'tokenHash',
  'deviceSecretHash',
  'pollTokenHash',
])

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
])

const source = ts.createSourceFile(
  'auth.ts',
  readFileSync(join(import.meta.dirname, '../src/auth.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
)

/** The secret hash field an operand names, if it names one. */
function secretField(node: ts.Expression): string | null {
  const name = ts.isPropertyAccessExpression(node)
    ? node.name.text
    : ts.isIdentifier(node)
      ? node.text
      : null
  return name !== null && SECRET_HASHES.has(name) ? name : null
}

/** null, undefined or '': what a presence check compares a field with. */
function isAbsence(node: ts.Expression): boolean {
  return (
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(node) && node.text === 'undefined') ||
    (ts.isStringLiteral(node) && node.text === '')
  )
}

/** Every `a === b`-style comparison of a secret hash with something real. */
function plainComparisons(): string[] {
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && EQUALITY.has(node.operatorToken.kind)) {
      const field = secretField(node.left) ?? secretField(node.right)
      if (field !== null && !isAbsence(node.left) && !isAbsence(node.right)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart())
        found.push(`auth.ts:${line + 1} ${node.getText()}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('secret hashes in auth.ts', () => {
  it('are never compared with === or !==', () => {
    expect(plainComparisons()).toEqual([])
  })

  it('still names the fields it guards, so a rename cannot empty the check', () => {
    const text = source.getFullText()
    for (const field of SECRET_HASHES) expect(text).toContain(field)
  })
})
