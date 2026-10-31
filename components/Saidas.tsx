"use client";

import { useEffect, useRef, useState } from "react";
import { celulasPlanilha, FORMATOS_COPIA, gerarCSV, gerarFormato, nomeArquivo, type FormatoCopia } from "@/lib/exportar";
import type { ResultadoParse } from "@/lib/tipos";
import { IconeCopiar, IconeDownload, IconeSeta } from "./Icones";
import { baixarArquivo, copiarTexto, useAviso } from "./util";

type Base = { dados: ResultadoParse; linhas: number[]; colunas: number[]; /** nome da tabela para o SQL INSERT */ tabela?: string };

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
  useFecharAoClicarFora(aberto, ref, () => setAberto(false));

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
        <div role="menu" className="painel absolute right-0 z-50 mt-1 w-72 animate-surgir p-1 shadow-lg">
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
        </div>
      )}
    </div>
  );
}

function useFecharAoClicarFora(aberto: boolean, ref: React.RefObject<HTMLElement | null>, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) fechar();
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto, ref, fechar]);
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
}: Base & { rotulo: string; semLinhas: string; /** botão principal da barra (índigo, com brilho) */ destaque?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useAviso();
  const ref = useRef<HTMLDivElement>(null);

  useFecharAoClicarFora(aberto, ref, () => setAberto(false));

  const copiar = async (formato: FormatoCopia) => {
    setAberto(false);
    const ok = await copiarTexto(gerarFormato(formato, dados, linhas, colunas, tabela));
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
        <div role="menu" className="painel absolute right-0 z-50 mt-1 max-h-[70vh] w-72 animate-surgir overflow-auto p-1 shadow-lg">
          {/* "Lista" primeiro: é o formato mais usado em chamados */}
          {[...FORMATOS_COPIA.filter((f) => f.id === "lista"), ...FORMATOS_COPIA.filter((f) => f.id !== "lista")].map((f) => (
            <button key={f.id} role="menuitem" className="block w-full rounded px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => copiar(f.id)}>
              <span className="block text-sm font-medium">{f.rotulo}</span>
              <span className="block text-xs text-zinc-500">{f.descricao}</span>
            </button>
          ))}
        </div>
      )}
      {aviso && (
        <span role="status" className="absolute top-full right-0 z-50 mt-1 rounded bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap text-white dark:bg-zinc-100 dark:text-zinc-900">
          {aviso}
        </span>
      )}
    </div>
  );
}
