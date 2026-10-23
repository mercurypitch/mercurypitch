// ============================================================
// Sync for account — the plan sent to the account, only for a singer who holds one
// ============================================================
//
// The one gate in front of plan-sync.ts (R84, R85). App calls it when a load
// or a sign-in asks for a sync, and the plan's screens call it when a plan is
// done (usePlanFlowController's done(), R76), so a singer who holds an account
// has their answers sent at once. For anyone else it loads nothing:
// plan-sync.ts reads the plan record, so it brings the plan's store, and First
// Light draws the questions on a first visit, so a static import of it would
// fetch that chunk for every new visitor. The module is asked for only once
// hasUpgradedAccount() says there is an account. plan-sync.ts asks again,
// because it has to hold on its own, and past that it is plan-sync.ts's to say
// whether there is anything to send.
//
// It never rejects. A check that throws, a module that cannot be had (offline,
// or a deploy swapped the hashed assets) or a sync that fails costs this one
// sync, said once: the next sign-in or load tries again.
//
// App imports this file statically and picks it by IS_NATIVE_BUILD, so the
// native build, which has no plan, drops it with the import() inside it.

import { hasUpgradedAccount } from '@/db/services/auth-service'

/** Sends the plan to the account of a singer who holds one; loads and sends nothing for anyone else. */
export async function syncPlanForAccount(): Promise<void> {
  try {
    if (!hasUpgradedAccount()) return
    const sync = await import('./plan-sync')
    await sync.syncPlanToAccount()
  } catch (error: unknown) {
    console.warn('[plan-sync] The plan was not sent to the account:', error)
  }
}
