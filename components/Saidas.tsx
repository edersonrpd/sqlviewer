"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { celulasPlanilha, FORMATOS_COPIA, gerarCSV, gerarFormato, nomeArquivo, type FormatoCopia } from "@/lib/exportar";
import type { ResultadoParse } from "@/lib/tipos";
import { IconeCopiar, IconeDownload, IconeSeta } from "./Icones";
import { baixarArquivo, copiarTexto, useAviso } from "./util";

type Base = { dados: ResultadoParse; linhas: number[]; colunas: number[]; /** nome da tabela para o SQL INSERT */ tabela?: string; /** coluna que identifica o registro, para o SQL SELECT */ chave?: string | readonly string[] };

// downloads além de CSV e Excel
const ARQUIVOS: { formato: FormatoCopia; rotulo: string; descricao: string; extensao: string; tipo: string }[] = [
  { formato: "json", rotulo: "JSON", descricao: "Lista de objetos { COLUNA: valor }", extensao: "json", tipo: "application/json" },
  { formato: "markdown", rotulo: "Markdown", descricao: "Tabela .md para wikis e GitHub", extensao: "md", tipo: "text/markdown;charset=utf-8" },
  { formato: "insert", rotulo: "SQL INSERT", descricao: "Um INSERT por linha, valores originais", extensao: "sql", tipo: "application/sql;charset=utf-8" },
  { formato: "texto", rotulo: "Texto alinhado", descricao: "Como o cliente mysql no terminal", extensao: "txt", tipo: "text/plain;charset=utf-8" },
];

/** "Exportar" com menu: CSV ou Excel (linhas filtradas, colunas visíveis). */
export function BotoesExportar({ dados, linhas, colunas, nomeBase, tabela = "TABELA" }: Base & { nomeBase: string }) {
  const [gerando, setGerando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const vazio = colunas.length === 0;

  const exportarCSV = () => {
    baixarArquivo(gerarCSV(dados, linhas, colunas), nomeArquivo(nomeBase, "csv"), "text/csv;charset=utf-8");
  };

  const exportarExcel = async () => {
    setGerando(true);
    try {
      // carregado sob demanda: só quem exporta baixa a biblioteca
      const XLSX = await import("xlsx");
      const celulas = celulasPlanilha(dados, linhas, colunas);
      const ws: import("xlsx").WorkSheet = {};
      celulas.forEach((linha, r) =>
        linha.forEach((cel, c) => {
          ws[XLSX.utils.encode_cell({ r, c })] = cel;
        }),
      );
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, celulas.length - 1), c: Math.max(0, colunas.length - 1) } });
      ws["!cols"] = colunas.map((j) => ({ wch: Math.min(50, Math.max(8, dados.colunas[j].nome.length + 2)) }));
      const wb = XLSX.utils.book_new();
      const nomePlanilha = nomeBase.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Consulta";
      XLSX.utils.book_append_sheet(wb, ws, nomePlanilha);
      const saida: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true });
      baixarArquivo(saida, nomeArquivo(nomeBase, "xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn"
        disabled={vazio || gerando}
        title={`${linhas.length.toLocaleString("pt-BR")} linha(s) filtradas, colunas visíveis`}
        onClick={() => setAberto(!aberto)}
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <IconeDownload /> {gerando ? "Gerando…" : "Exportar"}
        <IconeSeta className="h-3.5 w-3.5" />
      </button>
      {aberto && (
        <MenuFlutuante ancora={ref} onFechar={() => setAberto(false)}>
          <button
            role="menuitem"
            className="block w-full rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setAberto(false);
              exportarCSV();
            }}
          >
            <span className="block text-sm font-medium">CSV</span>
            <span className="block text-xs text-zinc-500">Separado por ; e UTF-8 (abre no Excel pt-BR), valores originais</span>
          </button>
          <button
            role="menuitem"
            className="block w-full rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setAberto(false);
              void exportarExcel();
            }}
          >
            <span className="block text-sm font-medium">Excel</span>
            <span className="block text-xs text-zinc-500">Planilha .xlsx; códigos gravados como texto</span>
          </button>
          {ARQUIVOS.map((a) => (
            <button
              key={a.formato}
              role="menuitem"
              className="block w-full rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => {
                setAberto(false);
                baixarArquivo(gerarFormato(a.formato, dados, linhas, colunas, tabela), nomeArquivo(nomeBase, a.extensao), a.tipo);
              }}
            >
              <span className="block text-sm font-medium">{a.rotulo}</span>
              <span className="block text-xs text-zinc-500">{a.descricao}</span>
            </button>
          ))}
        </MenuFlutuante>
      )}
    </div>
  );
}

