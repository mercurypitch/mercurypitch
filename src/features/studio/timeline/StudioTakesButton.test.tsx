// Studio takes button tests — Crop to this take and Explode takes to new lanes take the Takes button away with the takes, on the clip bar and in a phone's clip note, so the focus goes to the clip they changed and not to the page; a pick that keeps the button leaves the focus on it.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { studioClipWithTakes } from '@/lib/studio/model/clip-takes'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { studioFixture, TEST_NOW } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAsset, StudioClip, StudioProject, } from '@/lib/studio/model/types'
import { StudioClipToolbar } from './StudioClipToolbar'
import { StudioPhoneClipNote } from './StudioPhoneClipNote'

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

interface HostProps {
  clip: StudioClip
  assets: ReadonlyMap<string, StudioAsset>
  onCommand(command: StudioCommand): boolean
}

const hosts: [string, (props: HostProps) => JSX.Element][] = [
  [
    'the clip bar',
    (props) => (
      <StudioClipToolbar
        clip={props.clip}
        assets={props.assets}
        playheadFrame={0}
        writable
        label="Voice"
        left={0}
        bottom={0}
        onCommand={(command) => props.onCommand(command)}
        onDetails={() => {}}
        onRemove={() => {}}
      />
    ),
  ],
  [
    'a phone’s clip note',
    (props) => (
      <StudioPhoneClipNote
        name="Voice"
        clip={props.clip}
        assets={props.assets}
        writable
        onCommand={(command) => props.onCommand(command)}
      />
    ),
  ],
]

/** A clip of two takes, the newest playing, its Takes list open in `Host`, and the clip itself on the timeline. */
function openTakes(Host: (props: HostProps) => JSX.Element) {
  const base = studioFixture()
  const assets: StudioAsset[] = [1, 2].map((n) => ({
    ...base.asset,
    id: `take-${n}`,
    canonicalPcmId: `pcm-${n}`,
    originalName: `Take ${n}.wav`,
  }))
  const one = { ...base.clip, fades: { curve: 'linear-amplitude' as const } }
  const stacked = studioClipWithTakes(
    assets.map((asset) => ({ ...one, assetId: asset.id })),
    1,
  )
  const [project, setProject] = createSignal<StudioProject>({
    ...base.project,
    clips: [stacked],
  })
  const clip = () => project().clips.find((each) => each.id === stacked.id)!
  const onTimeline = document.createElement('button')
  onTimeline.dataset.studioClip = stacked.id
  document.body.append(onTimeline)
  render(() => (
    <Host
      clip={clip()}
      assets={new Map(assets.map((asset) => [asset.id, asset]))}
      onCommand={(command) => {
        setProject((song) =>
          applyStudioCommand(song, command, { assets, now: TEST_NOW }),
        )
        return true
      }}
    />
  ))
  const takes = screen.getByRole('button', { name: 'Takes' })
  takes.focus()
  fireEvent.click(takes)
  return { clip, onTimeline, takes }
}

describe.each(hosts)('the Takes list on %s', (_, Host) => {
  it.each(['Crop to this take', 'Explode takes to new lanes'])(
    'gives the focus to the clip when %s takes the Takes button away',
    (action) => {
      // Arrange
      const { clip, onTimeline } = openTakes(Host)

      // Act
      fireEvent.click(screen.getByRole('menuitem', { name: action }))

      // Assert
      expect(clip().takes).toBeUndefined()
      expect(screen.queryByRole('button', { name: 'Takes' })).toBeNull()
      expect(document.activeElement).toBe(onTimeline)
    },
  )

  it('leaves the focus on the Takes button when choosing another take keeps it', () => {
    // Arrange
    const { clip, takes } = openTakes(Host)

    // Act
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Take 1' }))

    // Assert
    expect(clip().assetId).toBe('take-1')
    expect(takes.isConnected).toBe(true)
    expect(document.activeElement).toBe(takes)
  })
})
