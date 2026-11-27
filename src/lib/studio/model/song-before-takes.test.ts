// A song saved before takes opens as it was saved, every clip a clip of one take, and plays as it played. The fixture holds such a song (an audio clip with fades, a MIDI clip, a comped loop take and a picked file) and the plan Studio compiled from it, both written by the build before takes, 0.9.31.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from './arrangement-plan'
import { studioClipTakeList, studioSongAssetIds } from './clip-takes'
import { applyStudioCommand } from './commands'
import fixture from './fixtures/song-before-takes.compatibility.json'
import { TEST_NOW } from './model.test-fixtures'
import type { StudioAsset } from './types'
import { validateStudioProject } from './validation'

const assets = fixture.assets as StudioAsset[]
const open = () => validateStudioProject(fixture.project, assets)

describe('a song saved before takes', () => {
  it('opens as it was saved, each clip a clip of one take and nothing added', () => {
    const opened = open()
    expect(opened).toEqual(fixture.project)
    for (const clip of opened.clips) {
      expect(clip).not.toHaveProperty('takes')
      expect(clip).not.toHaveProperty('activeTake')
      expect(studioClipTakeList(clip)).toEqual([clip])
    }
    expect(studioSongAssetIds(opened)).toEqual(
      new Set(assets.map((asset) => asset.id)),
    )
  })

  it('plays as it played', () => {
    const plan = compileStudioArrangement(open(), assets)
    expect(JSON.parse(JSON.stringify(plan))).toEqual(fixture.plan)
  })

  it('keeps every other clip as it was through an edit of one', () => {
    const edited = applyStudioCommand(
      open(),
      { type: 'set-clip-gain', clipId: 'clip-file', gainDb: -3 },
      { assets, now: TEST_NOW },
    )
    expect(edited.clips.filter((clip) => clip.id !== 'clip-file')).toEqual(
      fixture.project.clips.filter((clip) => clip.id !== 'clip-file'),
    )
  })
})
