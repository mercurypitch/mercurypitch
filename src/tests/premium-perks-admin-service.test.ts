import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addSupporterGroupMember, assignFeatureToGroup, loadBackgroundVariantPreview, loadPremiumPerks, normalizeSupporterEmail, revokePremiumBackgroundCapability, uploadBackgroundVariant, } from '@/features/admin/premium-perks-admin-service'

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'https://api-dev.example.test',
  DEV_DOMAIN: 'api-dev.example.test',
  PROD_DOMAIN: 'api.example.test',
}))

const now = '2026-08-05T10:00:00.000Z'

const rawVariant = {
  id: 'variant-landscape-2k',
  name: 'landscape-2k',
  width: 2560,
  height: 1440,
  byteSize: 1200,
  sha256: 'sha256-landscape-2k',
  etag: 'etag-landscape-2k',
  createdAt: now,
  updatedAt: now,
}

const rawAsset = {
  id: 'golden-stage',
  surface: 'jam',
  title: 'Golden Stage',
  description: 'A warm supporter stage.',
  status: 'active',
  activeRevisionId: 'revision-1',
  createdAt: now,
  updatedAt: now,
  retiredAt: null,
  revisions: [
    {
      id: 'revision-1',
      version: 1,
      lifecycle: 'published',
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      supersededAt: null,
      variants: [rawVariant],
    },
  ],
}

const rawGroup = {
  id: 'group-1',
  slug: 'launch-patrons',
  name: 'Launch patrons',
  description: 'Manual launch group.',
  kind: 'manual',
  active: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  members: [
    {
      email: 'singer@example.com',
      note: null,
      grantedAt: now,
      revokedAt: null,
    },
  ],
  perks: [
    {
      backgroundId: 'golden-stage',
      assignedAt: now,
      revokedAt: null,
    },
  ],
  features: [
    {
      featureId: 'lab-access',
      assignedAt: now,
      revokedAt: null,
    },
    {
      featureId: 'unknown-feature',
      assignedAt: now,
      revokedAt: null,
    },
  ],
}

const rawCapability = {
  id: 'capability-1',
  backgroundId: 'golden-stage',
  version: 1,
  roomId: 'room-sunrise-session',
  issuerUserId: 'user-owner-123456789',
  issuedAt: now,
  expiresAt: '2099-08-05T11:00:00.000Z',
  revokedAt: null,
}

function jsonResponse(value: object): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('premium perks admin service', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('loads and normalises all owner resources with the shared admin key', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ assets: [rawAsset] }))
      .mockResolvedValueOnce(jsonResponse({ groups: [rawGroup] }))
      .mockResolvedValueOnce(jsonResponse({ capabilities: [rawCapability] }))

    const result = await loadPremiumPerks('owner-key')

    expect(result).toEqual({
      ok: true,
      value: {
        backgrounds: [
          expect.objectContaining({
            id: 'golden-stage',
            lifecycle: 'published',
            publishedRevisionId: 'revision-1',
            publishedVersion: 1,
            assignedGroupIds: ['group-1'],
          }),
        ],
        groups: [
          expect.objectContaining({
            id: 'group-1',
            active: true,
            memberCount: 1,
            backgroundIds: ['golden-stage'],
            featureIds: ['lab-access'],
          }),
        ],
        capabilities: [rawCapability],
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
      },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api-dev.example.test/api/admin/premium-backgrounds',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Admin-Key': 'owner-key' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-dev.example.test/api/admin/supporter-groups',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Admin-Key': 'owner-key' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api-dev.example.test/api/admin/premium-background-capabilities',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Admin-Key': 'owner-key' }),
      }),
    )
  })

  it('uploads a WebP to one UUID revision slot and refreshes the background', async () => {
    const file = new File(['art'], 'golden-stage.webp', {
      type: 'image/webp',
    })
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ variant: rawVariant }))
      .mockResolvedValueOnce(jsonResponse({ assets: [rawAsset] }))
      .mockResolvedValueOnce(jsonResponse({ groups: [] }))

    const result = await uploadBackgroundVariant(
      'owner-key',
      'golden-stage',
      'revision-1',
      'landscape-4k',
      file,
    )

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ id: 'golden-stage' }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api-dev.example.test/api/admin/premium-backgrounds/golden-stage/revisions/revision-1/variants/landscape-4k/content',
      expect.objectContaining({
        method: 'PUT',
        body: file,
        headers: expect.objectContaining({
          'Content-Type': 'image/webp',
          'X-Admin-Key': 'owner-key',
        }),
      }),
    )
  })

  it('rejects the wrong file type before making a request', async () => {
    const result = await uploadBackgroundVariant(
      'owner-key',
      'golden-stage',
      'revision-1',
      'landscape-2k',
      new File(['art'], 'stage.png', { type: 'image/png' }),
    )

    expect(result).toEqual({
      ok: false,
      error: 'Choose a WebP image for this variant.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads protected preview bytes with owner authorization', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Blob(['webp'], { type: 'image/webp' }), {
        status: 200,
        headers: { 'Content-Type': 'image/webp' },
      }),
    )

    const result = await loadBackgroundVariantPreview(
      'owner-key',
      'golden-stage',
      'revision-1',
      'portrait-2k',
    )

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-dev.example.test/api/admin/premium-backgrounds/golden-stage/revisions/revision-1/variants/portrait-2k/content',
      {
        headers: expect.objectContaining({ 'X-Admin-Key': 'owner-key' }),
      },
    )
  })

  it('normalises group emails and uses the normalised address in writes', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ member: {} }))
      .mockResolvedValueOnce(jsonResponse({ groups: [rawGroup] }))

    expect(normalizeSupporterEmail('  Singer@Example.COM ')).toBe(
      'singer@example.com',
    )
    expect(normalizeSupporterEmail('not-an-email')).toBeNull()

    const result = await addSupporterGroupMember(
      'owner-key',
      'group-1',
      '  Singer@Example.COM ',
    )
    const init = fetchMock.mock.calls[0]?.[1]
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ id: 'group-1' }),
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api-dev.example.test/api/admin/supporter-groups/group-1/members',
    )
    expect(init?.body).toBe(JSON.stringify({ email: 'singer@example.com' }))
  })

  it('assigns a catalogued feature and refreshes the group ledger', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ feature: {} }))
      .mockResolvedValueOnce(jsonResponse({ groups: [rawGroup] }))

    const result = await assignFeatureToGroup(
      'owner-key',
      'group-1',
      'lab-access',
    )

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        featureIds: ['lab-access'],
        id: 'group-1',
      }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api-dev.example.test/api/admin/supporter-groups/group-1/features/lab-access',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Admin-Key': 'owner-key' }),
      }),
    )
  })

  it('revokes one room capability and refreshes the owner ledger', async () => {
    const revoked = { ...rawCapability, revokedAt: now }
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, revokedAt: now }))
      .mockResolvedValueOnce(jsonResponse({ capabilities: [revoked] }))

    const result = await revokePremiumBackgroundCapability(
      'owner-key',
      'capability/1',
    )

    expect(result).toEqual({ ok: true, value: [revoked] })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api-dev.example.test/api/admin/premium-background-capabilities/capability%2F1/revoke',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Admin-Key': 'owner-key' }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api-dev.example.test/api/admin/premium-background-capabilities',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Admin-Key': 'owner-key' }),
      }),
    )
  })
})
