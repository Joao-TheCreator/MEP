import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sítio Dae Han",
    short_name: "Sítio",
    description: "Cuide do sítio junto com os amigos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8ecd2",
    theme_color: "#3b2630",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
