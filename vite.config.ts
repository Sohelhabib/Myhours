import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "icons/*.png",
        "fonts/*.ttf",
      ],
      manifest: {
        id: "/",
        name: "MyHours — Your time, clearly counted",
        short_name: "MyHours",
        description:
          "Track multiple jobs, manual shifts, paid hours and estimated earnings. Export weekly and monthly PDF timesheets.",
        lang: "en-GB",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#edf2ed",
        theme_color: "#294e40",
        orientation: "any",
        categories: ["productivity", "finance"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Add a shift",
            short_name: "Add shift",
            url: "/?action=shift",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "My reports",
            short_name: "Reports",
            url: "/?tab=reports",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,ttf,webmanifest}"],
        maximumFileSizeToCacheInBytes: 3000000,
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local", "localhost"],
    port: 5173,
  },
  build: { sourcemap: false, target: "es2022" },
});
