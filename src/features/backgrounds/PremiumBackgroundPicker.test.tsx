// ============================================================
// Premium background picker tests
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { BackgroundPerkId } from '@/lib/backgrounds/background-catalog'
import { PIANO_PREMIUM_BACKGROUND_IDS } from '@/lib/backgrounds/background-catalog'
import type { PremiumBackgroundAsset } from '@/lib/backgrounds/background-runtime'
import { loadProtectedBackgroundObjectUrl } from '@/lib/backgrounds/background-runtime'
import type { BackgroundSurfaceController, ResolvedBackground, RuntimeBackgroundOption, } from '@/lib/backgrounds/background-surface'
import { PremiumBackgroundPicker } from './PremiumBackgroundPicker'

vi.mock('@/lib/backgrounds/background-runtime', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    loadProtectedBackgroundObjectUrl: vi
      .fn()
      .mockResolvedValue('blob:unlocked-preview'),
  }
})

const SHA = 'c'.repeat(64)

function premiumAsset(
  id: BackgroundPerkId,
  surface: PremiumBackgroundAsset['surface'] = 'karaoke',
): PremiumBackgroundAsset {
  return {
    id,
    title: id,
    description: 'Supporter stage',
    surface,
    activeVersion: 1,
    variants: [
      {
        name: 'landscape-2k',
        width: 2048,
        height: 1152,
        byteSize: 100,
        sha256: SHA,
      },
    ],
  }
}

function pickerOptions(): RuntimeBackgroundOption[] {
  return [
    {
      id: 'karaoke-theatre',
      surface: 'karaoke',
      label: 'Mercury Theatre',
      description: 'Included stage',
      edition: 'core',
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      access: 'free',
      publicUrl: '/karaoke-night-stage.webp',
      premiumAsset: null,
    },
    {
      id: 'golden-hour-stage',
      surface: 'karaoke',
      label: 'Golden Hour',
      description: 'Unlocked stage',
      edition: 'golden-hour',
      focalPoint: { x: 0.5, y: 0.45 },
      treatment: 'dark',
      access: 'unlocked',
      publicUrl: null,
      premiumAsset: premiumAsset('golden-hour-stage'),
    },
    {
      id: 'aurora-stage',
      surface: 'karaoke',
      label: 'Aurora',
      description: 'Locked stage',
      edition: 'aurora',
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      access: 'locked',
      publicUrl: null,
      premiumAsset: premiumAsset('aurora-stage'),
    },
  ]
}

function fakeController(): BackgroundSurfaceController {
  return {
    surface: 'karaoke',
    requestedId: () => 'karaoke-theatre',
    resolved: () => ({
      id: 'karaoke-theatre',
      url: '/karaoke-night-stage.webp',
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      source: 'public',
      version: null,
      variant: null,
    }),
    resolvedStyle: () => ({
      '--mp-stage-image': 'url("/karaoke-night-stage.webp")',
      '--mp-stage-position-x': '50%',
      '--mp-stage-position-y': '50%',
      '--mp-stage-position': '50% 50%',
    }),
    options: pickerOptions,
    loading: () => false,
    error: () => null,
    select: vi.fn(() => true),
    refresh: async () => undefined,
    invalidateAccess: vi.fn(),
    retain: () => vi.fn(),
    dispose: vi.fn(),
  }
}

function pianoController(): BackgroundSurfaceController {
  const base = fakeController()
  return {
    ...base,
    surface: 'piano',
    requestedId: () => 'piano-afterglow',
    resolved: () => ({
      id: 'piano-afterglow',
      url: '/piano-night/afterglow-studio-landscape.webp',
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      source: 'public',
      version: null,
      variant: null,
    }),
    options: () => [
      {
        id: 'piano-afterglow',
        surface: 'piano',
        label: 'Afterglow Studio',
        description: 'Blue-hour focus around a concert grand',
        edition: 'core',
        focalPoint: { x: 0.5, y: 0.5 },
        treatment: 'dark',
        access: 'free',
        publicUrl: '/piano-night/afterglow-studio-landscape.webp',
        premiumAsset: null,
      },
      {
        id: 'piano-morning-conservatory',
        surface: 'piano',
        label: 'Morning Conservatory',
        description: 'Warm daylight for an unhurried practice session',
        edition: 'core',
        focalPoint: { x: 0.52, y: 0.46 },
        treatment: 'light',
        access: 'free',
        publicUrl: '/piano-night/morning-conservatory-landscape.webp',
        premiumAsset: null,
      },
    ],
  }
}

