import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // You can add additional Vitest configuration options here
  },
  plugins: [tsconfigPaths()],
})
