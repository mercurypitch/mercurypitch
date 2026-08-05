// ============================================================
// Premium Perks admin API — backgrounds, revisions and supporter groups
// ============================================================
//
// The Worker exposes its normalized asset/revision rows and group ledger as
// separate owner-only resources. This module is the adapter: the UI receives
// one task-shaped snapshot, while UUID revision ids, protected content fetches
// and the X-Admin-Key header remain centralized here.

import type { BackgroundPerkId, BackgroundSurface, } from '@/lib/backgrounds/background-catalog'
import { getBackgroundDefinition } from '@/lib/backgrounds/background-catalog'
import { API_BASE_URL, DEV_DOMAIN, PROD_DOMAIN } from '@/lib/defaults'

export const PREMIUM_BACKGROUND_VARIANTS = [
  'landscape-2k',
  'landscape-4k',
  'portrait-2k',
] as const

export type PremiumBackgroundVariant =
  (typeof PREMIUM_BACKGROUND_VARIANTS)[number]
export type PremiumBackgroundLifecycle = 'draft' | 'published' | 'retired'
export type SupporterGroupKind = 'automatic' | 'manual'

export interface AdminEnvironment {
  kind: 'development' | 'preview' | 'production' | 'unknown'
  label: string
}

export interface AdminBackgroundVariant {
  id: string
  variant: PremiumBackgroundVariant
  bytes: number
  width: number
  height: number
  sha256: string
  updatedAt: string
}

export interface AdminBackgroundVersion {
  id: string
  version: number
  status: 'draft' | 'published' | 'superseded'
  variants: Partial<Record<PremiumBackgroundVariant, AdminBackgroundVariant>>
  createdAt: string
  publishedAt?: string
}

export interface AdminPremiumBackground {
  id: BackgroundPerkId
  label: string
  description: string
  surface: BackgroundSurface
  edition: string
  lifecycle: PremiumBackgroundLifecycle
  publishedVersion: number | null
  publishedRevisionId: string | null
  draftVersion: number | null
  draftRevisionId: string | null
  versions: AdminBackgroundVersion[]
  assignedGroupIds: string[]
  updatedAt: string
}

export interface SupporterGroupMember {
  email: string
  note: string | null
  addedAt: string
}

export interface SupporterGroup {
  id: string
  slug: string
  name: string
  description: string
  kind: SupporterGroupKind
  active: boolean
  memberCount: number
  members: SupporterGroupMember[]
  backgroundIds: BackgroundPerkId[]
  updatedAt: string
}

export interface AdminPremiumCapability {
  id: string
  backgroundId: BackgroundPerkId
  version: number
  roomId: string
  issuerUserId: string
  issuedAt: string
  expiresAt: string
  revokedAt: string | null
}

export interface PremiumPerksSnapshot {
  backgrounds: AdminPremiumBackground[]
  groups: SupporterGroup[]
  capabilities: AdminPremiumCapability[]
  environment: AdminEnvironment
}

export interface SupporterGroupDraft {
  name: string
  description: string
}

export type AdminApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

interface AssetVariantResponse {
  id: string
  name: PremiumBackgroundVariant
  width: number
  height: number
  byteSize: number
  sha256: string
  etag: string | null
  createdAt: string
  updatedAt: string
}

interface AssetRevisionResponse {
  id: string
  version: number
  lifecycle: 'draft' | 'published' | 'superseded'
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  supersededAt: string | null
  variants: AssetVariantResponse[]
}

interface AssetResponse {
  id: BackgroundPerkId
  surface: BackgroundSurface
  title: string
  description: string
  status: 'active' | 'retired'
  activeRevisionId: string | null
  createdAt: string
  updatedAt: string
  retiredAt: string | null
  revisions: AssetRevisionResponse[]
}

interface GroupResponse {
  id: string
  slug: string
  name: string
  description: string
  kind: SupporterGroupKind
  active: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  members: Array<{
    email: string
    note: string | null
    grantedAt: string
    revokedAt: string | null
  }>
  perks: Array<{
    backgroundId: BackgroundPerkId
    assignedAt: string
    revokedAt: string | null
  }>
}

interface CapabilityResponse {
  id: string
  backgroundId: BackgroundPerkId
  version: number
  roomId: string
  issuerUserId: string
  issuedAt: string
  expiresAt: string
  revokedAt: string | null
}

function base(): string {
  return API_BASE_URL ?? ''
}

