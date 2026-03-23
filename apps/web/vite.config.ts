import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base =
  process.env.VITE_BASE_PATH ?? (process.env.GITHUB_ACTIONS ? "/formae/" : "/");

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["brandmark.svg"],
      manifest: {
        name: "Formaê",
        short_name: "Formaê",
        description:
          "Academic assistant for UFBA students with private data stored locally.",
        theme_color: "#0b4f6c",
        background_color: "#f4efe7",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "brandmark.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
  },
});
