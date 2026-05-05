import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry:    resolve(__dirname, 'src/content.js'),
      name:     'BetclicAIContent',
      fileName: () => 'content.js',
      formats:  ['iife'],
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
})
