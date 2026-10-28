// ============================================================
// The Ear Lab's lazy island: the "With Merc" row
// ============================================================
//
// The one module the Ear Lab loads from this folder, and only through a
// dynamic import behind PREMIUM_EXERCISES (EarLabPage.tsx). A store build
// folds that branch away, so nothing here, and none of the rooms' stored
// signals, reaches its graph.

export { EarMercRow } from './EarMercRow'
// The Ear Lab with Merc's tab draws the rooms its own way, from the same
// catalogue group (EarRoomsRow.tsx), behind the same switch.
export { EarRoomsRow } from './EarRoomsRow'
