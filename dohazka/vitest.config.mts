import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Testy běží na čistém Node, bez Next.js runtime — logika žije v čistých funkcích v src/lib.
// Přípona .mts, aby se konfigurace načítala jako ESM (bez varování od Vite).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
