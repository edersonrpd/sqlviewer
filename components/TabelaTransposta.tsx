"use client";

import { useMemo, useState } from "react";
import type { Aba } from "@/lib/estado";
import { chaveValor } from "@/lib/filtragem";
import { NOMES_TIPOS } from "@/lib/formatacao";
import { buscarPerfil } from "@/lib/perfis";
import { alinhamento, Celula } from "./Celula";

const LIMITE = 100;

/**
 * Tabela transposta: cada coluna vira uma linha e cada registro uma coluna.
 * Ajuda a comparar poucos registros com muitas colunas; destaca as colunas que diferem.
 */
export function TabelaTransposta({ aba, colunas, indices, onAbrir }: { aba: Aba; colunas: number[]; indices: number[]; onAbrir: (i: number) => void }) {
  const { dados } = aba;
  const [soDiferencas, setSoDiferencas] = useState(false);
  const registros = useMemo(() => indices.slice(0, LIMITE), [indices]);
  const perfil = buscarPerfil(aba.perfilId);
  const jTitulo = perfil?.colunaTitulo ? dados.colunas.findIndex((c) => c.nome === perfil.colunaTitulo) : -1;

  const difere = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const j of colunas) m.set(j, new Set(registros.map((i) => chaveValor(dados.linhas[i][j]))).size > 1);
    return m;
  }, [colunas, registros, dados]);
  const qtdDiferem = [...difere.values()].filter(Boolean).length;
  const linhas = soDiferencas ? colunas.filter((j) => difere.get(j)) : colunas;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-900/[0.08] px-3 py-1.5 text-xs text-zinc-600 dark:border-white/[0.08] dark:text-zinc-400">
        <span>
          {registros.length < indices.length
            ? `Primeiros ${LIMITE} de ${indices.length.toLocaleString("pt-BR")} registros — filtre para ver outros`
            : `${indices.length.toLocaleString("pt-BR")} registro(s) lado a lado`}
        </span>
        {registros.length > 1 && (
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={soDiferencas} onChange={(e) => setSoDiferencas(e.target.checked)} />
            Só colunas que diferem ({qtdDiferem})
          </label>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto text-[13px]">
        <table className="border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 border-r border-b border-zinc-900/[0.08] bg-[#f8f9fc] px-3 py-2 text-left font-mono text-[11px] font-semibold text-zinc-500 dark:border-white/[0.08] dark:bg-[#13151d]">
                Coluna
              </th>
              {registros.map((i, k) => (
                <th key={i} className="border-b border-zinc-900/[0.08] bg-[#f8f9fc] px-3 py-2 text-left whitespace-nowrap dark:border-white/[0.08] dark:bg-[#13151d]">
                  <button className="font-mono text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-300" title="Abrir a ficha" onClick={() => onAbrir(i)}>
                    #{k + 1}
                    {jTitulo >= 0 && <span className="ml-1.5 text-zinc-500 dark:text-zinc-400">{dados.linhas[i][jTitulo]}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((j) => {
              const col = dados.colunas[j];
              const diferente = registros.length > 1 && difere.get(j);
              return (
                <tr key={j} className="group">
                  <th
                    className={`sticky left-0 z-10 border-r border-b border-zinc-900/[0.06] bg-white px-3 py-2 text-left font-mono text-[11px] font-semibold whitespace-nowrap group-hover:bg-[#eef0ff] dark:border-white/5 dark:bg-[#0c0e16] dark:group-hover:bg-[#191c33] ${
                      diferente ? "text-amber-700 shadow-[inset_3px_0_0_var(--color-amber-400)] dark:text-amber-300" : "text-zinc-500 dark:text-[#8b92a5]"
                    }`}
                    title={`${col.nome} · ${NOMES_TIPOS[col.tipo]}${diferente ? " · valores diferentes entre os registros" : ""}`}
                  >
                    {col.nome}
                  </th>
                  {registros.map((i) => {
                    const v = dados.linhas[i][j];
                    return (
                      <td
                        key={i}
                        className={`max-w-80 truncate border-b border-zinc-900/[0.06] px-3 py-2 text-zinc-700 group-hover:bg-[#eef0ff] dark:border-white/5 dark:text-zinc-300 dark:group-hover:bg-[#191c33] ${alinhamento(col.tipo)}`}
                        title={v === null ? "NULL" : v}
                      >
                        <Celula valor={v} tipo={col.tipo} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
