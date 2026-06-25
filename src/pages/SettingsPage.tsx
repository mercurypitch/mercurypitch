import { SettingsPanel } from '@/components/SettingsPanel'

/** Settings tab (TAB_SETTINGS). Thin wrapper around SettingsPanel. */
export function SettingsPage() {
  return (
    <div id="settings-panel">
      <SettingsPanel />
    </div>
  )
}
