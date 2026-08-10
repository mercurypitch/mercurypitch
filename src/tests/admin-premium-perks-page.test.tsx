import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
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
  assignFeatureToGroup: vi.fn(),
  removeFeatureFromGroup: vi.fn(),
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

const pianoBackground = (
  over: Partial<AdminPremiumBackground> = {},
): AdminPremiumBackground =>
  background({
    id: 'piano-velvet-recital',
    label: 'Velvet Recital',
    description: 'A candlelit recital room for Piano Night.',
    surface: 'piano',
    edition: 'velvet-recital',
    publishedRevisionId: 'piano-revision-1',
    draftRevisionId: 'piano-revision-2',
    assignedGroupIds: [],
    versions: [
      {
        id: 'piano-revision-1',
        version: 1,
        status: 'published',
        variants,
        createdAt: '2026-08-04T10:00:00.000Z',
      },
      {
        id: 'piano-revision-2',
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
  featureIds: ['lab-access'],
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
    featurePerks: [
      {
        id: 'lab-access',
        label: 'MercuryPitch Lab',
        description:
          'Early access to experimental audio tools and development previews.',
      },
    ],
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
    expect(screen.getByText('MercuryPitch Lab')).toBeInTheDocument()
    expect(
      screen.getByText(/billing entitlement is the source of truth/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Supporter account email'),
    ).not.toBeInTheDocument()
  })

  it('filters the lifecycle library by human-readable surface names', async () => {
    const karaokeBackground = background({
      id: 'aurora-stage',
      label: 'Aurora Stage',
      surface: 'karaoke',
      edition: 'aurora',
      assignedGroupIds: [],
    })
    serviceMocks.loadPremiumPerks.mockResolvedValue({
      ok: true,
      value: snapshot({
        backgrounds: [background(), karaokeBackground, pianoBackground()],
      }),
    })
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    const filters = await screen.findByRole('group', {
      name: 'Filter backgrounds by surface',
    })
    expect(
      within(filters).getByRole('button', { name: /^All\b/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(filters).getByRole('button', { name: /^Karaoke\b/ }),
    ).toBeInTheDocument()
    expect(
      within(filters).getByRole('button', { name: /^Jam\b/ }),
    ).toBeInTheDocument()

    fireEvent.click(
      within(filters).getByRole('button', { name: /^Piano Night\b/ }),
    )

    const library = screen.getByLabelText('Background lifecycle library')
    expect(
      within(library).getByRole('button', { name: /^Velvet Recital\b/ }),
    ).toHaveAttribute('aria-current', 'true')
    expect(
      within(library).queryByRole('button', { name: /^Golden Stage\b/ }),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Selected background editor')).getByText(
        'Piano Night · velvet-recital',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(serviceMocks.loadBackgroundVariantPreview).toHaveBeenCalledWith(
        'owner-key',
        'piano-velvet-recital',
        'piano-revision-2',
        'landscape-2k',
      ),
    )

    fireEvent.click(within(filters).getByRole('button', { name: /^All\b/ }))
    expect(
      within(library).getByRole('button', { name: /^Golden Stage\b/ }),
    ).toBeInTheDocument()
    expect(
      within(library).getByRole('button', { name: /^Aurora Stage\b/ }),
    ).toBeInTheDocument()
  })

  it('confirms before a surface filter discards staged uploads', async () => {
    const onDirtyChange = vi.fn()
    serviceMocks.loadPremiumPerks.mockResolvedValue({
      ok: true,
      value: snapshot({ backgrounds: [background(), pianoBackground()] }),
    })
    render(() => (
      <AdminPremiumPerksPage
        adminKey="owner-key"
        onDirtyChange={onDirtyChange}
      />
    ))

    const filters = await screen.findByRole('group', {
      name: 'Filter backgrounds by surface',
    })
    const file = new File(['webp'], 'golden-stage.webp', {
      type: 'image/webp',
    })
    fireEvent.change(screen.getAllByLabelText('Choose WebP')[0]!, {
      target: { files: [file] },
    })
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

    const pianoFilter = within(filters).getByRole('button', {
      name: /^Piano Night\b/,
    })
    fireEvent.click(pianoFilter)

    expect(
      screen.getByText('Discard selected upload files?'),
    ).toBeInTheDocument()
    expect(pianoFilter).toHaveAttribute('aria-pressed', 'false')
    expect(
      within(screen.getByLabelText('Background lifecycle library')).getByRole(
        'button',
        { name: /^Golden Stage\b/ },
      ),
    ).toHaveAttribute('aria-current', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Discard files' }))

    await waitFor(() =>
      expect(pianoFilter).toHaveAttribute('aria-pressed', 'true'),
    )
    expect(
      within(screen.getByLabelText('Background lifecycle library')).getByRole(
        'button',
        { name: /^Velvet Recital\b/ },
      ),
    ).toHaveAttribute('aria-current', 'true')
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
  })

  it('explains when a selected surface has no premium backgrounds', async () => {
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    const filters = await screen.findByRole('group', {
      name: 'Filter backgrounds by surface',
    })
    fireEvent.click(
      within(filters).getByRole('button', { name: /^Piano Night\b/ }),
    )

    expect(
      screen.getByRole('heading', { name: 'No Piano Night backgrounds' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Selected background editor')).getByRole(
        'heading',
        { name: 'Select a background' },
      ),
    ).toBeInTheDocument()

    fireEvent.click(within(filters).getByRole('button', { name: /^All\b/ }))
    expect(
      within(screen.getByLabelText('Background lifecycle library')).getByRole(
        'button',
        { name: /^Golden Stage\b/ },
      ),
    ).toHaveAttribute('aria-current', 'true')
  })

  it('assigns Lab access to a manual supporter group', async () => {
    const manualGroup = group({
      id: 'founders',
      slug: 'founders',
      name: 'Founders',
      kind: 'manual',
      memberCount: 1,
      members: [
        {
          addedAt: '2026-08-05T10:00:00.000Z',
          email: 'founder@example.com',
          note: null,
        },
      ],
      backgroundIds: [],
      featureIds: [],
    })
    serviceMocks.loadPremiumPerks.mockResolvedValue({
      ok: true,
      value: snapshot({ groups: [manualGroup] }),
    })
    serviceMocks.assignFeatureToGroup.mockResolvedValue({
      ok: true,
      value: { ...manualGroup, featureIds: ['lab-access'] },
    })
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    await screen.findByText('Draft revisions')
    fireEvent.click(screen.getByRole('tab', { name: 'Supporter access' }))
    const featureSelect = screen.getByLabelText('Supporter feature')
    fireEvent.change(featureSelect, { target: { value: 'lab-access' } })
    fireEvent.click(
      within(featureSelect.parentElement!).getByRole('button', {
        name: 'Assign',
      }),
    )

    await waitFor(() =>
      expect(serviceMocks.assignFeatureToGroup).toHaveBeenCalledWith(
        'owner-key',
        'founders',
        'lab-access',
      ),
    )
    expect(
      await screen.findByText(
        'Feature access assigned to the supporter group.',
      ),
    ).toBeInTheDocument()
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
        backgrounds: [
          background({ assignedGroupIds: [] }),
          pianoBackground({
            lifecycle: 'published',
            draftVersion: null,
            draftRevisionId: null,
          }),
        ],
        groups: [
          group({
            id: 'launch-patrons',
            slug: 'launch-patrons',
            name: 'Launch patrons',
            kind: 'manual',
            memberCount: 0,
            backgroundIds: [],
            featureIds: [],
          }),
        ],
      }),
    })
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    await screen.findByText('Draft revisions')
    fireEvent.click(screen.getByRole('tab', { name: 'Supporter access' }))

    expect(screen.getByLabelText('Shipped background')).toBeEnabled()
    expect(
      screen.getByRole('option', { name: 'Jam — Golden Stage' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Piano Night — Velvet Recital' }),
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
    fireEvent.click(screen.getByRole('tab', { name: 'Jam room passes' }))
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
      name: 'Revoke Jam room pass',
    })
    fireEvent.click(actions.at(-1)!)

    await waitFor(() =>
      expect(
        serviceMocks.revokePremiumBackgroundCapability,
      ).toHaveBeenCalledWith('owner-key', 'capability-1'),
    )
    expect(
      await screen.findByText(
        'Jam room pass revoked and the capability list refreshed.',
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
    fireEvent.click(screen.getByRole('tab', { name: 'Jam room passes' }))
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

  it('flags passes that cross the Jam-only background boundary', async () => {
    serviceMocks.loadPremiumPerks.mockResolvedValue({
      ok: true,
      value: snapshot({
        backgrounds: [pianoBackground()],
        capabilities: [capability({ backgroundId: 'piano-velvet-recital' })],
      }),
    })
    render(() => <AdminPremiumPerksPage adminKey="owner-key" />)

    await screen.findByText('Draft revisions')
    fireEvent.click(screen.getByRole('tab', { name: 'Jam room passes' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      '1 pass is outside the Jam-only boundary',
    )
    expect(
      screen.getByText(
        'Piano Night backgrounds cannot receive Jam room passes',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Revoke Velvet Recital pass for room room-sunrise-session',
      }),
    ).toBeEnabled()
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
