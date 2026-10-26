// Node 25 executes repo TypeScript; resolve its extensionless relative imports for this standalone receipt.
import { registerHooks } from 'node:module'
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts'))
        return next(`${specifier}.ts`, context)
      throw error
    }
  },
})
await import('./meter-reference-check.ts')
