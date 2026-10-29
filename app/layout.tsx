import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// fontes servidas pela própria aplicação (o next/font baixa no build; nada é pedido ao Google no navegador)
const inter = Inter({ subsets: ["latin"], variable: "--fonte-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--fonte-mono", display: "swap" });

export const metadata: Metadata = {
  title: "SQL Viewer",
  description: "Visualize resultados de consultas MySQL. Tudo é processado no navegador.",
  robots: { index: false, follow: false },
};

// Aplica o tema do sistema antes da pintura para evitar flash. Nada é salvo no navegador.
const scriptTema = `try{if(window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
