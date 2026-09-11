// Merc, warmed on the games list and taken by the next stage.
// ============================================================
//
// P7: the list loads his file while it is read, and the next createMerc
// is built from that load instead of starting its own. These pin the
// handover -- one load for one actor, never one body for two, a failed
// or abandoned warm costing nothing -- with the file itself mocked, since
// what is under test is who loads it and when.

import type { AnimationClip } from 'three'
import { BoxGeometry, Group, Mesh } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MercAsset } from '../assets'

const loadMerc = vi.fn<() => Promise<MercAsset>>()
vi.mock('../assets', () => ({ loadMerc: () => loadMerc() }))

const { createMerc, dropWarmMerc, warmMerc } = await import('./merc')

const asset = (): MercAsset => {
  const scene = new Group()
  const body = new Mesh(new BoxGeometry(1, 2, 1))
  body.name = 'merc_body'
  scene.add(body)
  return { scene, clips: [] as AnimationClip[] }
}

/** Unhandled rejections surface on the next turns of the loop. */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  dropWarmMerc()
  loadMerc.mockReset()
  loadMerc.mockImplementation(async () => asset())
})

describe('warmMerc', () => {
  it('loads once, and the next Merc is built from that load', async () => {
    const file = asset()
    loadMerc.mockResolvedValueOnce(file)
    warmMerc()
    warmMerc()
    expect(loadMerc).toHaveBeenCalledTimes(1)

    const actor = await createMerc()
    expect(loadMerc).toHaveBeenCalledTimes(1)
    expect(actor.root.children[0]).toBe(file.scene)
  })

  it('is taken once: the Merc after it loads his own body', async () => {
    warmMerc()
    const a = await createMerc()
    const b = await createMerc()
    expect(loadMerc).toHaveBeenCalledTimes(2)
    expect(a.root.children[0]).not.toBe(b.root.children[0])
  })

  it('leaves createMerc loading as it always did when nothing was warmed', async () => {
    await createMerc()
    expect(loadMerc).toHaveBeenCalledTimes(1)
  })

  it('a warm that failed is loaded again by the stage that takes it', async () => {
    loadMerc.mockRejectedValueOnce(new Error('offline'))
    warmMerc()
    await settle()
    const actor = await createMerc()
    expect(loadMerc).toHaveBeenCalledTimes(2)
    expect(actor.root.children).toHaveLength(1)
  })

  it('a failed warm nobody takes raises nothing', async () => {
    loadMerc.mockRejectedValueOnce(new Error('offline'))
    warmMerc()
    await settle()
    dropWarmMerc()
    await settle()
  })

  it('once dropped, the next Merc loads his own', async () => {
    warmMerc()
    dropWarmMerc()
    await createMerc()
    expect(loadMerc).toHaveBeenCalledTimes(2)
  })
})
