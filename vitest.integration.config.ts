import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.integration.spec.ts'],
    testTimeout: 60_000, // 60s per test
    hookTimeout: 60_000,
  },
  plugins: [tsconfigPaths()],
})
