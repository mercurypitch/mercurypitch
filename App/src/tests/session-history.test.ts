// ============================================================
// Session History Store Tests
// ============================================================

import { vi } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })
//
// describe('Practice Session History', () => {
//   beforeEach(() => {
//     localStorageMock.clear()
//     clearSessionHistory()
//   })
//
//   describe('save practice session history', () => {
//     it('saves a new practice session entry', () => {
//       savePractcieSessionResult({
//         score: 85,
//         avgCents: 12.5,
//         totalItems: 8,
//
//         noteResults: [
//           { midi: 60, avgCents: 5, rating: 'perfect' },
//           { midi: 64, avgCents: 15, rating: 'excellent' },
//         ],
//       })
//
//       const history = getSessionHistory()
//       expect(history.length).toBe(1)
//       expect(history[0].score).toBe(85)
//       expect(history[0].avgCents).toBe(12.5)
//       expect(history[0].totalItems).toBe(8)
//       expect(history[0].noteResults.length).toBe(2)
//     })
//
//     it('generates timestamps on save', () => {
//       saveSession({ score: 70, avgCents: 10, noteCount: 4, noteResults: [] })
//       const history = getSessionHistory()
//       expect(history[0].timestamp).toBeGreaterThan(0)
//     })
//
//     it('limits history to 50 entries', () => {
//       for (let i = 0; i < 55; i++) {
//         saveSession({ score: i, avgCents: i, noteCount: 4, noteResults: [] })
//       }
//       const history = getSessionHistory()
//       expect(history.length).toBe(50)
//     })
//
//     it('saves most recent first', () => {
//       saveSession({ score: 70, avgCents: 10, noteCount: 4, noteResults: [] })
//       saveSession({ score: 90, avgCents: 5, noteCount: 4, noteResults: [] })
//
//       const history = getSessionHistory()
//       expect(history[0].score).toBe(90)
//       expect(history[1].score).toBe(70)
//     })
//   })
//
//   describe('clearSessionHistory', () => {
//     it('clears all session entries', () => {
//       saveSession({ score: 80, avgCents: 10, noteCount: 4, noteResults: [] })
//       saveSession({ score: 85, avgCents: 8, noteCount: 4, noteResults: [] })
//
//       clearSessionHistory()
//       expect(getSessionHistory().length).toBe(0)
//     })
//
//     it('removes from localStorage', () => {
//       saveSession({ score: 80, avgCents: 10, noteCount: 4, noteResults: [] })
//       clearSessionHistory()
//       expect(localStorageMock.removeItem).toHaveBeenCalledWith(
//         'pitchperfect_session_history',
//       )
//     })
//   })
//
//   describe('initSessionHistory', () => {
//     it('loads existing history from localStorage', () => {
//       const storedData: SessionHistoryEntry[] = [
//         {
//           id: 1,
//           timestamp: 1000,
//           score: 75,
//           avgCents: 15,
//           noteCount: 4,
//           noteResults: [],
//         },
//         {
//           id: 2,
//           timestamp: 2000,
//           score: 88,
//           avgCents: 7,
//           noteCount: 4,
//           noteResults: [],
//         },
//       ]
//       localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
//
//       initSessionHistory()
//       const history = getSessionHistory()
//       expect(history.length).toBe(2)
//       expect(history[0].score).toBe(75)
//     })
//
//     it('handles corrupted localStorage gracefully', () => {
//       localStorageMock.getItem.mockReturnValue('not valid json')
//
//       expect(() => {
//         initSessionHistory()
//       }).not.toThrow()
//       expect(getSessionHistory().length).toBe(0)
//     })
//   })
//
//   describe('getNoteAccuracyMap', () => {
//     it('returns empty map when no sessions', () => {
//       const map = getNoteAccuracyMap()
//       expect(map.size).toBe(0)
//     })
//
//     it('computes average accuracy per MIDI note', () => {
//       saveSession({
//         score: 90,
//         avgCents: 5,
//         noteCount: 2,
//         noteResults: [
//           { midi: 60, avgCents: 0, rating: 'perfect' },
//           { midi: 64, avgCents: 0, rating: 'perfect' },
//         ],
//       })
//       saveSession({
//         score: 70,
//         avgCents: 15,
//         noteCount: 2,
//         noteResults: [
//           { midi: 60, avgCents: 20, rating: 'good' },
//           { midi: 67, avgCents: 0, rating: 'perfect' },
//         ],
//       })
//
//       const map = getNoteAccuracyMap()
//       // midi 60: 100 (0¢) and max(0, 0) (20¢) = 100 and 0 -> avg 50
//       // midi 64: 100 (0¢) only -> 100
//       // midi 67: 100 (0¢) only -> 100
//       expect(map.get(60)).toBeDefined()
//       expect(map.get(64)).toBeDefined()
//       expect(map.get(67)).toBeDefined()
//     })
//
//     it('clamps negative cents to max score', () => {
//       saveSession({
//         score: 100,
//         avgCents: -3,
//         noteCount: 1,
//         noteResults: [{ midi: 60, avgCents: -3, rating: 'perfect' }],
//       })
//       const map = getNoteAccuracyMap()
//       // -3¢ >= -5, so score = 100
//       expect(map.get(60)).toBe(100)
//     })
//   })
//
//   describe('appStore integration', () => {
//     it('exposes sessionHistory in appStore', () => {
//       expect(appStore.sessionHistory).toBeDefined()
//       expect(typeof appStore.saveSession).toBe('function')
//       expect(typeof appStore.clearSessionHistory).toBe('function')
//       expect(typeof appStore.initSessionHistory).toBe('function')
//     })
//   })
// })
