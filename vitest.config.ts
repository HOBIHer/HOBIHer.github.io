import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**', 'backups/**'],
    setupFiles: './src/test/setup.ts',
  },
})
