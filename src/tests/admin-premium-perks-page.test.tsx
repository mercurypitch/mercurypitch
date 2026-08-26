import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPremiumPerksPage } from '@/features/admin/AdminPremiumPerksPage'
import type { AdminPremiumBackground, AdminPremiumCapability, PremiumPerksSnapshot, SupporterGroup, } from '@/features/admin/premium-perks-admin-service'
import type { BackgroundPerkId, BackgroundSurface, } from '@/lib/backgrounds/background-catalog'
import { BACKGROUND_CATALOG } from '@/lib/backgrounds/background-catalog'

/** Derived, so a new surface arrives here without anyone remembering to. */
const BACKGROUND_SURFACES = [
  ...new Set(BACKGROUND_CATALOG.map((background) => background.surface)),
]

const surfaceButtonName = (surface: BackgroundSurface): string =>
  surface === 'piano'
    ? 'Piano Night'
    : surface === 'guitar'
      ? 'Guitar Night'
      : surface === 'karaoke'
        ? 'Karaoke'
        : 'Jam'

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
    // Every surface the catalog knows has to be reachable here, or a whole
    // room family becomes invisible to whoever has to retire or assign it —
    // which is exactly the state Guitar Night was in before it joined.
    for (const surface of BACKGROUND_SURFACES) {
      expect(
        within(filters).getByRole('button', {
          name: new RegExp(`^${surfaceButtonName(surface)}\\b`),
        }),
      ).toBeInTheDocument()
    }

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

    // Guitar Night has a filter and an empty shelf: the surface exists, and
    // the supporter art for it does not yet. An empty shelf that says so is
    // the honest state — the four rooms Guitar Night ships are free, and
    // this library only ever holds supporter identities.
    fireEvent.click(
      within(filters).getByRole('button', { name: /^Guitar Night\b/ }),
    )
    expect(
      within(library).queryByRole('button', { name: /^Golden Stage\b/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('No Guitar Night backgrounds')).toBeInTheDocument()
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

    // Both offered, each under its own surface: a shipped revision stays
    // assignable while its replacement is still a draft.
    expect(
      screen.getByRole('button', { name: 'Golden Stage', pressed: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Velvet Recital', pressed: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Select every Jam background'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Select every Piano Night background'),
    ).toBeInTheDocument()
  })

  // ── Bulk background assignment ──────────────────────────────────────
  // The Room Library took the supporter shelf past fifty rooms. One
  // dropdown and one Assign button meant a group took fifty round trips,
  // so the picker assigns sets: everything, a whole surface, or whatever
  // another group already has.
  describe('assigning backgrounds in bulk', () => {
    /** Four rooms across two surfaces, none of them assigned yet. */
    const shelf = (): PremiumPerksSnapshot =>
      snapshot({
        backgrounds: [
          background({
            id: 'golden-stage',
            label: 'Golden Stage',
            surface: 'jam',
            lifecycle: 'published',
            draftVersion: null,
            draftRevisionId: null,
            assignedGroupIds: [],
          }),
          background({
            id: 'aurora-loft',
            label: 'Aurora Loft',
            surface: 'jam',
            lifecycle: 'published',
            draftVersion: null,
            draftRevisionId: null,
            assignedGroupIds: [],
          }),
          pianoBackground({
            id: 'piano-velvet-recital',
            label: 'Velvet Recital',
            lifecycle: 'published',
            draftVersion: null,
            draftRevisionId: null,
          }),
          pianoBackground({
            id: 'piano-aurora-loft',
            label: 'Aurora Loft (Piano)',
            lifecycle: 'published',
            draftVersion: null,
            draftRevisionId: null,
          }),
        ],
        groups: [
          group({
            id: 'founders',
            slug: 'founders',
            name: 'Founders',
            kind: 'manual',
            memberCount: 1,
            backgroundIds: [],
            featureIds: [],
          }),
        ],
      })

    const openSupporterAccess = async (): Promise<void> => {
      render(() => <AdminPremiumPerksPage adminKey="owner-key" />)
      await screen.findByText('Draft revisions')
      fireEvent.click(screen.getByRole('tab', { name: 'Supporter access' }))
    }

    beforeEach(() => {
      serviceMocks.loadPremiumPerks.mockResolvedValue({
        ok: true,
        value: shelf(),
      })
      serviceMocks.assignBackgroundToGroup.mockImplementation(
        (_key: string, groupId: string, backgroundId: BackgroundPerkId) =>
          Promise.resolve({
            ok: true,
            value: group({
              id: groupId,
              slug: 'founders',
              name: 'Founders',
              kind: 'manual',
              backgroundIds: [backgroundId],
              featureIds: [],
            }),
          }),
      )
    })

    it('assigns a whole surface from one checkbox', async () => {
      await openSupporterAccess()

      fireEvent.click(screen.getByLabelText('Select every Jam background'))
      // The count is the promise the button makes, so it is part of the test.
      const assign = screen.getByRole('button', {
        name: 'Assign 2 backgrounds',
      })
      fireEvent.click(assign)

      await waitFor(() =>
        expect(serviceMocks.assignBackgroundToGroup).toHaveBeenCalledTimes(2),
      )
      expect(
        serviceMocks.assignBackgroundToGroup.mock.calls.map((c) => c[2]).sort(),
      ).toEqual(['aurora-loft', 'golden-stage'])
      // Piano was never ticked and must not have been swept up.
      expect(
        serviceMocks.assignBackgroundToGroup.mock.calls.map((c) => c[2]),
      ).not.toContain('piano-velvet-recital')
    })

    it('assigns every unassigned background from the header row', async () => {
      await openSupporterAccess()

      fireEvent.click(
        screen.getByLabelText('Select every unassigned background'),
      )
      fireEvent.click(
        screen.getByRole('button', { name: 'Assign 4 backgrounds' }),
      )

      await waitFor(() =>
        expect(serviceMocks.assignBackgroundToGroup).toHaveBeenCalledTimes(4),
      )
      expect(
        await screen.findByText(
          '4 backgrounds assigned to the supporter group.',
        ),
      ).toBeInTheDocument()
    })

    it('copies what another group already has', async () => {
      serviceMocks.loadPremiumPerks.mockResolvedValue({
        ok: true,
        value: {
          ...shelf(),
          groups: [
            group({
              id: 'founders',
              slug: 'founders',
              name: 'Founders',
              kind: 'manual',
              backgroundIds: [],
              featureIds: [],
            }),
            group({
              id: 'active-supporters',
              name: 'Active Supporters',
              kind: 'automatic',
              backgroundIds: ['golden-stage', 'piano-velvet-recital'],
              featureIds: [],
            }),
          ],
        },
      })
      await openSupporterAccess()
      // The page opens on the automatic group; the copy target is the
      // manual one that has nothing yet.
      fireEvent.click(screen.getByRole('button', { name: /Founders/ }))

      fireEvent.change(
        screen.getByLabelText('Copy assignments from another group'),
        { target: { value: 'active-supporters' } },
      )

      // Exactly the two that group has — not its surfaces, not everything.
      expect(
        screen.getByRole('button', { name: 'Assign 2 backgrounds' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Golden Stage', pressed: true }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Aurora Loft', pressed: false }),
      ).toBeInTheDocument()
    })

    it('says what landed when one of a batch fails', async () => {
      // No bulk endpoint behind this, so a batch is a loop and a loop can
      // fail halfway. Silence would leave the rest of the shelf a guess.
      serviceMocks.assignBackgroundToGroup.mockImplementation(
        (_key: string, groupId: string, backgroundId: BackgroundPerkId) =>
          backgroundId === 'aurora-loft'
            ? Promise.resolve({ ok: false, error: 'Conflict' })
            : Promise.resolve({
                ok: true,
                value: group({
                  id: groupId,
                  slug: 'founders',
                  name: 'Founders',
                  kind: 'manual',
                  backgroundIds: [backgroundId],
                  featureIds: [],
                }),
              }),
      )
      await openSupporterAccess()

      fireEvent.click(screen.getByLabelText('Select every Jam background'))
      fireEvent.click(
        screen.getByRole('button', { name: 'Assign 2 backgrounds' }),
      )

      expect(
        await screen.findByText(
          'Assigned 1 of 2. Still unassigned: Aurora Loft.',
        ),
      ).toBeInTheDocument()
      // The one that failed stays ticked, so a retry is one click.
      expect(
        screen.getByRole('button', { name: 'Aurora Loft', pressed: true }),
      ).toBeInTheDocument()
    })

    it('offers nothing to add once the group holds everything', async () => {
      serviceMocks.loadPremiumPerks.mockResolvedValue({
        ok: true,
        value: {
          ...shelf(),
          groups: [
            group({
              id: 'founders',
              slug: 'founders',
              name: 'Founders',
              kind: 'manual',
              backgroundIds: [
                'golden-stage',
                'aurora-loft',
                'piano-velvet-recital',
                'piano-aurora-loft',
              ],
              featureIds: [],
            }),
          ],
        },
      })
      await openSupporterAccess()

      expect(
        screen.getByText(
          'Every shipped background is already assigned to this group.',
        ),
      ).toBeInTheDocument()
      expect(
        screen.queryByLabelText('Select every unassigned background'),
      ).toBeNull()
    })
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