/**
 * Menu preso a um botão, desenhado por cima da página (portal com posição fixa):
 * não é cortado por painéis com rolagem (ex.: a coluna de Ações da Tela).
 * Alinha pela direita do botão, sem sair da janela, e abre para cima quando
 * falta espaço embaixo. Fecha ao clicar fora ou com Esc.
 */
function MenuFlutuante({ ancora, onFechar, children }: { ancora: React.RefObject<HTMLElement | null>; onFechar: () => void; children: ReactNode }) {
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    const calcular = () => {
      const a = ancora.current?.getBoundingClientRect();
      const m = menu.current;
      if (!a || !m) return;
      const margem = 8;
      const largura = m.offsetWidth;
      const altura = m.scrollHeight;
      let left = a.right - largura;
      if (left < margem) left = a.left;
      left = Math.max(margem, Math.min(left, window.innerWidth - largura - margem));
      const abaixo = window.innerHeight - a.bottom - margem - 4;
      const acima = a.top - margem - 4;
      const paraCima = altura > abaixo && acima > abaixo;
      const maxHeight = Math.max(120, paraCima ? acima : abaixo);
      const top = paraCima ? a.top - 4 - Math.min(altura, maxHeight) : a.bottom + 4;
      setPos({ top, left, maxHeight });
    };
    calcular();
    window.addEventListener("resize", calcular);
    window.addEventListener("scroll", calcular, true);
    return () => {
      window.removeEventListener("resize", calcular);
      window.removeEventListener("scroll", calcular, true);
    };
  }, [ancora]);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!menu.current?.contains(alvo) && !ancora.current?.contains(alvo)) onFechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [ancora, onFechar]);

  return createPortal(
    <div
      ref={menu}
      role="menu"
      style={pos ?? { top: 0, left: 0, visibility: "hidden" }}
      className="painel fixed z-[70] w-72 animate-surgir overflow-auto bg-white/95 p-1 shadow-2xl dark:bg-zinc-900/95"
    >
      {children}
    </div>,
    document.body,
  );
}

/** Copia registros em "Lista" (COLUNA: valor) ou "Tabulado" (para colar no Excel). */
export function BotaoCopiarChamado({
  dados,
  linhas,
  colunas,
  rotulo,
  semLinhas,
  destaque,
  tabela = "TABELA",
  chave,
}: Base & { rotulo: string; semLinhas: string; /** botão principal da barra (índigo, com brilho) */ destaque?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useAviso();
  const ref = useRef<HTMLDivElement>(null);


  const copiar = async (formato: FormatoCopia) => {
    setAberto(false);
    const ok = await copiarTexto(gerarFormato(formato, dados, linhas, colunas, tabela, chave));
    setAviso(ok ? `Copiado: ${linhas.length} registro(s)` : "Não foi possível copiar");
  };

  const desabilitado = linhas.length === 0 || colunas.length === 0;

  return (
    <div className="relative" ref={ref}>
      <button
        className={destaque ? "btn-destaque" : "btn"}
        disabled={desabilitado}
        title={desabilitado ? semLinhas : `${linhas.length} registro(s), colunas visíveis`}
        onClick={() => setAberto(!aberto)}
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <IconeCopiar /> {rotulo}
        {linhas.length > 0 && <span className={`text-xs tabular-nums ${destaque ? "opacity-70" : "text-zinc-500"}`}>({linhas.length})</span>}
        <IconeSeta className="h-3.5 w-3.5" />
      </button>
      {aberto && (
        <MenuFlutuante ancora={ref} onFechar={() => setAberto(false)}>
          {/* "Lista" primeiro: é o formato mais usado em chamados */}
          {[...FORMATOS_COPIA.filter((f) => f.id === "lista"), ...FORMATOS_COPIA.filter((f) => f.id !== "lista")].map((f) => (
            <button key={f.id} role="menuitem" className="block w-full rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => copiar(f.id)}>
              <span className="block text-sm font-medium">{f.rotulo}</span>
              <span className="block text-xs text-zinc-500">{f.descricao}</span>
            </button>
          ))}
        </MenuFlutuante>
      )}
      {aviso && (
        <span role="status" className="absolute top-full right-0 z-50 mt-1 rounded bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap text-white dark:bg-zinc-100 dark:text-zinc-900">
          {aviso}
        </span>
      )}
    </div>
  );
}
