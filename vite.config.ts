import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Grid Tactics PWA",
        short_name: "Grid Tactics",
        description: "オリジナルのターン制タクティカルSRPG",
        theme_color: "#172333",
        background_color: "#101820",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/pwa-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
          { src: "/icons/pwa-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,json}"]
      }
    })
  ]
});
