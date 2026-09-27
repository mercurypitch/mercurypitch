// ============================================================
// The studio, as the native app hosts it (plan S8 §11, D8 A)
// ============================================================
//
// The panel inside is UvrPanel's business (UvrPanel.native.test.tsx). What
// is pinned here is the studio around it: one button for its options (the
// view first, then Guide and Settings), one Group row that opens the groups
// as a list rather than a row of tabs that scrolls sideways (audit K5), and
// what happens to a song chosen to sing: the room gets it and the studio
// closes, or, for a song the room cannot play, the studio stays and says
// why. A melody found by singing goes to Sing.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrStudioHosting } from '@/components/uvr-studio-hosting'
import type { UvrView } from '@/components/UvrPanel'
import { TAB_KARAOKE, TAB_SINGING } from '@/features/tabs/constants'
import { karaokeActiveGroupId, setKaraokeActiveGroupId, } from '@/stores/app-store'
import { registerShellApi } from '@/stores/native-shell-store'
import { notifications, setNotifications } from '@/stores/notifications-store'
import { activeTab, setActiveTab } from '@/stores/ui-store'

// The studio only exists in the native app, where Settings is the shell's.
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  IS_NATIVE_BUILD: true,
}))

const panel = vi.hoisted(() => ({
  props: null as null | {
    initialView?: string
    studio?: UvrStudioHosting
    onSelectMelody?: (melodyId: string) => void
  },
  showView: vi.fn(),
  openGuide: vi.fn(),
}))

vi.mock('@/components/UvrPanel', async () => {
  const solid = await import('solid-js')
  return {
    UvrPanel: (props: NonNullable<typeof panel.props>) => {
      const [view, setView] = solid.createSignal<UvrView>('upload')
      // Once, at mount, as the real panel attaches. The rule cannot see
      // that `untrack` here is solid's, taken from a dynamic import.
      // eslint-disable-next-line solid/reactivity
      solid.untrack(() => {
        // eslint-disable-next-line solid/reactivity
        panel.props = props
        props.studio?.attach({
          view,
          showView: (next) => {
            panel.showView(next)
            setView(next)
          },
          openGuide: panel.openGuide,
        })
      })
      return <div data-testid="fake-uvr-panel" />
    },
  }
})

const groups = vi.hoisted(() => ({
  list: [
    { id: 'g1', name: 'Duets', sessionIds: ['mine'] },
    { id: 'g2', name: 'Warm-ups', sessionIds: [] },
  ],
}))
vi.mock('@/stores/app-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGroupsReactive: () => groups.list,
}))

const melodies = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('@/stores/melody-store', () => ({
  melodyStore: { loadMelody: melodies.load },
}))

vi.mock('./karaoke-room-library', () => ({
  roomLibrary: () => [
    { sessionId: 'karaoke-night-demo' },
    { sessionId: 'mine' },
  ],
}))

import { karaokeSongRequest, resetKaraokeRoomForTests, } from './karaoke-room-store'
import { KaraokeStudio, STUDIO_CANNOT_SING } from './KaraokeStudio'

beforeEach(() => {
  panel.props = null
  panel.showView.mockClear()
  panel.openGuide.mockClear()
  melodies.load.mockClear()
  resetKaraokeRoomForTests()
  setNotifications([])
  setActiveTab(TAB_KARAOKE)
  setKaraokeActiveGroupId(null)
})

afterEach(() => {
  cleanup()
})

function mount() {
  const onDone = vi.fn()
  const view = render(() => <KaraokeStudio onDone={onDone} />)
  const props = panel.props
  if (props === null) throw new Error('the studio drew no panel')
  const studio = props.studio
  if (studio === undefined) throw new Error('the studio hosts nothing')
  return { onDone, props, studio, container: view.container }
}

function openOptions(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Studio options' }))
  return screen.getByRole('dialog', { name: 'Studio options' })
}

