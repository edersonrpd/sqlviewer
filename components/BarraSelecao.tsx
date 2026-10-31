"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FORMATOS_COPIA, gerarFormato, type FormatoCopia } from "@/lib/exportar";
import { agregarSelecao, numeroAgregado, type Retangulo } from "@/lib/selecao";
import type { ResultadoParse } from "@/lib/tipos";
import { IconeCopiar, IconePainel, IconeSeta } from "./Icones";
import { copiarTexto } from "./util";

type Props = {
  dados: ResultadoParse;
  indices: number[];
  colunas: number[];
  ret: Retangulo | null;
  /** nome da tabela para o INSERT */
  tabela: string;
  verValor: boolean;
  onVerValor: () => void;
  onAviso: (msg: string) => void;
};

/** Barra embaixo da tabela: agregados da seleção (como no rodapé do DataGrip/Excel) e "Copiar como". */
export function BarraSelecao({ dados, indices, colunas, ret, tabela, verValor, onVerValor, onAviso }: Props) {
  const ag = useMemo(() => (ret ? agregarSelecao(dados, indices, colunas, ret) : null), [dados, indices, colunas, ret]);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [menu]);

  const copiar = async (formato: FormatoCopia) => {
    setMenu(false);
    if (!ret) return;
    const linhas = indices.slice(ret.r0, ret.r1 + 1);
    const cols = colunas.slice(ret.c0, ret.c1 + 1);
    const ok = await copiarTexto(gerarFormato(formato, dados, linhas, cols, tabela));
    const nome = FORMATOS_COPIA.find((f) => f.id === formato)!.rotulo;
    onAviso(ok ? `Copiado como ${nome}: ${linhas.length} linha(s) × ${cols.length} coluna(s)` : "Não foi possível copiar");
  };

  const item = (rotulo: string, valor: string, titulo?: string) => (
    <span className="whitespace-nowrap" title={titulo}>
      <span className="text-zinc-500 dark:text-[#8b92a5]">{rotulo}</span>{" "}
      <strong className="font-mono font-semibold text-zinc-800 tabular-nums dark:text-zinc-100">{valor}</strong>
    </span>
  );
  const n = (x: number) => x.toLocaleString("pt-BR");

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-900/[0.08] bg-[#f8f9fc] px-3 py-1 text-xs dark:border-white/[0.08] dark:bg-[#13151d]">
      {ag ? (
        <div key={`${ret!.r0}-${ret!.c0}`} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          {item("Seleção", ag.celulas === 1 ? "1 célula" : `${n(ag.linhas)} × ${n(ag.colunas)} = ${n(ag.celulas)}`)}
          {item("Preenchidas", n(ag.preenchidas), "Células com valor (nem NULL nem vazio)")}
          {ag.nulos > 0 && item("NULL", n(ag.nulos))}
          {item("Distintos", n(ag.distintos))}
          {ag.soma !== null && (
            <>
              {item("Soma", numeroAgregado(ag.soma, ag.casas))}
              {item("Média", numeroAgregado(ag.media!, Math.max(2, ag.casas)))}
              {item("Mín", numeroAgregado(ag.min!, ag.casas))}
              {item("Máx", numeroAgregado(ag.max!, ag.casas))}
            </>
          )}
        </div>
      ) : (
        <span className="text-zinc-500 dark:text-[#8b92a5]">
          Clique numa célula para selecionar · Shift ou arrastar seleciona um intervalo · Ctrl+A tudo · Ctrl+C copia · Enter ou duplo clique abre a ficha
        </span>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <div className="relative" ref={ref}>
          <button
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-white/10"
            disabled={!ret}
            onClick={() => setMenu(!menu)}
            aria-haspopup="menu"
            aria-expanded={menu}
            title={ret ? "Copiar a seleção em outro formato" : "Selecione células para copiar"}
          >
            <IconeCopiar className="h-3.5 w-3.5" /> Copiar como <IconeSeta className="h-3 w-3" />
          </button>
          {menu && (
            <div role="menu" className="painel absolute right-0 bottom-full z-50 mb-1 w-64 animate-surgir bg-white/95 p-1 shadow-lg dark:bg-zinc-900/95">
              {FORMATOS_COPIA.map((f) => (
                <button key={f.id} role="menuitem" className="block w-full rounded px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-white/10" onClick={() => copiar(f.id)}>
                  <span className="block text-sm font-medium">{f.rotulo}</span>
                  <span className="block text-xs text-zinc-500">{f.descricao}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className={`inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium transition ${
            verValor ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-100" : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-white/10"
          }`}
          aria-pressed={verValor}
          title="Painel com o valor completo da célula (texto longo, JSON, XML)"
          onClick={onVerValor}
        >
          <IconePainel className="h-3.5 w-3.5" /> Valor
        </button>
      </div>
    </div>
  );
}
