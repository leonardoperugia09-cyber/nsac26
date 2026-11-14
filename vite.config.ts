import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "HALO research prototype",
        short_name: "HALO",
        start_url: "/",
        display: "standalone",
        theme_color: "#173949",
        background_color: "#f5f7f8",
        icons: [
          {
            src: "/halo-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg}"],
        maximumFileSizeToCacheInBytes: 3000000,
        navigateFallback: "/index.html",
      },
    }),
  ],
  server: { proxy: { "/api": "http://127.0.0.1:3001" } },
});
