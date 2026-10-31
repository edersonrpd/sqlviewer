type P = { className?: string };
const base = "h-4 w-4 shrink-0";
const svg = (d: React.ReactNode) =>
  function Icone({ className }: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className ?? base} aria-hidden>
        {d}
      </svg>
    );
  };

export const IconeX = svg(<path d="M18 6 6 18M6 6l12 12" />);
export const IconeMais = svg(<path d="M12 5v14M5 12h14" />);
export const IconeCopiar = svg(<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>);
export const IconeColunas = svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></>);
export const IconeBusca = svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>);
export const IconePino = svg(<path d="M12 17v5M9 10.76V6h6v4.76l2 3.24H7l2-3.24ZM8 2h8" />);
export const IconeSeta = svg(<path d="m6 9 6 6 6-6" />);
export const IconeEsquerda = svg(<path d="m15 18-6-6 6-6" />);
export const IconeDireita = svg(<path d="m9 18 6-6-6-6" />);
export const IconeLua = svg(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />);
export const IconeSol = svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const IconeDownload = svg(<path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />);
export const IconeLink = svg(<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />);
export const IconeOlhoFechado = svg(<path d="M17.9 17.9A10 10 0 0 1 12 20c-7 0-10-8-10-8a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a18 18 0 0 1-2.2 3.2M1 1l22 22" />);
export const IconeAlerta = svg(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>);
export const IconeBanco = svg(<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>);
export const IconeCadeado = svg(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconeSalvar = svg(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>);
export const IconePasta = svg(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />);
export const IconeComparar = svg(<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />);
export const IconeFunil = svg(<path d="M3 4h18l-7 8.5V19l-4 2v-8.5L3 4Z" />);
export const IconeTranspor = svg(<><path d="M4 4h7v7H4zM13 13h7v7h-7z" /><path d="M15 4h3a2 2 0 0 1 2 2v3M9 20H6a2 2 0 0 1-2-2v-3" /></>);
export const IconePainel = svg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>);
