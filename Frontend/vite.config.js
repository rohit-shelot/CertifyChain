import { defineConfig } from 'vite'
import path from "path";
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  define: {
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
});