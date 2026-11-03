import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  return {
    server: isDev
      ? {
        host: "::",
        port: 8081,
        cors: {
          origin: true,
          credentials: true,
        },
        // Ignore zip archives and other binary/non-source files so Windows
        // file-system watchers never try to lock them (prevents EBUSY crash).
        watch: {
          ignored: [
            '**/*.zip',
            '**/*.xlsx',
            '**/*.pdf',
            '**/node_modules/**',
            '**/dist/**',
            '**/.git/**',
          ],
        },
        // Dev-only proxy. In production, your app will call the absolute API URL directly.
        proxy: {
          '/api': {
            target: 'https://aimarking.z29.web.core.windows.net/',
            changeOrigin: true,
            secure: false,
            rewrite: (p) => p.replace(/^\/api/, '/ai-apps/api'),
          },
          // The image repo serves page images without an Access-Control-Allow-Origin
          // header, so <img> renders them but fetch() is blocked. Downloading needs
          // to read the bytes, so route those reads through the dev server to make
          // them same-origin.
          '/ICMEOcrRepo': {
            target: 'https://ailevate-poc.excelsoftcorp.com',
            changeOrigin: true,
            secure: false,
          },
        },
      }
      : {
        host: "::",
        port: 8081,
        cors: {
          origin: true,
          credentials: true,
        },
        watch: {
          ignored: ['**/*.zip', '**/*.xlsx', '**/*.pdf', '**/node_modules/**', '**/dist/**'],
        },
      },
    plugins: [
      react(),
      isDev && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
});
