// ============================================================
// Practice Intelligence — barrel exports
// ============================================================

// Adaptive difficulty
export {
  computeEma,
  suggestedDifficulty,
  getSuggestedDifficulty,
  clampDifficulty,
  difficultyLabel,
} from './adaptive-difficulty'

// Difficulty store
export {
  getDifficulty,
  setDifficulty,
  updateDifficultyFromEma,
  resetAllDifficulties,
  getAllDifficulties,
} from './difficulty-store'

// Trends computer
export {
  computeWeeklyTrends,
  computeMonthlyTrends,
  computeRollingAverage,
  computeImprovementRate,
  computePracticeStats,
  computePerExerciseStats,
  getRecentScores,
} from './trends-computer'

export type {
  WeeklyTrend,
  MonthlyTrend,
  RollingAverage,
  PracticeStats,
  PerExerciseStats,
} from './trends-computer'

// Weakness analyzer
export {
  findWeakExercises,
  findWeakPitches,
  findWeakIntervals,
  generateWeaknessReport,
  hasWeaknesses,
} from './weakness-analyzer'

export type {
  WeakExercise,
  WeakPitch,
  WeakInterval,
  WeaknessReport,
} from './weakness-analyzer'

// Drill generator
export {
  generatePrecisionDrill,
  generateRangeDrill,
  generateIntervalDrill,
  generateStaminaDrill,
  generateDrills,
} from './drill-generator'

export type { MicroDrill } from './drill-generator'

// Components
export { DifficultyIndicator } from './components/DifficultyIndicator'
export { SparklineChart } from './components/SparklineChart'
export { PracticeSummaryCard } from './components/PracticeSummaryCard'
export { WeaknessPanel } from './components/WeaknessPanel'
export { CalendarHeatmap } from './components/CalendarHeatmap'