function adminHeaders(adminKey: string, json = false): HeadersInit {
  return {
    'X-Admin-Key': adminKey,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function request<T>(
  path: string,
  adminKey: string,
  init: RequestInit = {},
): Promise<AdminApiResult<T>> {
  if (base() === '') return { ok: false, error: 'No API configured.' }
  try {
    const response = await fetch(`${base()}${path}`, {
      ...init,
      headers: {
        ...adminHeaders(adminKey),
        ...init.headers,
      },
    })
    const data = (await response.json().catch(() => null)) as
      | (T & { error?: string })
      | null
    if (!response.ok) {
      return {
        ok: false,
        error:
          data?.error ??
          `The premium perks API returned ${response.status}. Try again.`,
      }
    }
    if (data === null) {
      return { ok: false, error: 'The premium perks API returned no data.' }
    }
    return { ok: true, value: data }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

function encode(value: string): string {
  return encodeURIComponent(value)
}

function inferEnvironment(): AdminEnvironment {
  if (base() === '') return { kind: 'unknown', label: 'No API configured' }
  try {
    const host = new URL(base()).hostname
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === DEV_DOMAIN ||
      host.endsWith(`.${DEV_DOMAIN}`) ||
      host.includes('api-dev')
    ) {
      return { kind: 'development', label: `Development · ${host}` }
    }
    if (host.includes('preview') || host.includes('.workers.dev')) {
      return { kind: 'preview', label: `Preview · ${host}` }
    }
    if (host === PROD_DOMAIN || host.endsWith(`.${PROD_DOMAIN}`)) {
      return { kind: 'production', label: `Production · ${host}` }
    }
    return { kind: 'unknown', label: host }
  } catch {
    return { kind: 'unknown', label: base() }
  }
}

function normalizeVersion(row: AssetRevisionResponse): AdminBackgroundVersion {
  const variants: Partial<
    Record<PremiumBackgroundVariant, AdminBackgroundVariant>
  > = {}
  for (const variant of row.variants) {
    variants[variant.name] = {
      id: variant.id,
      variant: variant.name,
      bytes: variant.byteSize,
      width: variant.width,
      height: variant.height,
      sha256: variant.sha256,
      updatedAt: variant.updatedAt,
    }
  }
  return {
    id: row.id,
    version: row.version,
    status: row.lifecycle,
    variants,
    createdAt: row.createdAt,
    ...(row.publishedAt === null ? {} : { publishedAt: row.publishedAt }),
  }
}

function normalizeGroup(row: GroupResponse): SupporterGroup {
  const members = row.members
    .filter((member) => member.revokedAt === null)
    .map((member) => ({
      email: member.email,
      note: member.note,
      addedAt: member.grantedAt,
    }))
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    kind: row.kind,
    active: row.active && row.deletedAt === null,
    memberCount: members.length,
    members,
    backgroundIds: row.perks
      .filter((perk) => perk.revokedAt === null)
      .map((perk) => perk.backgroundId),
    updatedAt: row.updatedAt,
  }
}

function normalizeBackground(
  row: AssetResponse,
  groups: SupporterGroup[],
): AdminPremiumBackground {
  const definition = getBackgroundDefinition(row.id)
  const versions = row.revisions.map(normalizeVersion)
  const draft = versions.find((revision) => revision.status === 'draft') ?? null
  const published =
    versions.find((revision) => revision.id === row.activeRevisionId) ?? null
  const lifecycle: PremiumBackgroundLifecycle =
    row.status === 'retired'
      ? 'retired'
      : draft !== null
        ? 'draft'
        : published !== null
          ? 'published'
          : 'draft'
  return {
    id: row.id,
    label: row.title,
    description: row.description,
    surface: row.surface,
    edition: definition?.edition ?? 'unclassified',
    lifecycle,
    publishedVersion: published?.version ?? null,
    publishedRevisionId: published?.id ?? null,
    draftVersion: draft?.version ?? null,
    draftRevisionId: draft?.id ?? null,
    versions,
    assignedGroupIds: groups
      .filter((group) => group.backgroundIds.includes(row.id))
      .map((group) => group.id),
    updatedAt: row.updatedAt,
  }
}

export function normalizeSupporterEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null
  }
  return email
}

function loadAssetRows(
  adminKey: string,
): Promise<AdminApiResult<{ assets: AssetResponse[] }>> {
  return request('/api/admin/premium-backgrounds', adminKey)
}

function loadGroupRows(
  adminKey: string,
): Promise<AdminApiResult<{ groups: GroupResponse[] }>> {
  return request('/api/admin/supporter-groups', adminKey)
}

function activeGroups(rows: GroupResponse[]): SupporterGroup[] {
  return rows.filter((group) => group.deletedAt === null).map(normalizeGroup)
}

export async function loadPremiumPerks(
  adminKey: string,
): Promise<AdminApiResult<PremiumPerksSnapshot>> {
  const [assetsResult, groupsResult, capabilitiesResult] = await Promise.all([
    loadAssetRows(adminKey),
    loadGroupRows(adminKey),
    loadPremiumBackgroundCapabilities(adminKey),
  ])
  if (!assetsResult.ok) return assetsResult
  if (!groupsResult.ok) return groupsResult
  if (!capabilitiesResult.ok) return capabilitiesResult
  const groups = activeGroups(groupsResult.value.groups)
  return {
    ok: true,
    value: {
      backgrounds: assetsResult.value.assets.map((asset) =>
        normalizeBackground(asset, groups),
      ),
      groups,
      capabilities: capabilitiesResult.value,
      environment: inferEnvironment(),
    },
  }
}

