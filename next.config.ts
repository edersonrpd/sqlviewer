import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy: o navegador só carrega e só se conecta à própria aplicação.
 * É o que garante, fora do código, que os dados colados não saem da página: não há
 * origem externa permitida para requisições, scripts, imagens, fontes, frames ou formulários.
 * ('unsafe-inline' é exigido pelos scripts de hidratação do Next e pelo script do tema;
 * em desenvolvimento o Next também precisa de eval e do WebSocket de recarga.)
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
