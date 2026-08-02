import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mathforces — математические контесты",
    short_name: "Mathforces",
    description: "Олимпиадные математические контесты, посылки и рейтинг в одном приложении.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f8f6",
    theme_color: "#13233d",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    lang: "ru",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
