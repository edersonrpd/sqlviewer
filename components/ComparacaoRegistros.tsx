"use client";

import { useEffect, useMemo, useState } from "react";
import { compararRegistros } from "@/lib/comparar";
import type { Aba } from "@/lib/estado";
import { formatarValor } from "@/lib/formatacao";
import { buscarPerfil } from "@/lib/perfis";
import { resumoRegistro } from "@/lib/tela";
import { IconeX } from "./Icones";

/** Dois registros lado a lado, só com as colunas que diferem (ou todas). */
export function ComparacaoRegistros({ aba, a, b, onFechar }: { aba: Aba; a: number; b: number; onFechar: () => void }) {
  const { dados } = aba;
  const perfil = buscarPerfil(aba.perfilId);
  const [mostrarIguais, setMostrarIguais] = useState(false);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const todas = useMemo(() => compararRegistros(dados, a, b, perfil), [dados, a, b, perfil]);
  const qtdDiferentes = todas.filter((d) => !d.igual).length;
  const lista = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    return todas.filter(
      (d) => (mostrarIguais || !d.igual) && (!t || d.nome.toLowerCase().includes(t) || (d.rotulo ?? "").toLowerCase().includes(t)),
    );
  }, [todas, mostrarIguais, filtro]);

  const ra = resumoRegistro(dados, a, perfil);
  const rb = resumoRegistro(dados, b, perfil);
  const valor = (v: string | null, j: number) =>
    v === null ? <span className="valor-null">NULL</span> : v === "" ? <span className="text-zinc-400">{"\"\""}</span> : formatarValor(v, dados.colunas[j].tipo);

  return (
    <div className="gaveta-fundo" onClick={onFechar}>
      <aside className="gaveta max-w-4xl" onClick={(e) => e.stopPropagation()} aria-label="Comparar registros">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="font-semibold">Comparar registros</h2>
            <p className="text-xs text-zinc-500">
              {qtdDiferentes} de {todas.length} colunas diferentes
            </p>
          </div>
          <button className="btn-icone" onClick={onFechar} aria-label="Fechar">
            <IconeX />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800">
          <input className="campo w-56" placeholder="Filtrar colunas" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <label className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={mostrarIguais} onChange={(e) => setMostrarIguais(e.target.checked)} />
            Mostrar colunas iguais
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-xs dark:bg-zinc-900">
              <tr>
                <th className="w-56 px-4 py-2 font-medium text-zinc-500">Coluna</th>
                <th className="px-3 py-2">
                  <span className="mr-1 rounded bg-blue-100 px-1.5 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">A</span>
                  {ra.titulo}
                  {ra.chave && <span className="ml-1 font-normal text-zinc-500">{ra.chave}</span>}
                </th>
                <th className="px-3 py-2">
                  <span className="mr-1 rounded bg-violet-100 px-1.5 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">B</span>
                  {rb.titulo}
                  {rb.chave && <span className="ml-1 font-normal text-zinc-500">{rb.chave}</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.j} className={`border-t border-zinc-100 dark:border-zinc-800 ${d.igual ? "text-zinc-400" : ""}`}>
                  <td className="px-4 py-1.5 align-top">
                    {d.rotulo && <div className="text-zinc-700 dark:text-zinc-300">{d.rotulo}</div>}
                    <div className="font-mono text-[11px] text-zinc-500">{d.nome}</div>
                  </td>
                  <td className={`px-3 py-1.5 align-top font-mono text-xs break-words ${d.igual ? "" : "bg-amber-50/70 dark:bg-amber-500/10"}`}>
                    {valor(d.a, d.j)}
                  </td>
                  <td className={`px-3 py-1.5 align-top font-mono text-xs break-words ${d.igual ? "" : "bg-amber-50/70 dark:bg-amber-500/10"}`}>
                    {valor(d.b, d.j)}
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                    {qtdDiferentes === 0 ? "Os dois registros são iguais em todas as colunas." : "Nenhuma coluna corresponde ao filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
