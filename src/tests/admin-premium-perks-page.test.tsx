import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPremiumPerksPage } from '@/features/admin/AdminPremiumPerksPage'
import type { AdminPremiumBackground, AdminPremiumCapability, PremiumPerksSnapshot, SupporterGroup, } from '@/features/admin/premium-perks-admin-service'

const serviceMocks = vi.hoisted(() => ({
  loadPremiumPerks: vi.fn(),
  loadBackgroundVariantPreview: vi.fn(),
  createBackgroundVersion: vi.fn(),
  uploadBackgroundVariant: vi.fn(),
  removeBackgroundVariant: vi.fn(),
  publishBackgroundVersion: vi.fn(),
  retireBackground: vi.fn(),
  restoreBackground: vi.fn(),
  createSupporterGroup: vi.fn(),
  updateSupporterGroup: vi.fn(),
  addSupporterGroupMember: vi.fn(),
  revokeSupporterGroupMember: vi.fn(),
  assignBackgroundToGroup: vi.fn(),
  removeBackgroundFromGroup: vi.fn(),
  revokePremiumBackgroundCapability: vi.fn(),
}))

vi.mock('@/features/admin/premium-perks-admin-service', () => ({
  ...serviceMocks,
  PREMIUM_BACKGROUND_VARIANTS: ['landscape-2k', 'landscape-4k', 'portrait-2k'],
}))

const variants = {
  'landscape-2k': {
    id: 'variant-landscape-2k',
    variant: 'landscape-2k' as const,
    bytes: 1200,
    width: 2560,
    height: 1440,
    sha256: 'sha-landscape-2k',
    updatedAt: '2026-08-05T10:00:00.000Z',
  },
  'landscape-4k': {
    id: 'variant-landscape-4k',
    variant: 'landscape-4k' as const,
    bytes: 2400,
    width: 3840,
    height: 2160,
    sha256: 'sha-landscape-4k',
    updatedAt: '2026-08-05T10:00:00.000Z',
  },
  'portrait-2k': {
    id: 'variant-portrait-2k',
    variant: 'portrait-2k' as const,
    bytes: 1800,
    width: 1440,
    height: 2560,
    sha256: 'sha-portrait-2k',
    updatedAt: '2026-08-05T10:00:00.000Z',
  },
}

const background = (
  over: Partial<AdminPremiumBackground> = {},
): AdminPremiumBackground => ({
  id: 'golden-stage',
  label: 'Golden Stage',
  description: 'A warm supporter stage.',
  surface: 'jam',
  edition: 'golden-hour',
  lifecycle: 'draft',
  publishedVersion: 1,
  publishedRevisionId: 'revision-1',
  draftVersion: 2,
  draftRevisionId: 'revision-2',
  assignedGroupIds: ['active-supporters'],
  updatedAt: '2026-08-05T10:00:00.000Z',
  versions: [
    {
      id: 'revision-1',
      version: 1,
      status: 'published',
      variants,
      createdAt: '2026-08-04T10:00:00.000Z',
    },
    {
      id: 'revision-2',
      version: 2,
      status: 'draft',
      variants,
      createdAt: '2026-08-05T10:00:00.000Z',
    },
  ],
  ...over,
})

const group = (over: Partial<SupporterGroup> = {}): SupporterGroup => ({
  id: 'active-supporters',
  slug: 'active-supporters',
  name: 'Active Supporters',
  description: 'Membership follows active supporter status.',
  kind: 'automatic',
  active: true,
  memberCount: 42,
  members: [],
  backgroundIds: ['golden-stage'],
  updatedAt: '2026-08-05T10:00:00.000Z',
  ...over,
})

const capability = (
  over: Partial<AdminPremiumCapability> = {},
): AdminPremiumCapability => ({
  id: 'capability-1',
  backgroundId: 'golden-stage',
  version: 1,
  roomId: 'room-sunrise-session',
  issuerUserId: 'user-owner-123456789',
  issuedAt: '2026-08-05T10:00:00.000Z',
  expiresAt: '2099-08-05T11:00:00.000Z',
  revokedAt: null,
  ...over,
})

function snapshot(
  over: Partial<PremiumPerksSnapshot> = {},
): PremiumPerksSnapshot {
  return {
    backgrounds: [background()],
    groups: [group()],
    capabilities: [capability()],
    environment: {
      kind: 'development',
      label: 'Development · api-dev.example.test',
    },
    ...over,
  }
}

