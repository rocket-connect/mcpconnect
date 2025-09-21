// apps/ui/vite.config.ts
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
    sourcemap: false, // Disable sourcemaps for production
    minify: "terser",
    cssMinify: true,
    rollupOptions: {
      output: {
        // Split vendor code into separate chunks for better caching
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
        // Optimize asset naming for better caching
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
    // Terser compression options
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info"], // Remove specific console methods
        passes: 2, // Run compression twice for better results
      },
      mangle: {
        safari10: true, // Fix Safari 10 issues
      },
      format: {
        comments: false, // Remove all comments
      },
    },
    // Optimize chunk size warning
    chunkSizeWarningLimit: 1000,
    // Improve tree shaking
    cssCodeSplit: true,
    // Enable build optimizations
    reportCompressedSize: false, // Faster builds
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
  base: "./",
  // Optimize dependencies pre-bundling
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