describe('the studio', () => {
  it('opens on the songs', () => {
    const { props } = mount()

    expect(props.initialView).toBe('upload')
  })

  it('has one button for its options, beside one Group row', () => {
    const { container } = mount()

    const bar = container.querySelector('[data-testid="karaoke-studio-bar"]')
    expect(
      [...(bar?.querySelectorAll('button') ?? [])].map(
        (button) => button.getAttribute('aria-label') ?? button.textContent,
      ),
    ).toEqual(['Group: All songs', 'Studio options'])
  })
})

describe('the studio options', () => {
  it('put the view first, then Guide and Settings', () => {
    mount()
    const sheet = openOptions()

    const show = within(sheet).getByRole('radiogroup', { name: 'Show' })
    expect(
      within(show)
        .getAllByRole('radio')
        .map((radio) => [
          radio.textContent,
          radio.getAttribute('aria-checked'),
        ]),
    ).toEqual([
      ['Sing', 'false'],
      ['Songs', 'true'],
    ])
    expect(
      within(sheet)
        .getAllByRole('button')
        .map((button) => button.textContent?.trim()),
    ).toEqual(['Guide', 'Settings'])
  })

  it('switch the view, and close', () => {
    mount()
    const sheet = openOptions()

    fireEvent.click(within(sheet).getByRole('radio', { name: 'Sing' }))

    expect(panel.showView).toHaveBeenCalledWith('shazam-listen')
    expect(screen.queryByRole('dialog', { name: 'Studio options' })).toBeNull()
    const again = openOptions()
    expect(
      within(again)
        .getByRole('radio', { name: 'Sing' })
        .getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('open the guide, and close', () => {
    mount()
    const sheet = openOptions()

    fireEvent.click(within(sheet).getByRole('button', { name: 'Guide' }))

    expect(panel.openGuide).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Studio options' })).toBeNull()
  })

  it("open Karaoke's settings", () => {
    const pushSettings = vi.fn()
    const unregister = registerShellApi({ pushSettings })
    try {
      mount()
      const sheet = openOptions()

      fireEvent.click(within(sheet).getByRole('button', { name: 'Settings' }))

      expect(pushSettings).toHaveBeenCalledWith('karaoke')
    } finally {
      unregister()
    }
  })
})

describe('the Group row', () => {
  it('opens the groups as a list, one a line, and shows the one chosen', () => {
    mount()

    fireEvent.click(screen.getByRole('button', { name: 'Group: All songs' }))
    const list = screen.getByRole('dialog', { name: 'Group' })
    expect(within(list).getByTestId('group-tab-all')).toBeTruthy()
    fireEvent.click(within(list).getByTestId('group-tab-g1'))

    expect(karaokeActiveGroupId()).toBe('g1')
    expect(screen.queryByRole('dialog', { name: 'Group' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Group: Duets' })).toBeTruthy()
  })

  it('is there while the songs are, and not in the Sing view', () => {
    mount()
    const sheet = openOptions()

    fireEvent.click(within(sheet).getByRole('radio', { name: 'Sing' }))

    expect(screen.queryByTestId('karaoke-studio-group')).toBeNull()
    expect(screen.getByRole('button', { name: 'Studio options' })).toBeTruthy()
  })

  it('names a group that is gone as all the songs', () => {
    setKaraokeActiveGroupId('a-deleted-group')
    mount()

    expect(
      screen.getByRole('button', { name: 'Group: All songs' }),
    ).toBeTruthy()
  })
})

describe('a song chosen to sing', () => {
  it('goes back to the room, and the studio closes', () => {
    const { onDone, studio } = mount()

    studio.onSing('mine')

    expect(karaokeSongRequest()?.sessionId).toBe('mine')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('stays here when the room cannot play it, and the studio says why', () => {
    const { onDone, studio } = mount()

    studio.onSing('only-a-vocal')

    expect(karaokeSongRequest()).toBeNull()
    expect(onDone).not.toHaveBeenCalled()
    expect(notifications().map((note) => note.message)).toContain(
      STUDIO_CANNOT_SING,
    )
  })
})

describe('a melody found by singing', () => {
  it('goes to Sing', () => {
    const { onDone, props } = mount()

    props.onSelectMelody?.('melody-7')

    expect(melodies.load).toHaveBeenCalledWith('melody-7')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(activeTab()).toBe(TAB_SINGING)
  })
})
