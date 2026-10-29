"use client";

import { useState } from "react";
import { PERFIS } from "@/config/perfis";
import type { Aba } from "@/lib/estado";
import { NOMES_TIPOS } from "@/lib/formatacao";
import type { TipoColuna } from "@/lib/tipos";
import { IconeAlerta, IconeSeta } from "./Icones";

const ORDEM_TIPOS: TipoColuna[] = ["texto", "decimal", "inteiro", "data", "datahora", "hora"];

export function ResumoConsulta({ aba, onTrocarPerfil }: { aba: Aba; onTrocarPerfil: (perfilId: string | null) => void }) {
  const { dados, deteccao } = aba;
  const [aberto, setAberto] = useState(true);
  const [tipoAberto, setTipoAberto] = useState<TipoColuna | null>(null);

  const porTipo = new Map<TipoColuna, string[]>();
  for (const c of dados.colunas) porTipo.set(c.tipo, [...(porTipo.get(c.tipo) ?? []), c.nome]);

  const perfil = PERFIS.find((p) => p.id === aba.perfilId);
  const detectadoId = deteccao.tipo === "perfil" ? deteccao.perfil.id : null;
  const badge =
    deteccao.tipo === "combinada"
      ? "Consulta combinada"
      : perfil
        ? `${perfil.id} · ${perfil.nome}`
        : "Genérica";
  const qtdAvisos = dados.avisos.length + (deteccao.tipo === "combinada" ? 1 : 0);

  return (
    <section className="border-b border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button className="inline-flex items-center gap-1 font-medium" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          <IconeSeta className={`h-4 w-4 transition ${aberto ? "" : "-rotate-90"}`} />
          Resumo
        </button>
        <span className="tabular-nums">
          <strong>{dados.linhas.length.toLocaleString("pt-BR")}</strong> linhas ·{" "}
          <strong>{dados.colunas.length.toLocaleString("pt-BR")}</strong> colunas
        </span>

        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            perfil
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
          title={perfil && detectadoId !== perfil.id ? "Perfil escolhido manualmente" : "Perfil detectado pelas colunas"}
        >
          {badge}
        </span>

        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          Perfil:
          <select className="campo py-0.5 text-xs" value={aba.perfilId ?? ""} onChange={(e) => onTrocarPerfil(e.target.value || null)}>
            <option value="">Genérica</option>
            {PERFIS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} – {p.nome}
                {p.id === detectadoId ? " (detectado)" : ""}
              </option>
            ))}
          </select>
        </label>

        {qtdAvisos > 0 && (
          <button
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            onClick={() => setAberto(true)}
          >
            <IconeAlerta className="h-3.5 w-3.5" /> {qtdAvisos} aviso(s)
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-zinc-500">Tipos detectados:</span>
            {ORDEM_TIPOS.filter((t) => porTipo.has(t)).map((t) => (
              <button
                key={t}
                onClick={() => setTipoAberto(tipoAberto === t ? null : t)}
                className={`rounded border px-1.5 py-0.5 text-xs ${
                  tipoAberto === t ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {NOMES_TIPOS[t]}: <strong>{porTipo.get(t)!.length}</strong>
              </button>
            ))}
          </div>
          {tipoAberto && (
            <p className="max-h-24 overflow-auto font-mono text-xs break-words text-zinc-600 dark:text-zinc-400">
              {porTipo.get(tipoAberto)!.join(", ")}
            </p>
          )}

          {(deteccao.tipo === "combinada" || dados.avisos.length > 0) && (
            <ul className="space-y-1">
              {deteccao.tipo === "combinada" && (
                <Aviso>
                  Consulta combinada: o resultado tem colunas de mais de uma tabela (
                  {deteccao.perfis.map((p) => p.id).join(", ")}). Ela foi tratada como genérica; se quiser, escolha um perfil no
                  seletor acima.
                </Aviso>
              )}
              {dados.avisos.map((a, k) => (
                <Aviso key={k}>{a.mensagem}</Aviso>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
      <IconeAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
