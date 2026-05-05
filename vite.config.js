import { defineConfig } from 'vite'
import { resolve } from 'path'

const ENTRY = process.env.ENTRY ?? 'popup'

export default defineConfig({
  build: ENTRY === 'popup'
    ? {
        outDir: 'dist',
        rollupOptions: {
          input: { popup: resolve(__dirname, 'popup.html') },
        },
      }
    : {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
          entry:    resolve(__dirname, `src/${ENTRY}.js`),
          name:     ENTRY === 'content' ? 'BetclicAIContent' : 'BetclicAIBg',
          fileName: () => `${ENTRY}.js`,
          formats:  ['iife'],
        },
      },
})
