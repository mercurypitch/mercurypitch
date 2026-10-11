// ============================================================
// The Sing room's lazy island: the exercise row and the picker
// ============================================================
//
// The one module the Sing room loads from this folder, and only through a
// dynamic import behind PREMIUM_EXERCISES (SingRoomStage.tsx). A store
// build folds that branch away, so nothing here, and none of Long note's
// stored signals, reaches its graph.

export { ExercisePicker } from './ExercisePicker'
export { ExerciseRow } from './ExerciseRow'
