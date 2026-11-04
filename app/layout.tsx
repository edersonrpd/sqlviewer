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

// Aplica o tema antes da pintura para evitar flash: o escolhido no botão (único valor
// salvo no navegador, em localStorage "sqlviewer-tema") ou, sem escolha, o do sistema.
const scriptTema = `try{var t=null;try{t=localStorage.getItem('sqlviewer-tema')}catch(e){}if(t==='escuro'||(t!=='claro'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

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
