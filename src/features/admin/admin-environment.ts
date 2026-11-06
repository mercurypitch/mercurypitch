// ============================================================
// Admin environment — which API, and so which environment, a console's changes reach
// ============================================================
//
// Every environment has its own db-worker and its own data: what the
// console sets on the dev site never reaches production. The page cannot
// see past its API's address, so the address is what decides, and the label
// carries the host so the owner can check it with his own eyes.

import { DEV_DOMAIN, PROD_DOMAIN } from '@/lib/defaults'

export interface AdminEnvironment {
  kind: 'development' | 'preview' | 'production' | 'unknown'
  label: string
}

/** The environment behind API base `base`: "Production · api.mercurypitch.com". */
export function adminEnvironment(base: string): AdminEnvironment {
  if (base === '') return { kind: 'unknown', label: 'No API configured' }
  try {
    const host = new URL(base).hostname
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
    return { kind: 'unknown', label: base }
  }
}
