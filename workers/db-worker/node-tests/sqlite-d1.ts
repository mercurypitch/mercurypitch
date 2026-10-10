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

  execute(): {
    success: true
    meta: { changes: number; last_row_id: number }
    results: unknown[]
  } {
    // `run()` on a statement that returns rows yields nothing in node:sqlite,
    // and D1's batch() hands back results for every statement — including the
    // SELECTs the worker sends through it.
    const statement = this.database.prepare(this.sql)
    if (/^\s*(SELECT|WITH)/i.test(this.sql)) {
      return {
        success: true,
        meta: { changes: 0, last_row_id: 0 },
        results: statement.all(...this.values),
      }
    }
    const result = statement.run(...this.values)
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
    }
  }

  async run(): Promise<{
    success: true
    meta: { changes: number; last_row_id: number }
  }> {
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
  ): Promise<
    Array<{ success: true; meta: { changes: number; last_row_id: number } }>
  > {
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

/** D1 as two requests at once meet it: every query waits a few
 *  milliseconds for its turn, so their reads and writes interleave, and only
 *  a check made in the same statement or batch as its write holds. */
export function interleaved(db: SqliteD1Database): D1Database {
  const turn = (): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, 5)
    })
  const statement = (inner: SqliteD1Statement): SqliteD1Statement =>
    new Proxy(inner, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: SQLInputValue[]) =>
            statement(target.bind(...values))
        }
        const value: unknown = Reflect.get(target, property, receiver)
        if (property === 'first' || property === 'all' || property === 'run') {
          const query = value as (...args: unknown[]) => Promise<unknown>
          return async (...args: unknown[]) => {
            await turn()
            return query.apply(target, args)
          }
        }
        return value
      },
    })
  return {
    prepare: (sql: string) => statement(db.prepare(sql)),
    batch: async (statements: SqliteD1Statement[]) => {
      await turn()
      return db.batch(statements)
    },
  } as unknown as D1Database
}

/**
 * Run `act`, to its end, just before the next statement whose SQL matches
 * `sql` is written: on its own (`run`), or in a batch with others. That is
 * how another request lands between one request's reads and its write.
 * Fires once.
 */
export function justBefore(
  db: SqliteD1Database,
  sql: RegExp,
  act: () => Promise<unknown>,
): void {
  const prepare = db.prepare.bind(db)
  const batch = db.batch.bind(db)
  const held = new WeakSet<SqliteD1Statement>()
  let armed = true
  const fire = async (): Promise<void> => {
    if (!armed) return
    armed = false
    await act()
  }
  const hold = (statement: SqliteD1Statement): SqliteD1Statement => {
    held.add(statement)
    const bind = statement.bind.bind(statement)
    const run = statement.run.bind(statement)
    statement.bind = (...values: SQLInputValue[]) => hold(bind(...values))
    statement.run = async () => {
      await fire()
      return run()
    }
    return statement
  }
  db.prepare = (text: string) => {
    const statement = prepare(text)
    return armed && sql.test(text) ? hold(statement) : statement
  }
  db.batch = async (statements: SqliteD1Statement[]) => {
    if (statements.some((statement) => held.has(statement))) await fire()
    return batch(statements)
  }
}

/**
 * D1 that holds the first read (`first` or `all`) of a statement whose SQL
 * matches `hold` until the first statement whose SQL matches `until` has
 * run on its own (`run`). `arrived` settles once that read waits. That is
 * how one request reads just after another request's write, whatever
 * else either does first. Each fires once.
 */
export function heldUntil(
  db: SqliteD1Database,
  hold: RegExp,
  until: RegExp,
): { d1: D1Database; arrived: Promise<void> } {
  let open = (): void => {}
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  let arrive = (): void => {}
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve
  })
  let holding = true
  let waiting = true
  const statement = (
    sql: string,
    inner: SqliteD1Statement,
  ): SqliteD1Statement =>
    new Proxy(inner, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: SQLInputValue[]) =>
            statement(sql, target.bind(...values))
        }
        const value: unknown = Reflect.get(target, property, receiver)
        const query = value as (...args: unknown[]) => Promise<unknown>
        const read = property === 'first' || property === 'all'
        if (read && holding && hold.test(sql)) {
          holding = false
          return async (...args: unknown[]) => {
            arrive()
            await opened
            return query.apply(target, args)
          }
        }
        if (property === 'run' && waiting && until.test(sql)) {
          waiting = false
          return async (...args: unknown[]) => {
            const result = await query.apply(target, args)
            open()
            return result
          }
        }
        return value
      },
    })
  return {
    d1: {
      prepare: (sql: string) => statement(sql, db.prepare(sql)),
      batch: (statements: SqliteD1Statement[]) => db.batch(statements),
    } as unknown as D1Database,
    arrived,
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

/**
 * Apply everything that comes AFTER `file`.
 *
 * The companion to `stopBefore`. A test that wants "rows a released build
 * wrote, meeting the migration under test" stops before it, seeds, and applies
 * it — but if that test then calls the worker, the worker is today's code and
 * expects today's schema. Without this the suite fails the day any later
 * migration adds a table a common code path writes to, which is exactly what
 * 0038_authSessions did to the login path.
 */
export function applyMigrationsAfter(target: DatabaseSync, file: string): void {
  const files = migrationFiles()
  const index = files.indexOf(file)
  if (index === -1) throw new Error(`unknown migration: ${file}`)
  for (const later of files.slice(index + 1)) {
    target.exec(readFileSync(join(MIGRATIONS_DIR, later), 'utf8'))
  }
}
