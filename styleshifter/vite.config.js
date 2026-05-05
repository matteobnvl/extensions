import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "./",
    define: {
      __GROQ_API_KEY__: JSON.stringify(env.API_KEY_GROQ),
    },
    build: {
      outDir: "dist",
      rollupOptions: {
        input: {
          popup: resolve(__dirname, "popup.html"),
        },
      },
    },
  };
});