describe('AdminPremiumPerksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    serviceMocks.loadPremiumPerks.mockResolvedValue({
      ok: true,
      value: snapshot(),
    })
    serviceMocks.loadBackgroundVariantPreview.mockResolvedValue({
      ok: true,
      value: new Blob(['webp'], { type: 'image/webp' }),
    })
    serviceMocks.publishBackgroundVersion.mockResolvedValue({
      ok: true,
      value: background({
        lifecycle: 'published',
        publishedVersion: 2,
        publishedRevisionId: 'revision-2',
        draftVersion: null,
        draftRevisionId: null,
      }),
    })
    serviceMocks.revokePremiumBackgroundCapability.mockResolvedValue({
      ok: true,
      value: [
        capability({
          revokedAt: '2026-08-05T10:15:00.000Z',
        }),
      ],
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows the API target, lifecycle and automatic supporter group', async () => {
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    expect(
      await screen.findByText('Development · api-dev.example.test'),
    ).toBeInTheDocument()
    expect(screen.getByText('Draft revisions')).toBeInTheDocument()
    expect(screen.getByText('Shipped')).toBeInTheDocument()
    expect(screen.getAllByText('Golden Stage').length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(serviceMocks.loadBackgroundVariantPreview).toHaveBeenCalledWith(
        'owner-key',
        'golden-stage',
        'revision-2',
        'landscape-2k',
      ),
    )
    expect(
      await screen.findByRole('img', {
        name: 'Golden Stage Landscape 2K',
      }),
    ).toHaveAttribute('src', 'blob:preview')

    fireEvent.click(screen.getByRole('tab', { name: 'Supporter access' }))
    expect(screen.getAllByText('Active Supporters').length).toBeGreaterThan(0)
    expect(screen.getByText('Automatic group')).toBeInTheDocument()
    expect(
      screen.getByText(/billing entitlement is the source of truth/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Supporter account email'),
    ).not.toBeInTheDocument()
  })

  it('requires explicit confirmation before shipping a complete revision', async () => {
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    const shipAction = await screen.findByRole('button', {
      name: 'Validate and ship',
    })
    fireEvent.click(shipAction)
    expect(serviceMocks.publishBackgroundVersion).not.toHaveBeenCalled()

    const ship = screen.getByRole('button', {
      name: 'Ship revision',
    })
    fireEvent.click(ship)

    await waitFor(() =>
      expect(serviceMocks.publishBackgroundVersion).toHaveBeenCalledWith(
        'owner-key',
        'golden-stage',
        'revision-2',
      ),
    )
  })

  it('keeps a shipped revision assignable while its replacement is in draft', async () => {
    serviceMocks.loadPremiumPerks.mockResolvedValue({
      ok: true,
      value: snapshot({
        backgrounds: [background({ assignedGroupIds: [] })],
        groups: [
          group({
            id: 'launch-patrons',
            slug: 'launch-patrons',
            name: 'Launch patrons',
            kind: 'manual',
            memberCount: 0,
            backgroundIds: [],
          }),
        ],
      }),
    })
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    await screen.findByText('Draft revisions')
    fireEvent.click(screen.getByRole('tab', { name: 'Supporter access' }))

    expect(screen.getByLabelText('Shipped background')).toBeEnabled()
    expect(
      screen.getByRole('option', { name: 'Golden Stage' }),
    ).toBeInTheDocument()
  })

  it('reports local group edits to the studio leave guard', async () => {
    const onDirtyChange = vi.fn()
    render(() => (
      <AdminPremiumPerksPage
        adminKey="owner-key"
        onDirtyChange={onDirtyChange}
      />
    ))

    await screen.findByText('Draft revisions')
    fireEvent.click(screen.getByRole('tab', { name: 'Supporter access' }))
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.input(screen.getByPlaceholderText('Launch patrons'), {
      target: { value: 'Early supporters' },
    })

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
  })

  it('confirms a room pass revocation and refreshes the pass ledger', async () => {
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    await screen.findByText('Draft revisions')
    fireEvent.click(screen.getByRole('tab', { name: 'Room passes' }))
    expect(screen.getByText('room-sunrise-session')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Revoke Golden Stage pass for room room-sunrise-session',
      }),
    )
    expect(
      serviceMocks.revokePremiumBackgroundCapability,
    ).not.toHaveBeenCalled()
    const actions = screen.getAllByRole('button', {
      name: 'Revoke room pass',
    })
    fireEvent.click(actions.at(-1)!)

    await waitFor(() =>
      expect(
        serviceMocks.revokePremiumBackgroundCapability,
      ).toHaveBeenCalledWith('owner-key', 'capability-1'),
    )
    expect(
      await screen.findByText(
        'Room pass revoked and the capability list refreshed.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('revoked').length).toBeGreaterThan(0)
  })

  it('moves a room pass to expired without an API refresh', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T10:00:00.000Z'))
    serviceMocks.loadPremiumPerks.mockResolvedValue({
      ok: true,
      value: snapshot({
        capabilities: [capability({ expiresAt: '2026-08-05T10:00:45.000Z' })],
      }),
    })
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Room passes' }))
    expect(
      screen.getByRole('button', {
        name: 'Revoke Golden Stage pass for room room-sunrise-session',
      }),
    ).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(60_000)

    expect(
      screen.queryByRole('button', {
        name: 'Revoke Golden Stage pass for room room-sunrise-session',
      }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByText('expired').length).toBeGreaterThan(0)
  })

  it('renders a useful recovery state when the admin API fails', async () => {
    serviceMocks.loadPremiumPerks.mockResolvedValue({
      ok: false,
      error: 'R2 binding is unavailable.',
    })
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    expect(
      await screen.findByText('Premium perks could not be loaded'),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('R2 binding is unavailable.').length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
  })
})
