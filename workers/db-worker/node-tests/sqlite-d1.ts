// ── A real SQLite behind the D1 interface ────────────────────────────
//
// Enough of D1 for the worker's own handlers to run against node:sqlite with
// the actual migration files applied. The point is that these tests exercise
// the SQL as written — a typo'd column name or a constraint that does not do
// what the migration claims fails here rather than in production.
//
// Extracted so a fourth copy did not get pasted in. suspension-integration and
// testing-accounts-integration still carry their own; they predate this file
// and switching them over is a separate, mechanical change.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'

export class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly values: SQLInputValue[] = [],
  ) {}

  bind(...values: SQLInputValue[]): SqliteD1Statement {
    return new SqliteD1Statement(this.database, this.sql, values)
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.database.prepare(this.sql).get(...this.values)
    if (row === undefined) return null
    return (column === undefined ? row : row[column]) as T
  }

  async all<T>(): Promise<{ success: true; results: T[] }> {
    return {
      success: true,
      results: this.database.prepare(this.sql).all(...this.values) as T[],
    }
  }

  execute(): { success: true; meta: { changes: number }; results: unknown[] } {
    // `run()` on a statement that returns rows yields nothing in node:sqlite,
    // and D1's batch() hands back results for every statement — including the
    // SELECTs the worker sends through it.
    const statement = this.database.prepare(this.sql)
    if (/^\s*(SELECT|WITH)/i.test(this.sql)) {
      return {
        success: true,
        meta: { changes: 0 },
        results: statement.all(...this.values),
      }
    }
    const result = statement.run(...this.values)
    return {
      success: true,
      meta: { changes: Number(result.changes) },
      results: [],
    }
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    return this.execute()
  }
}

export class SqliteD1Database {
  constructor(readonly native: DatabaseSync) {}

  prepare(sql: string): SqliteD1Statement {
    return new SqliteD1Statement(this.native, sql)
  }

  async batch(
    statements: SqliteD1Statement[],
  ): Promise<Array<{ success: true; meta: { changes: number } }>> {
    this.native.exec('BEGIN IMMEDIATE')
    try {
      const results = statements.map((statement) => statement.execute())
      this.native.exec('COMMIT')
      return results
    } catch (error) {
      this.native.exec('ROLLBACK')
      throw error
    }
  }
}

const MIGRATIONS_DIR = join(import.meta.dirname, '../migrations')

/** Migration filenames in the order the worker applies them. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

/**
 * Apply migrations to `target`, optionally stopping before one of them.
 *
 * `stopBefore` is what lets a test build the schema as it stood, seed rows a
 * released version would have written, and then watch the new migration act
 * on them.
 */
export function applyMigrations(
  target: DatabaseSync,
  stopBefore?: string,
): void {
  for (const file of migrationFiles()) {
    if (stopBefore !== undefined && file === stopBefore) return
    target.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
}

/** Apply a single migration by filename. */
export function applyMigration(target: DatabaseSync, file: string): void {
  target.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
}