export async function loadPremiumBackgroundCapabilities(
  adminKey: string,
): Promise<AdminApiResult<AdminPremiumCapability[]>> {
  const result = await request<{ capabilities: CapabilityResponse[] }>(
    '/api/admin/premium-background-capabilities',
    adminKey,
  )
  return result.ok ? { ok: true, value: result.value.capabilities } : result
}

export async function revokePremiumBackgroundCapability(
  adminKey: string,
  capabilityId: string,
): Promise<AdminApiResult<AdminPremiumCapability[]>> {
  const result = await request<{ ok: true; revokedAt: string }>(
    `/api/admin/premium-background-capabilities/${encode(capabilityId)}/revoke`,
    adminKey,
    { method: 'POST' },
  )
  return result.ok ? loadPremiumBackgroundCapabilities(adminKey) : result
}

async function refreshedBackground(
  adminKey: string,
  backgroundId: BackgroundPerkId,
): Promise<AdminApiResult<AdminPremiumBackground>> {
  const [assetsResult, groupsResult] = await Promise.all([
    loadAssetRows(adminKey),
    loadGroupRows(adminKey),
  ])
  if (!assetsResult.ok) return assetsResult
  if (!groupsResult.ok) return groupsResult
  const row = assetsResult.value.assets.find((item) => item.id === backgroundId)
  const background =
    row === undefined
      ? undefined
      : normalizeBackground(row, activeGroups(groupsResult.value.groups))
  return background === undefined
    ? { ok: false, error: 'The updated background was not returned.' }
    : { ok: true, value: background }
}

async function refreshedGroup(
  adminKey: string,
  groupId: string,
): Promise<AdminApiResult<SupporterGroup>> {
  const groupsResult = await loadGroupRows(adminKey)
  if (!groupsResult.ok) return groupsResult
  const group = activeGroups(groupsResult.value.groups).find(
    (item) => item.id === groupId,
  )
  return group === undefined
    ? { ok: false, error: 'The updated supporter group was not returned.' }
    : { ok: true, value: group }
}

export async function loadBackgroundVariantPreview(
  adminKey: string,
  backgroundId: BackgroundPerkId,
  revisionId: string,
  variant: PremiumBackgroundVariant,
): Promise<AdminApiResult<Blob>> {
  if (base() === '') return { ok: false, error: 'No API configured.' }
  try {
    const response = await fetch(
      `${base()}/api/admin/premium-backgrounds/${encode(backgroundId)}/revisions/${encode(revisionId)}/variants/${encode(variant)}/content`,
      { headers: adminHeaders(adminKey) },
    )
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      return {
        ok: false,
        error: data?.error ?? `Preview request failed (${response.status}).`,
      }
    }
    const blob = await response.blob()
    if (blob.type !== 'image/webp') {
      return { ok: false, error: 'The preview response was not a WebP image.' }
    }
    return { ok: true, value: blob }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

export async function createBackgroundVersion(
  adminKey: string,
  backgroundId: BackgroundPerkId,
): Promise<AdminApiResult<AdminPremiumBackground>> {
  const result = await request<{ revision: AssetRevisionResponse }>(
    `/api/admin/premium-backgrounds/${encode(backgroundId)}/revisions`,
    adminKey,
    { method: 'POST' },
  )
  return result.ok ? refreshedBackground(adminKey, backgroundId) : result
}

export async function uploadBackgroundVariant(
  adminKey: string,
  backgroundId: BackgroundPerkId,
  revisionId: string,
  variant: PremiumBackgroundVariant,
  file: File,
): Promise<AdminApiResult<AdminPremiumBackground>> {
  if (file.type !== 'image/webp') {
    return { ok: false, error: 'Choose a WebP image for this variant.' }
  }
  const result = await request<{ variant: AssetVariantResponse }>(
    `/api/admin/premium-backgrounds/${encode(backgroundId)}/revisions/${encode(revisionId)}/variants/${encode(variant)}/content`,
    adminKey,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      body: file,
    },
  )
  return result.ok ? refreshedBackground(adminKey, backgroundId) : result
}

export async function removeBackgroundVariant(
  adminKey: string,
  backgroundId: BackgroundPerkId,
  revisionId: string,
  variant: PremiumBackgroundVariant,
): Promise<AdminApiResult<AdminPremiumBackground>> {
  const result = await request<{ ok: true }>(
    `/api/admin/premium-backgrounds/${encode(backgroundId)}/revisions/${encode(revisionId)}/variants/${encode(variant)}`,
    adminKey,
    { method: 'DELETE' },
  )
  return result.ok ? refreshedBackground(adminKey, backgroundId) : result
}

