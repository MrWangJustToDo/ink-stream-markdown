import path from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    deps: { neverBundle: ['react', 'ink'] },
  },
  {
    entry: { browser: 'src/browser.ts' },
    format: ['esm'],
    dts: true,
    deps: { neverBundle: ['react', 'ink'] },
    alias: {
      [path.resolve('src/platform')]: path.resolve('src/platform-browser'),
    },
  },
])
