import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig(({ mode }) => ({
  build: {
    outDir: mode === "client" || mode === "admin" ? `dist/${mode}` : "dist",
    rollupOptions: {
      input: {
        client: resolve("client/index.html"),
        ...(mode === "client" ? {} : { admin: resolve("admin/index.html") }),
      },
    },
  },
}));