export async function publishBackgroundVersion(
  adminKey: string,
  backgroundId: BackgroundPerkId,
  revisionId: string,
): Promise<AdminApiResult<AdminPremiumBackground>> {
  const result = await request<{ revision: AssetRevisionResponse }>(
    `/api/admin/premium-backgrounds/${encode(backgroundId)}/revisions/${encode(revisionId)}/publish`,
    adminKey,
    { method: 'POST' },
  )
  return result.ok ? refreshedBackground(adminKey, backgroundId) : result
}

export async function retireBackground(
  adminKey: string,
  backgroundId: BackgroundPerkId,
): Promise<AdminApiResult<AdminPremiumBackground>> {
  const result = await request<{ asset: AssetResponse }>(
    `/api/admin/premium-backgrounds/${encode(backgroundId)}/retire`,
    adminKey,
    { method: 'POST' },
  )
  return result.ok ? refreshedBackground(adminKey, backgroundId) : result
}

export async function restoreBackground(
  adminKey: string,
  backgroundId: BackgroundPerkId,
): Promise<AdminApiResult<AdminPremiumBackground>> {
  const result = await request<{ asset: AssetResponse }>(
    `/api/admin/premium-backgrounds/${encode(backgroundId)}/restore`,
    adminKey,
    { method: 'POST' },
  )
  return result.ok ? refreshedBackground(adminKey, backgroundId) : result
}

export async function createSupporterGroup(
  adminKey: string,
  draft: SupporterGroupDraft,
): Promise<AdminApiResult<SupporterGroup>> {
  const result = await request<{ group: GroupResponse }>(
    '/api/admin/supporter-groups',
    adminKey,
    {
      method: 'POST',
      headers: adminHeaders(adminKey, true),
      body: JSON.stringify(draft),
    },
  )
  return result.ok ? refreshedGroup(adminKey, result.value.group.id) : result
}

export async function updateSupporterGroup(
  adminKey: string,
  groupId: string,
  draft: SupporterGroupDraft,
): Promise<AdminApiResult<SupporterGroup>> {
  const result = await request<{ group: GroupResponse }>(
    `/api/admin/supporter-groups/${encode(groupId)}`,
    adminKey,
    {
      method: 'PATCH',
      headers: adminHeaders(adminKey, true),
      body: JSON.stringify(draft),
    },
  )
  return result.ok ? refreshedGroup(adminKey, groupId) : result
}

export async function addSupporterGroupMember(
  adminKey: string,
  groupId: string,
  rawEmail: string,
): Promise<AdminApiResult<SupporterGroup>> {
  const email = normalizeSupporterEmail(rawEmail)
  if (email === null) {
    return { ok: false, error: 'Enter a complete email address.' }
  }
  const result = await request<{ member: object }>(
    `/api/admin/supporter-groups/${encode(groupId)}/members`,
    adminKey,
    {
      method: 'POST',
      headers: adminHeaders(adminKey, true),
      body: JSON.stringify({ email }),
    },
  )
  return result.ok ? refreshedGroup(adminKey, groupId) : result
}

export async function revokeSupporterGroupMember(
  adminKey: string,
  groupId: string,
  rawEmail: string,
): Promise<AdminApiResult<SupporterGroup>> {
  const email = normalizeSupporterEmail(rawEmail)
  if (email === null) {
    return { ok: false, error: 'Enter a complete email address.' }
  }
  const result = await request<{ ok: true; revokedAt: string }>(
    `/api/admin/supporter-groups/${encode(groupId)}/members/${encode(email)}`,
    adminKey,
    { method: 'DELETE' },
  )
  return result.ok ? refreshedGroup(adminKey, groupId) : result
}

export async function assignBackgroundToGroup(
  adminKey: string,
  groupId: string,
  backgroundId: BackgroundPerkId,
): Promise<AdminApiResult<SupporterGroup>> {
  const result = await request<{ perk: object }>(
    `/api/admin/supporter-groups/${encode(groupId)}/perks/${encode(backgroundId)}`,
    adminKey,
    { method: 'POST' },
  )
  return result.ok ? refreshedGroup(adminKey, groupId) : result
}

export async function removeBackgroundFromGroup(
  adminKey: string,
  groupId: string,
  backgroundId: BackgroundPerkId,
): Promise<AdminApiResult<SupporterGroup>> {
  const result = await request<{ perk: object }>(
    `/api/admin/supporter-groups/${encode(groupId)}/perks/${encode(backgroundId)}`,
    adminKey,
    { method: 'DELETE' },
  )
  return result.ok ? refreshedGroup(adminKey, groupId) : result
}
