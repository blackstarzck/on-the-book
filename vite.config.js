import { defineConfig } from "vite";
import { resolve } from "node:path";
import { staticImagePreviews } from './scripts/static-image-previews.js';
export default defineConfig(({ mode }) => ({
  plugins: [staticImagePreviews()],
  build: {
    outDir: mode === "client" || mode === "admin" ? `dist/${mode}` : "dist",
    rollupOptions: {
      input: {
        client: resolve("client/index.html"),
        ...(mode === "admin" ? {} : { about: resolve("client/about/index.html") }),
        ...(mode === "client" ? {} : { admin: resolve("admin/index.html") }),
      },
    },
  },
}));
