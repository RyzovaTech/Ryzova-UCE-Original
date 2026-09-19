import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/github/archive": {
        target: "https://codeload.github.com",
        changeOrigin: true,
        rewrite(path) {
          return path.replace(
            /^\/api\/github\/archive\/([^/]+)\/([^/]+)\/(.+)$/,
            "/$1/$2/zip/refs/heads/$3",
          );
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router-dom/")
          ) {
            return "vendor-react";
          }
          if (id.includes("/node_modules/jszip/")) {
            return "vendor-zip";
          }
        },
      },
    },
  },
});
