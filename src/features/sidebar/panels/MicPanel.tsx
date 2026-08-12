// Mic & Sensitivity — universal, on every tab. One global setting
// (pitchperfect_sensitivity_preset) applied wherever pitch is next
// detected, so there is no tab where changing it is meaningless. The
// registry appends this panel when a tab's layout forgets to list it.

import type { Component } from 'solid-js'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { MicSensitivityControls } from '@/components/MicSensitivityControls'
import { useSidebarHost } from '@/features/sidebar/sidebar-host'

export const MicPanel: Component = () => {
  const host = useSidebarHost()
  return (
    <CollapsibleSection title="Mic & Sensitivity" storageKey="sidebar-mic-open">
      <div data-tour="singing.mic-sensitivity">
        <MicSensitivityControls onAutoCalibrate={host.onAutoCalibrate} />
      </div>
    </CollapsibleSection>
  )
}
