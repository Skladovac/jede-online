import path from 'path'
import { defineConfig } from 'vitest/config'

// Testy běží na čistém Node, bez Next.js runtime — logika žije v čistých funkcích v src/lib.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
