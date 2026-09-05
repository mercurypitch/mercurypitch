// ============================================================
// V2.4 app media tests — public delivery closed-set integrity
// ============================================================

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const V2_4_DELIVERY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/onboarding/corky-v2.4',
)
const V2_5_DELIVERY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/onboarding/corky-v2.5',
)

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function deliveryFiles(
  deliveryRoot: string,
  directory = deliveryRoot,
): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return deliveryFiles(deliveryRoot, path)
    return [relative(deliveryRoot, path)]
  })
}

describe('V2.4 onboarding app media', () => {
  it('matches the exact public delivery inventory with no unregistered files', () => {
    const inventory = readFileSync(
      resolve(V2_4_DELIVERY_ROOT, 'SHA256SUMS'),
      'utf8',
    )
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

    expect(inventory).toHaveLength(19)
    expect(new Set(inventory.map(({ path }) => path)).size).toBe(19)
    expect(inventory).toContainEqual({
      path: 'audio/score/besidecue-score-full-loop-v0_1.m4a',
      sha256:
        '6548afbd060216d772173ad9d9b9229f36723d3ed82e7fec3ff48535b59fedac',
    })
    expect(inventory).toContainEqual({
      path: 'picture/b01-corky-greeting-v0_4.mp4',
      sha256:
        '3d3c1a80a064da01b21b83d0c0d37802ef14c4145870e92634fc17f84282bdaa',
    })
    expect(inventory).toContainEqual({
      path: 'audio/dialogue/corky-greeting-v0_3.m4a',
      sha256:
        '544f25d1a2565f600ed3ceb10bf93e1807b223e8dd93ff05589125315dcd6cba',
    })
    expect(deliveryFiles(V2_4_DELIVERY_ROOT).sort()).toEqual(
      [...inventory.map(({ path }) => path), 'SHA256SUMS'].sort(),
    )
    for (const record of inventory) {
      expect(record.path).not.toContain('..')
      expect(sha256(resolve(V2_4_DELIVERY_ROOT, record.path))).toBe(
        record.sha256,
      )
    }
  })
})

describe('additive V2.5 onboarding app media', () => {
  it('pins exactly the silent direct greeting, H06 press and standing-spin movies', () => {
    const inventory = readFileSync(
      resolve(V2_5_DELIVERY_ROOT, 'SHA256SUMS'),
      'utf8',
    )
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

    expect(inventory).toEqual([
      {
        path: 'picture/b01-corky-greeting-direct-to-p02-v0_1.mp4',
        sha256:
          '6d80b681230551f2ec136645110fe4ab456bb94680aa235187c78448a18af70e',
      },
      {
        path: 'picture/b06-corky-starts-record-v0_1.mp4',
        sha256:
          'ddecc3ffba6a3c3b4803bead2af674fe0b340643b652cbe9a2c04993fd4369a1',
      },
      {
        path: 'picture/b06-whole-vinyl-spin-v0_1.mp4',
        sha256:
          '8268f2f8cd50555f1a8249ea8a8f4250512906488f79434759f819c56d33cd9e',
      },
    ])
    expect(deliveryFiles(V2_5_DELIVERY_ROOT).sort()).toEqual(
      [...inventory.map(({ path }) => path), 'SHA256SUMS'].sort(),
    )
    for (const record of inventory) {
      expect(record.path).not.toContain('..')
      expect(sha256(resolve(V2_5_DELIVERY_ROOT, record.path))).toBe(
        record.sha256,
      )
    }
  })
})
