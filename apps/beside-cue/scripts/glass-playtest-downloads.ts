// Native playtest downloads retain their Android package type and installable filename.
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Plugin } from 'vite'

export function glassPlaytestDownloads(): Plugin {
  return {
    name: 'glass-playtest-downloads',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const match = request.url
          ?.split('?')[0]
          .match(
            /^\/\.cache\/native-delivery\/(besidecue-build-[1-9]\d*\.apk)$/u,
          )
        if (!match || !['GET', 'HEAD'].includes(request.method ?? '')) {
          next()
          return
        }
        try {
          const file = await stat(
            join(server.config.root, '.cache/native-delivery', match[1]),
          )
          if (!file.isFile()) {
            response.statusCode = 404
            response.end()
            return
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            next(error)
            return
          }
          // Missing packages must not fall through to the app's HTML shell.
          response.statusCode = 404
          response.end()
          return
        }
        response.setHeader(
          'Content-Type',
          'application/vnd.android.package-archive',
        )
        response.setHeader(
          'Content-Disposition',
          `attachment; filename="${match[1]}"`,
        )
        response.setHeader('X-Content-Type-Options', 'nosniff')
        // Vite retains its filesystem allowlist, range handling and streaming.
        next()
      })
    },
  }
}