function drumController(): BackgroundSurfaceController {
  const base = fakeController()
  return {
    ...base,
    surface: 'drum',
    requestedId: () => 'drum-pocket-console',
    resolved: () => ({
      id: 'drum-pocket-console',
      url: '/drum-night/pocket-console-landscape.webp',
      focalPoint: { x: 0.5, y: 0.54 },
      treatment: 'dark',
      source: 'public',
      version: null,
      variant: null,
    }),
    options: () => [
      {
        id: 'drum-pocket-console',
        surface: 'drum',
        label: 'Pocket Console',
        description: 'Warm brass cues around a focused tracking room',
        edition: 'core',
        focalPoint: { x: 0.5, y: 0.54 },
        treatment: 'dark',
        access: 'free',
        publicUrl: '/drum-night/pocket-console-landscape.webp',
        premiumAsset: null,
      },
    ],
  }
}

beforeAll(() => {
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }) as typeof window.requestAnimationFrame
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('PremiumBackgroundPicker', () => {
  it('loads unlocked previews but never requests locked protected art', async () => {
    const controller = fakeController()
    render(() => <PremiumBackgroundPicker controller={controller} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose karaoke stage background' }),
    )

    await vi.waitFor(() =>
      expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledTimes(1),
    )
    expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'golden-hour-stage' }),
      expect.anything(),
    )
    expect(screen.getByRole('button', { name: /Aurora/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /Aurora/ }))
    expect(controller.select).not.toHaveBeenCalled()
  })

  it('does not re-fetch every thumbnail when the resolved room changes', async () => {
    // Regression for the 0.9.3 fix. The artwork effect used to read
    // controller.resolved(), which subscribed every card to the current
    // selection: one pick tore down and re-fetched the full-size protected art
    // for ALL of them. Piano Night reached prod with seventeen rooms against a
    // `background-read` budget of 120 a minute, so a couple of picks answered
    // 429 and the gallery stuttered.
    const rooms = PIANO_PREMIUM_BACKGROUND_IDS
    const options: RuntimeBackgroundOption[] = rooms.map((id) => ({
      id,
      surface: 'piano',
      label: id,
      description: 'Unlocked room',
      edition: 'core',
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      access: 'unlocked',
      publicUrl: null,
      premiumAsset: premiumAsset(id, 'piano'),
    }))

    const publicRoom = (id: BackgroundPerkId): ResolvedBackground => ({
      id,
      url: `/piano-night/${id}.webp`,
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      source: 'public',
      version: null,
      variant: null,
    })
    const [resolved, setResolved] = createSignal<ResolvedBackground>(
      publicRoom(rooms[0]),
    )
    const controller: BackgroundSurfaceController = {
      ...fakeController(),
      surface: 'piano',
      requestedId: () => rooms[0],
      resolved,
      options: () => options,
    }
    render(() => <PremiumBackgroundPicker controller={controller} embedded />)

    await vi.waitFor(() =>
      expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledTimes(
        rooms.length,
      ),
    )

    // Three room changes, including settling on a protected card and leaving it.
    setResolved({
      id: rooms[3],
      url: 'blob:third-room',
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      source: 'protected',
      version: 1,
      variant: 'landscape-2k',
    })
    setResolved(publicRoom(rooms[7]))
    setResolved(publicRoom(rooms[0]))

    // Not one extra request: the gallery is already painted.
    expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledTimes(rooms.length)
  })

  it('awaits an authoritative selection and closes only when accepted', async () => {
    const controller = fakeController()
    const onSelect = vi
      .fn<(option: RuntimeBackgroundOption) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    render(() => (
      <PremiumBackgroundPicker controller={controller} onSelect={onSelect} />
    ))
    const trigger = screen.getByRole('button', {
      name: 'Choose karaoke stage background',
    })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: /Golden Hour/ }))
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Golden Hour/ }))
    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it('keeps its gallery open while the panel scrolls and restores focus on Escape', async () => {
    const controller = fakeController()
    render(() => <PremiumBackgroundPicker controller={controller} />)
    const trigger = screen.getByRole('button', {
      name: 'Choose karaoke stage background',
    })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    fireEvent.scroll(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await vi.waitFor(() => expect(trigger).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the Credits section for supporter perks from a standalone gallery', () => {
    const controller = fakeController()
    render(() => <PremiumBackgroundPicker controller={controller} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose karaoke stage background' }),
    )

    expect(
      screen.getByRole('link', { name: 'Explore supporter perks' }),
    ).toHaveAttribute('href', '/#/settings/credits')
  })

  it('uses Piano Night copy and supports an owning drawer without a nested dialog', () => {
    const controller = pianoController()
    const { unmount } = render(() => (
      <PremiumBackgroundPicker controller={controller} />
    ))
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Choose Piano Night room background',
      }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Choose your Piano Night room' }),
    ).toHaveTextContent(
      'Included rooms and supporter editions for Piano Night.',
    )
    unmount()

    render(() => <PremiumBackgroundPicker controller={controller} embedded />)
    const gallery = screen.getByRole('region', {
      name: 'Choose your Piano Night room',
    })
    expect(within(gallery).queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: 'Choose Piano Night room background',
      }),
    ).not.toBeInTheDocument()
  })

  it('uses Drum Night copy in its embedded rack gallery', () => {
    render(() => (
      <PremiumBackgroundPicker controller={drumController()} embedded />
    ))

    const gallery = screen.getByRole('region', {
      name: 'Choose your Drum Night room',
    })
    expect(gallery).toHaveTextContent('Pocket Console')
    expect(gallery).toHaveTextContent('Included')
    expect(
      screen.queryByRole('button', {
        name: 'Choose Drum Night room background',
      }),
    ).not.toBeInTheDocument()
  })
})

