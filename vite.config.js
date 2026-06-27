import { defineConfig, loadEnv } from 'vite'
import path from "path";
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    define: {
      'import.meta.env.VITE_PINATA_JWT': JSON.stringify(env.VITE_PINATA_JWT),
      global: "globalThis",
    },

    resolve: {
      alias: {
        util: path.resolve("node_modules/util/"),
        buffer: path.resolve("node_modules/buffer/"),
        process: "process/browser",
      },
    },

    optimizeDeps: {
      include: ["util", "buffer", "process"],
    },
  }
});