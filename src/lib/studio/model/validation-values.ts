// Studio validation values — reject malformed persisted data without repairing it.
export class StudioValidationError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`)
    this.name = 'StudioValidationError'
  }
}

export function requireValue(
  condition: boolean,
  path: string,
  message: string,
): asserts condition {
  if (!condition) throw new StudioValidationError(path, message)
}

export function record(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> {
  requireValue(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    path,
    'Expected an object',
  )
  const prototype: unknown = Object.getPrototypeOf(value)
  requireValue(
    prototype === Object.prototype || prototype === null,
    path,
    'Expected plain data',
  )
  for (const key of required)
    requireValue(Object.hasOwn(value, key), `${path}.${key}`, 'Required')
  for (const key of Object.keys(value))
    requireValue(
      required.includes(key) || optional.includes(key),
      `${path}.${key}`,
      'Unknown field',
    )
  return value as Record<string, unknown>
}

export function textValue(
  value: unknown,
  path: string,
  maxLength = 256,
): string {
  requireValue(
    typeof value === 'string' &&
      value.trim().length > 0 &&
      value.length <= maxLength &&
      !Array.from(value).some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      ),
    path,
    'Expected nonempty text without control characters',
  )
  return value
}

export function idValue(value: unknown, path: string): string {
  const id = textValue(value, path, 128)
  requireValue(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id),
    path,
    'Invalid identifier',
  )
  return id
}

export function numberValue(
  value: unknown,
  path: string,
  min = -Number.MAX_VALUE,
  max = Number.MAX_VALUE,
): number {
  requireValue(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max,
    path,
    `Expected a finite number from ${min} to ${max}`,
  )
  return value
}

export function frameValue(value: unknown, path: string, min = 0): number {
  const result = numberValue(value, path, min, Number.MAX_SAFE_INTEGER)
  requireValue(Number.isSafeInteger(result), path, 'Expected an integer')
  return result
}

export function enumValue<T extends string | number>(
  value: unknown,
  choices: readonly T[],
  path: string,
): T {
  requireValue(
    choices.includes(value as T),
    path,
    'Unsupported value or version',
  )
  return value as T
}

export function boolValue(value: unknown, path: string): boolean {
  requireValue(typeof value === 'boolean', path, 'Expected a boolean')
  return value
}

export function isoValue(value: unknown, path: string): string {
  const result = textValue(value, path, 24)
  const date = new Date(result)
  requireValue(
    Number.isFinite(date.getTime()) && date.toISOString() === result,
    path,
    'Expected a canonical ISO timestamp',
  )
  return result
}

export function hashValue(value: unknown, path: string): string {
  const result = textValue(value, path, 64)
  requireValue(/^[a-f0-9]{64}$/.test(result), path, 'Expected a SHA-256 hash')
  return result
}

export function arrayValue(value: unknown, path: string): unknown[] {
  requireValue(Array.isArray(value), path, 'Expected an array')
  return value
}

export function uniqueValue(
  value: string | number,
  seen: Set<string | number>,
  path: string,
): void {
  requireValue(!seen.has(value), path, 'Duplicate value')
  seen.add(value)
}
