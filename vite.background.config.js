import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry:    resolve(__dirname, 'src/background.js'),
      name:     'BetclicAIBg',
      fileName: () => 'background.js',
      formats:  ['iife'],
    },
  },
})
