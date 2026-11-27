import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { removeStudioTrack, studioTrackAfterRemoval } from './track-removal'

const TRACKS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('studioTrackAfterRemoval', () => {
  it('names the next lane, else the one before, else none', () => {
    expect(studioTrackAfterRemoval(TRACKS, 'a')).toBe('b')
    expect(studioTrackAfterRemoval(TRACKS, 'b')).toBe('c')
    expect(studioTrackAfterRemoval(TRACKS, 'c')).toBe('b')
    expect(studioTrackAfterRemoval([{ id: 'a' }], 'a')).toBeNull()
    expect(studioTrackAfterRemoval(TRACKS, 'gone')).toBeNull()
  })
})

describe('removeStudioTrack', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  /** A Studio with a name button per lane, as the lane headers have. */
  function studio(ids: string[], accepts = true) {
    const workspace = document.createElement('div')
    workspace.tabIndex = -1
    let tracks = ids.map((id) => ({ id }))
    const draw = () =>
      workspace.replaceChildren(
        ...tracks.map((track) => {
          const name = document.createElement('button')
          name.dataset.studioTrackHeader = track.id
          return name
        }),
      )
    draw()
    document.body.append(workspace)
    const dispatch = vi.fn((command: StudioCommand) => {
      if (!accepts || command.type !== 'remove-track') return false
      tracks = tracks.filter((track) => track.id !== command.trackId)
      draw()
      return true
    })
    const header = (id: string) =>
      workspace.querySelector(`[data-studio-track-header="${id}"]`)
    return { workspace, dispatch, header, project: () => ({ tracks }) }
  }

  it("puts the focus on the next lane's name once the lane is gone", async () => {
    const host = studio(['a', 'b', 'c'])
    ;(host.header('b') as HTMLElement).focus()

    expect(removeStudioTrack('b', host, host.workspace)).toBe(true)
    await Promise.resolve()

    expect(host.dispatch).toHaveBeenCalledWith({
      type: 'remove-track',
      trackId: 'b',
    })
    expect(document.activeElement).toBe(host.header('c'))
  })

  it('puts it on the lane before for the last lane, and on the Studio for the only one', async () => {
    const last = studio(['a', 'b'])
    removeStudioTrack('b', last, last.workspace)
    await Promise.resolve()
    expect(document.activeElement).toBe(last.header('a'))
    document.body.replaceChildren()

    const only = studio(['a'])
    removeStudioTrack('a', only, only.workspace)
    await Promise.resolve()
    expect(document.activeElement).toBe(only.workspace)
  })

  it('moves nothing when the Studio refuses', async () => {
    const host = studio(['a', 'b'], false)
    ;(host.header('a') as HTMLElement).focus()
    expect(removeStudioTrack('a', host, host.workspace)).toBe(false)
    await Promise.resolve()
    expect(document.activeElement).toBe(host.header('a'))
  })
})
