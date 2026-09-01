// ============================================================
// V2.4 app media tests — public delivery closed-set integrity
// ============================================================

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const DELIVERY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/onboarding/corky-v2.4',
)

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function deliveryFiles(directory = DELIVERY_ROOT): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return deliveryFiles(path)
    return [relative(DELIVERY_ROOT, path)]
  })
}

describe('V2.4 onboarding app media', () => {
  it('matches the exact public delivery inventory with no unregistered files', () => {
    const inventory = readFileSync(resolve(DELIVERY_ROOT, 'SHA256SUMS'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const match = /^(?<sha256>[a-f0-9]{64}) {2}(?<path>[^/].*)$/u.exec(line)
        expect(match?.groups).toBeDefined()
        return {
          sha256: match?.groups?.sha256 ?? '',
          path: match?.groups?.path ?? '',
        }
      })

    expect(inventory).toHaveLength(18)
    expect(new Set(inventory.map(({ path }) => path)).size).toBe(18)
    expect(deliveryFiles().sort()).toEqual(
      [...inventory.map(({ path }) => path), 'SHA256SUMS'].sort(),
    )
    for (const record of inventory) {
      expect(record.path).not.toContain('..')
      expect(sha256(resolve(DELIVERY_ROOT, record.path))).toBe(record.sha256)
    }
  })
})
