// ============================================================
// The Ear Lab with Merc's lazy chunk: the drill room and the tab.
//
// Loaded only through dynamic imports behind EAR_LAB_WITH_MERC
// (stage-switch.tsx, EarLabPage.tsx), so the web and the store build
// fold the branch away and carry none of it, its fonts included
// (assert-bundle.mjs STAGE 2). Crimson Pro is Merc's bubble and the
// plates' serif; the app's own serif stands in until it has loaded.
// ============================================================

import '@fontsource-variable/crimson-pro/wght.css'
import '@fontsource-variable/crimson-pro/wght-italic.css'

export { MercDrillRoom } from './MercDrillRoom'
