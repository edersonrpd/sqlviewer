import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SQL Viewer",
  description: "Visualize resultados de consultas MySQL. Tudo é processado no navegador.",
  robots: { index: false, follow: false },
};

// Aplica o tema do sistema antes da pintura para evitar flash. Nada é salvo no navegador.
const scriptTema = `try{if(window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
