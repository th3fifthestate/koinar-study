// Polyfills that MUST run before `import next from 'next'`.
//
// Next 16 reads `globalThis.AsyncLocalStorage` at module-load time in
// `next/dist/server/app-render/async-local-storage.js`. If absent, it falls
// back to a stub that throws the moment anything calls `.run()` — which the
// instrumentation hook does. Node 22/24 do not expose AsyncLocalStorage as a
// global, so in a custom-server dev setup (tsx watch server.ts) we must do it
// ourselves. Production is unaffected — `.next/standalone/server.js` runs
// Next's own bootstrap, which handles this.
import { AsyncLocalStorage } from 'node:async_hooks'

type ALSGlobal = typeof globalThis & { AsyncLocalStorage?: typeof AsyncLocalStorage }
const g = globalThis as ALSGlobal
if (typeof g.AsyncLocalStorage === 'undefined') {
  g.AsyncLocalStorage = AsyncLocalStorage
}
