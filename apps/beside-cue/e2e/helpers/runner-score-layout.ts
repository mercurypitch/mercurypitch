// Runner score layout fixture — freeze a real compiled phrase for host geometry, without changing the audio-clock runtime.
import type { Page } from '@playwright/test'

/** Layout-only fixture. The course, judge, host view and controls remain real. */
export async function useRunnerThreeNoteLayout(page: Page): Promise<void> {
  await page.route(
    /\/packages\/glass-game\/src\/browser\/runner-session\.ts(?:\?.*)?$/,
    async (route) => {
      const request = new URL(route.request().url())
      if (request.searchParams.has('layoutProofOriginal'))
        return route.continue()
      const prefix = request.pathname.slice(
        0,
        request.pathname.lastIndexOf('/browser/'),
      )
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          import { createBrowserRunnerSession as original } from '${request.pathname}?layoutProofOriginal';
          import { createRunnerJudge } from '${prefix}/runner/judge.ts';
          import { runnerSecondsToBeat } from '${prefix}/runner/tempo.ts';
          import { runnerCourseDistanceAt } from '${prefix}/runner/movement.ts';
          export function createBrowserRunnerSession(options) {
            const real = original(options);
            const course = options.course;
            const target = course.targets.find(candidate => candidate.notes.length === 3);
            if (!target) throw new Error('The compiled course needs a three-note phrase for this layout proof.');
            const seconds = target.judgeOpenCourseSeconds + 0.1;
            const beat = runnerSecondsToBeat(course.tempoSegments, seconds);
            const judge = createRunnerJudge(course, options.comfortableMidi);
            const base = real.state();
            const chunkIndex = Math.min(course.chunks.length - 1, Math.floor(beat / (course.lengthBeats / course.chunks.length)));
            const game = {
              ...base.game,
              status: 'running', epoch: 'layout-only', courseSeconds: seconds,
              courseBeat: beat, courseDistanceMeters: runnerCourseDistanceAt(course, seconds),
              activeChunkId: course.chunks[chunkIndex].id,
              residentChunkIds: course.chunks.slice(Math.max(0, chunkIndex - 1), chunkIndex + 2).map(chunk => chunk.id),
              activeTarget: judge.targetSnapshot(target, seconds),
              upcomingTargetIds: course.targets.filter(candidate => candidate.onsetCourseSeconds > seconds && candidate.id !== target.id).slice(0, 2).map(candidate => candidate.id)
            };
            let state = {...base, game};
            const listeners = new Set();
            return {
              ...real,
              state: () => state,
              subscribe(listener) {
                listeners.add(listener);
                listener({state, events: [], presentation: false});
                return () => listeners.delete(listener);
              },
              setPresentationReady(ready) {
                if (!ready) return;
                state = {...state, phase: 'running', microphone: 'ready'};
                for (const listener of listeners) listener({state, events: [], presentation: true});
              },
              input: () => false,
              steer: () => false
            };
          }
        `,
      })
    },
  )
}
