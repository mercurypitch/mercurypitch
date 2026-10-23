// ============================================================
// The shape of a module, read from its source
// ============================================================
//
// Home imports plan-card-rules.ts and plan-card-slot.ts statically, in the
// native build too, so each must carry no plan code: no import beyond the few
// it is allowed, nothing done as it loads, and no words. Their tests read the
// source with this, so the two checks are one check.

import { readFileSync } from 'node:fs'
import ts from 'typescript'

export interface ModuleShape {
  /** What it imports for its values, sorted. */
  valueImports: string[]
  /** What it imports for its types only, sorted. */
  typeImports: string[]
  /** How many `import()` calls it makes. */
  dynamicImports: number
  /** The text of every top-level statement that does something as the module loads. */
  doing: string[]
  /** Every string it holds outside its imports, sorted, once each. */
  strings: string[]
}

/** Every node under `node`, itself included. */
function nodes(node: ts.Node, source: ts.SourceFile): ts.Node[] {
  return [node, ...node.getChildren(source).flatMap((n) => nodes(n, source))]
}

/** A declaration that runs nothing as the module loads: a number, a sum, a table, a list or a function. */
function declaresOnly(statement: ts.Statement): boolean {
  if (
    ts.isImportDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
  ) {
    return true
  }
  if (!ts.isVariableStatement(statement)) return false
  return statement.declarationList.declarations.every((d) => {
    let init = d.initializer
    if (init !== undefined && ts.isAsExpression(init)) init = init.expression
    return (
      init !== undefined &&
      (ts.isNumericLiteral(init) ||
        ts.isBinaryExpression(init) ||
        ts.isObjectLiteralExpression(init) ||
        ts.isArrayLiteralExpression(init) ||
        ts.isArrowFunction(init))
    )
  })
}

/** Reads the module at `file` (a path from the repository's root). */
export function moduleShape(file: string): ModuleShape {
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
  const all = nodes(source, source)

  return {
    valueImports: imports
      .filter((i) => i.importClause?.isTypeOnly !== true)
      .map(specifier)
      .sort(),
    typeImports: imports
      .filter((i) => i.importClause?.isTypeOnly === true)
      .map(specifier)
      .sort(),
    dynamicImports: all.filter(
      (node) =>
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword,
    ).length,
    doing: source.statements
      .filter((statement) => !declaresOnly(statement))
      .map((statement) => statement.getText(source)),
    strings: [
      ...new Set(
        all
          .filter(
            (node) =>
              (ts.isStringLiteral(node) ||
                ts.isNoSubstitutionTemplateLiteral(node)) &&
              !ts.isImportDeclaration(node.parent),
          )
          .map((node) => (node as ts.StringLiteral).text),
      ),
    ].sort(),
  }
}
