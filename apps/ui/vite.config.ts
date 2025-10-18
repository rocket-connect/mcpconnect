import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/components": resolve(__dirname, "./src/components"),
      "@/lib": resolve(__dirname, "./src/lib"),
      "@/hooks": resolve(__dirname, "./src/hooks"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "terser",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "router-vendor": ["react-router-dom"],
          "icons-vendor": ["lucide-react"],
          "mcp-adapters": [
            "@mcpconnect/adapter-ai-sdk",
            "@mcpconnect/adapter-localstorage",
            "@mcpconnect/base-adapters",
          ],
          "mcp-components": ["@mcpconnect/components"],
          utils: ["nanoid", "clsx"],
        },
        chunkFileNames: "js/[name]-[hash].js",
        entryFileNames: "js/[name]-[hash].js",
        assetFileNames: assetInfo => {
          const info = assetInfo?.name?.split(".") ?? [];
          const ext = info.length > 0 ? info[info.length - 1] : "";
          if (/\.(css)$/.test(assetInfo?.name ?? "")) {
            return `css/[name]-[hash].${ext}`;
          }
          if (
            /\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/.test(assetInfo?.name ?? "")
          ) {
            return `images/[name]-[hash].${ext}`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo?.name ?? "")) {
            return `fonts/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info"],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    reportCompressedSize: false,
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    host: true,
    cors: true,
  },
  preview: {
    port: 3000,
    host: true,
  },
  // CRITICAL FIX: Use absolute path for assets in production
  base: "/",
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "lucide-react",
      "nanoid",
      "clsx",
    ],
    exclude: ["@mcpconnect/adapter-ai-sdk", "@mcpconnect/adapter-localstorage"],
  },
});
