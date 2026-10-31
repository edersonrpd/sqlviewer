"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHAVE_NULL, valoresDistintos } from "@/lib/filtragem";
import { formatarValor } from "@/lib/formatacao";
import type { ResultadoParse } from "@/lib/tipos";
import { IconeBusca } from "./Icones";

const LIMITE_LISTA = 500;

type Props = {
  dados: ResultadoParse;
  coluna: number;
  /** botão que abriu o menu (para posicionar) */
  ancora: DOMRect;
  /** chaves aceitas hoje (null = sem filtro) */
  aceitos: readonly string[] | null;
  /** null remove o filtro */
  onAplicar: (aceitos: string[] | null) => void;
  onFechar: () => void;
};

/** Menu "filtrar por valores" do cabeçalho: valores distintos da coluna com a contagem, para marcar/desmarcar. */
export function FiltroValores({ dados, coluna, ancora, aceitos, onAplicar, onFechar }: Props) {
  const col = dados.colunas[coluna];
  const todos = useMemo(() => valoresDistintos(dados, coluna, dados.linhas.map((_, i) => i)), [dados, coluna]);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(aceitos ?? todos.map((v) => v.chave)));
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: ancora.bottom + 6, left: ancora.left });

  // mantém o menu dentro da janela
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(ancora.left, window.innerWidth - w - 8));
    const top = ancora.bottom + 6 + h > window.innerHeight - 8 ? Math.max(8, ancora.top - h - 6) : ancora.bottom + 6;
    setPos({ top, left });
  }, [ancora]);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onFechar();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("mousedown", fora);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("keydown", esc);
    };
  }, [onFechar]);

  const termo = busca.trim().toLowerCase();
  const rotulo = (chave: string, v: string | null) => (chave === CHAVE_NULL ? "NULL" : v === "" ? "(vazio)" : formatarValor(v!, col.tipo));
  const filtrados = termo ? todos.filter((d) => rotulo(d.chave, d.valor).toLowerCase().includes(termo) || (d.valor ?? "").toLowerCase().includes(termo)) : todos;
  const visiveis = filtrados.slice(0, LIMITE_LISTA);
  const todosVisiveisMarcados = filtrados.length > 0 && filtrados.every((d) => marcados.has(d.chave));

  const alternar = (chave: string) => {
    const s = new Set(marcados);
    if (s.has(chave)) s.delete(chave);
    else s.add(chave);
    setMarcados(s);
  };
  const alternarFiltrados = () => {
    const s = new Set(marcados);
    for (const d of filtrados) {
      if (todosVisiveisMarcados) s.delete(d.chave);
      else s.add(d.chave);
    }
    setMarcados(s);
  };
  const aplicar = () => {
    // todos marcados = sem filtro
    if (marcados.size >= todos.length && todos.every((d) => marcados.has(d.chave))) onAplicar(null);
    else onAplicar([...marcados]);
  };

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Filtrar ${col.nome} por valores`}
      className="painel fixed z-[70] flex max-h-[min(460px,80vh)] w-80 animate-surgir flex-col bg-white/95 text-sm shadow-2xl dark:bg-zinc-900/95"
      style={{ top: pos.top, left: pos.left }}
      onKeyDown={(e) => {
        if (e.key === "Enter") aplicar();
      }}
    >
      <div className="border-b border-zinc-200 p-2 dark:border-white/10">
        <p className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-xs text-zinc-500">
          <span className="truncate font-mono font-semibold text-zinc-700 dark:text-zinc-200">{col.nome}</span>
          <span className="shrink-0">{todos.length.toLocaleString("pt-BR")} valor(es) distinto(s)</span>
        </p>
        <label className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2 dark:border-white/10 dark:bg-zinc-950">
          <IconeBusca className="h-3.5 w-3.5 text-zinc-400" />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar valor"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
          />
        </label>
      </div>
      <label className="flex cursor-pointer items-center gap-2 border-b border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-white/10">
        <input type="checkbox" checked={todosVisiveisMarcados} onChange={alternarFiltrados} />
        {termo ? `Marcar os ${filtrados.length} encontrados` : "Marcar todos"}
      </label>
      <ul className="min-h-0 flex-1 overflow-auto py-1">
        {visiveis.map((d) => (
          <li key={d.chave}>
            <label className="flex cursor-pointer items-center gap-2 px-3 py-1 hover:bg-zinc-100 dark:hover:bg-white/5">
              <input type="checkbox" checked={marcados.has(d.chave)} onChange={() => alternar(d.chave)} />
              <span className={`min-w-0 flex-1 truncate font-mono text-xs ${d.valor === null || d.valor === "" ? "text-zinc-400 italic" : ""}`} title={d.valor ?? "NULL"}>
                {rotulo(d.chave, d.valor)}
              </span>
              <span className="shrink-0 text-xs text-zinc-400 tabular-nums">{d.qtd.toLocaleString("pt-BR")}</span>
            </label>
          </li>
        ))}
        {filtrados.length > LIMITE_LISTA && (
          <li className="px-3 py-1.5 text-xs text-zinc-500">
            +{(filtrados.length - LIMITE_LISTA).toLocaleString("pt-BR")} valores — use a busca para encontrá-los
          </li>
        )}
        {filtrados.length === 0 && <li className="px-3 py-2 text-xs text-zinc-500">Nenhum valor encontrado.</li>}
      </ul>
      <div className="flex items-center gap-2 border-t border-zinc-200 p-2 dark:border-white/10">
        <span className="text-xs text-zinc-500">{marcados.size.toLocaleString("pt-BR")} marcado(s)</span>
        <button className="btn ml-auto py-1" onClick={() => onAplicar(null)}>
          Limpar
        </button>
        <button className="btn-destaque py-1" disabled={marcados.size === 0} onClick={aplicar}>
          Aplicar
        </button>
      </div>
    </div>,
    document.body,
  );
}