// ── Only the cards you can see cost a request ───────────────────
//
// The panel scrolls — 760px over a two-column grid — so most cards are below
// the fold when it opens, and each one is a PROTECTED request for a full-size
// plate against a 120-a-minute budget. Piano Night spent seventeen of them to
// paint the four you could see. jsdom has no IntersectionObserver, so the rest
// of this file exercises the eager fallback; these stub one in.

describe('the gallery loads what is on screen', () => {
  type ObserverEntry = { target: Element; isIntersecting: boolean }
  let observed: Element[]
  let callbacks: Map<Element, (entries: ObserverEntry[]) => void>

  function stubObserver() {
    observed = []
    // Per target, not per observer: each card constructs its own, and a single
    // shared callback made every report land on whichever card built the last
    // one — which passed three of these tests for the wrong reason.
    callbacks = new Map()
    class FakeObserver {
      constructor(private callback: (entries: ObserverEntry[]) => void) {}
      observe(target: Element) {
        observed.push(target)
        callbacks.set(target, this.callback)
      }
      disconnect() {
        for (const [target, callback] of callbacks)
          if (callback === this.callback) callbacks.delete(target)
      }
      unobserve(target: Element) {
        callbacks.delete(target)
      }
      takeRecords() {
        return []
      }
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver)
  }

  const report = (target: Element, isIntersecting: boolean) => {
    callbacks.get(target)?.([{ target, isIntersecting }])
  }

  function pianoRooms() {
    const rooms = PIANO_PREMIUM_BACKGROUND_IDS
    const options: RuntimeBackgroundOption[] = rooms.map((id) => ({
      id,
      surface: 'piano',
      label: id,
      description: 'Unlocked room',
      edition: 'core',
      focalPoint: { x: 0.5, y: 0.5 },
      treatment: 'dark',
      access: 'unlocked',
      publicUrl: null,
      premiumAsset: premiumAsset(id, 'piano'),
    }))
    const controller: BackgroundSurfaceController = {
      ...fakeController(),
      surface: 'piano',
      requestedId: () => rooms[0],
      resolved: () => ({
        id: rooms[0],
        url: `/piano-night/${rooms[0]}.webp`,
        focalPoint: { x: 0.5, y: 0.5 },
        treatment: 'dark',
        source: 'public',
        version: null,
        variant: null,
      }),
      options: () => options,
    }
    return { rooms, controller }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for nothing until a card is near the fold', async () => {
    stubObserver()
    const { rooms, controller } = pianoRooms()

    render(() => <PremiumBackgroundPicker controller={controller} embedded />)
    await Promise.resolve()

    // Every card is watched, and not one of them has spent a request. Before
    // this the count here was rooms.length the instant the panel opened.
    expect(observed).toHaveLength(rooms.length)
    expect(loadProtectedBackgroundObjectUrl).not.toHaveBeenCalled()
  })

  it('loads a card once it comes into view, and only that card', async () => {
    stubObserver()
    const { controller } = pianoRooms()

    render(() => <PremiumBackgroundPicker controller={controller} embedded />)
    await Promise.resolve()
    report(observed[0], true)

    await vi.waitFor(() =>
      expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledTimes(1),
    )
  })

  it('ignores a report that a card is still out of view', async () => {
    stubObserver()
    const { controller } = pianoRooms()

    render(() => <PremiumBackgroundPicker controller={controller} embedded />)
    await Promise.resolve()
    // An observer fires on registration too, with isIntersecting false.
    report(observed[0], false)
    await Promise.resolve()

    expect(loadProtectedBackgroundObjectUrl).not.toHaveBeenCalled()
  })

  it('scrolling through the whole panel still costs one request per card', async () => {
    stubObserver()
    const { rooms, controller } = pianoRooms()

    render(() => <PremiumBackgroundPicker controller={controller} embedded />)
    await Promise.resolve()
    for (const target of [...observed]) report(target, true)

    await vi.waitFor(() =>
      expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledTimes(
        rooms.length,
      ),
    )

    // And a second report for a card already loaded buys nothing: the
    // observer is disconnected once it has fired.
    report(observed[0], true)
    await Promise.resolve()
    expect(loadProtectedBackgroundObjectUrl).toHaveBeenCalledTimes(rooms.length)
  })
})
