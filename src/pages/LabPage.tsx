import type { Component } from 'solid-js'
import { createResource, lazy, Match, onCleanup, onMount, Suspense, Switch, } from 'solid-js'
import { Lock } from '@/components/icons'
import { SkeletonTabContent } from '@/components/Skeleton'
import { authVersion } from '@/db/services/user-service'
import type { LabTab } from '@/features/lab/LabSurface'
import { fetchPerksMe, hasSupporterFeatureAccess, } from '@/lib/backgrounds/background-access'
import { IS_DEV } from '@/lib/defaults'
import styles from './LabPage.module.css'

const LabSurface = lazy(async () =>
  import('@/features/lab/LabSurface').then((m) => ({ default: m.LabSurface })),
)

/** Supporter research surface. The heavy spectral tooling is requested only
 * after the authenticated Worker grants access (or in an explicit dev build). */
export const LabPage: Component<{ initialTab?: LabTab }> = (props) => {
  const [perks, { refetch }] = createResource(
    () => (IS_DEV ? false : `auth:${authVersion()}`),
    () => fetchPerksMe(),
  )
  const granted = () =>
    IS_DEV || hasSupporterFeatureAccess(perks() ?? null, 'lab-access')

  onMount(() => {
    if (IS_DEV) return
    const refreshAccess = (): void => {
      if (document.visibilityState === 'visible') void refetch()
    }
    window.addEventListener('focus', refreshAccess)
    document.addEventListener('visibilitychange', refreshAccess)
    onCleanup(() => {
      window.removeEventListener('focus', refreshAccess)
      document.removeEventListener('visibilitychange', refreshAccess)
    })
  })

  return (
    <Switch>
      <Match when={granted()}>
        <Suspense fallback={<SkeletonTabContent />}>
          <LabSurface initialTab={props.initialTab} />
        </Suspense>
      </Match>
      <Match when={perks.loading}>
        <section class={styles.gate} aria-live="polite" aria-busy="true">
          <span class={styles.checking} aria-hidden="true" />
          <div>
            <h1>Checking Lab access</h1>
            <p>Confirming your supporter benefits with MercuryPitch.</p>
          </div>
        </section>
      </Match>
      <Match when={true}>
        <section class={styles.gate} aria-labelledby="lab-access-title">
          <span class={styles.lock} aria-hidden="true">
            <Lock size={20} />
          </span>
          <div>
            <h1 id="lab-access-title">MercuryPitch Lab</h1>
            <p>
              Lab is an early-access supporter benefit for experimental audio
              tools and development previews. Core singing and practice tools
              remain free.
            </p>
            <div class={styles.actions}>
              <a class={styles.primaryAction} href="#/settings/credits">
                View supporter benefits
              </a>
              <button
                type="button"
                class={styles.retryAction}
                disabled={perks.loading}
                onClick={() => void refetch()}
              >
                Check again
              </button>
            </div>
            <p class={styles.hint}>
              {perks() === null
                ? 'Access could not be verified. Sign in, then try again.'
                : 'Already assigned this perk? Sign in with the matching verified account.'}
            </p>
          </div>
        </section>
      </Match>
    </Switch>
  )
}
