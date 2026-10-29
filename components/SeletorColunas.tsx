"use client";

import { useEffect, useMemo, useState } from "react";
import { layoutColunas, type Aba } from "@/lib/estado";
import { NOMES_TIPOS } from "@/lib/formatacao";
import { buscarPerfil } from "@/lib/perfis";
import { IconePino, IconeX } from "./Icones";

export function SeletorColunas({
  aba,
  atualizar,
  onFechar,
}: {
  aba: Aba;
  atualizar: (patch: Partial<Aba>) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const { dados, visiveis, fixas, ordem } = aba;
  const perfil = buscarPerfil(aba.perfilId);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  // fixas no topo, depois a ordem atual
  const lista = useMemo(() => {
    const set = new Set(fixas);
    const todas = [...fixas, ...ordem.filter((j) => !set.has(j))];
    const t = busca.trim().toLowerCase();
    return t ? todas.filter((j) => dados.colunas[j].nome.toLowerCase().includes(t)) : todas;
  }, [fixas, ordem, busca, dados.colunas]);

  const qtdVisiveis = visiveis.filter(Boolean).length;

  const marcar = (js: number[], valor: boolean) => {
    const v = [...visiveis];
    for (const j of js) v[j] = valor;
    atualizar({ visiveis: v });
  };
  const alternarFixa = (j: number) => {
    if (fixas.includes(j)) atualizar({ fixas: fixas.filter((x) => x !== j) });
    else {
      const v = [...visiveis];
      v[j] = true;
      atualizar({ fixas: [...fixas, j], visiveis: v });
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onFechar}>
      <aside
        className="flex h-full w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
        aria-label="Seletor de colunas"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="font-semibold">Colunas</h2>
            <p className="text-xs text-zinc-500 tabular-nums">
              {qtdVisiveis} de {dados.colunas.length} colunas visíveis
            </p>
          </div>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">
            <IconeX />
          </button>
        </div>

        <div className="space-y-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar coluna" className="campo w-full" />
          <div className="flex flex-wrap gap-1.5">
            <button className="btn px-2 py-1 text-xs" onClick={() => marcar(lista, true)}>
              Marcar todas{busca && " (filtradas)"}
            </button>
            <button className="btn px-2 py-1 text-xs" onClick={() => marcar(lista, false)}>
              Desmarcar todas{busca && " (filtradas)"}
            </button>
            {perfil && (
              <button className="btn px-2 py-1 text-xs" onClick={() => atualizar(layoutColunas(dados, perfil))} title={`Padrão do perfil ${perfil.id}`}>
                Restaurar padrão do perfil
              </button>
            )}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {lista.map((j) => {
            const c = dados.colunas[j];
            const fixa = fixas.includes(j);
            return (
              <li key={j} className="flex items-center gap-2 px-4 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={visiveis[j]} onChange={(e) => marcar([j], e.target.checked)} />
                  <span className="truncate font-mono text-xs">{c.nome}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-zinc-400">{NOMES_TIPOS[c.tipo]}</span>
                </label>
                <button
                  className={`btn-icone h-6 w-6 ${fixa ? "text-blue-600 dark:text-blue-400" : "opacity-50"}`}
                  title={fixa ? "Desafixar" : "Fixar à esquerda"}
                  aria-pressed={fixa}
                  onClick={() => alternarFixa(j)}
                >
                  <IconePino className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
          {lista.length === 0 && <li className="px-4 py-3 text-sm text-zinc-500">Nenhuma coluna encontrada.</li>}
        </ul>
      </aside>
    </div>
  );
}
