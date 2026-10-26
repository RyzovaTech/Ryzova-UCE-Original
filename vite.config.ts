import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  server: {
    // Vite dev mirrors production's allowlisted public metadata endpoint.
    // The browser never fetches arbitrary remote URLs or sends private code.
    proxy: {
      "/api/gitlab/archive": {
        target: "https://gitlab.com",
        changeOrigin: true,
        rewrite(url) {
          return url.replace(/^\/api\/gitlab\/archive\/(\d+)/,
            "/api/v4/projects/$1/repository/archive.zip");
        },
      },
      "/api/codeberg/archive": {
        target: "https://codeberg.org",
        changeOrigin: true,
        rewrite(url) {
          return url.replace(/^\/api\/codeberg\/archive\/([^/]+)\/([^/]+)\/(.+)$/,
            "/$1/$2/archive/$3");
        },
      },
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
  // Same development URL contract as Vercel's public metadata endpoint.
  // Fixed host allowlist avoids making Vite an arbitrary open URL proxy.
  plugins: [
    react(),
    {
      name: "uce-public-repository-metadata-dev",
      configureServer(server) {
        server.middlewares.use("/api/repository/metadata", async (req, res) => {
          const query = new URL(req.url ?? "/", "http://localhost").searchParams;
          const provider = query.get("provider");
          const repoPath = query.get("path");
          const pieces = repoPath?.split("/") ?? [];
          const ok = (provider === "gitlab" || provider === "codeberg") &&
            pieces.length >= 2 && pieces.length <= (provider === "gitlab" ? 8 : 2) &&
            pieces.every(x => /^[a-zA-Z0-9_.-]+$/.test(x) && x !== "." && x !== ".." && x !== "-");
          res.setHeader("Cache-Control", "private, no-store");
          res.setHeader("Content-Type", "application/json");
          if (req.method !== "GET" || !ok) {
            res.statusCode = 400; res.end(JSON.stringify({ error: "Invalid public repository" })); return;
          }
          const url = provider === "gitlab"
            ? "https://gitlab.com/api/v4/projects/" + encodeURIComponent(repoPath!)
            : "https://codeberg.org/api/v1/repos/" + pieces.map(encodeURIComponent).join("/");
          try {
            const response = await fetch(url, { headers: { Accept: "application/json" },
              redirect: "error", signal: AbortSignal.timeout(15000) });
            if (!response.ok) { res.statusCode = response.status; res.end(JSON.stringify({ error: "Unavailable public repository" })); return; }
            const data = await response.json() as { id?: number; default_branch?: string; private?: boolean; empty?: boolean; visibility?: string };
            if (!data.default_branch || (provider === "gitlab" && (data.visibility !== "public" || !Number.isSafeInteger(data.id))) ||
              (provider === "codeberg" && (data.private !== false || data.empty === true))) throw Error("Unavailable public source");
            res.end(JSON.stringify({ default_branch: data.default_branch,
              ...(provider === "gitlab" ? { id: data.id } : {}) }));
          } catch {
            res.statusCode = 502; res.end(JSON.stringify({ error: "Public repository metadata unavailable" }));
          }
        });
      },
    },
  ],
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
