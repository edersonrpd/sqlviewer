import type { MetadataRoute } from "next";

/** Manifesto do PWA: permite instalar o SQL Viewer como aplicativo e usá-lo sem internet. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SQL Viewer",
    short_name: "SQL Viewer",
    description: "Visualize resultados de consultas MySQL. Tudo é processado no navegador, também sem internet.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f9fc",
    theme_color: "#2563eb",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
