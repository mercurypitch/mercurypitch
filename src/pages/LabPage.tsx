import type { Component } from 'solid-js'
import { lazy, Suspense } from 'solid-js'
import { SkeletonTabContent } from '@/components/Skeleton'
import type { LabTab } from '@/features/lab/LabSurface'

const LabSurface = lazy(async () =>
  import('@/features/lab/LabSurface').then((m) => ({ default: m.LabSurface })),
)

/** Hidden research surface. Lazy so none of the heavy spectral tooling is in
 *  the main bundle — the Analysis page must not pay for it. */
export const LabPage: Component<{ initialTab?: LabTab }> = (props) => (
  <Suspense fallback={<SkeletonTabContent />}>
    <LabSurface initialTab={props.initialTab} />
  </Suspense>
)
