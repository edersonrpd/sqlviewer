"use client";

import { useState } from "react";
import type { Diagnostico, NivelAchado } from "@/lib/diagnostico";
import { IconeAlerta, IconeSeta } from "./Icones";

export const ESTILO_NIVEL: Record<NivelAchado, { ponto: string; caixa: string; rotulo: string }> = {
  erro: { ponto: "bg-red-500", caixa: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100", rotulo: "erro" },
  alerta: {
    ponto: "bg-amber-500",
    caixa: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    rotulo: "alerta",
  },
  info: { ponto: "bg-sky-500", caixa: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100", rotulo: "info" },
  ok: {
    ponto: "bg-emerald-500",
    caixa: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    rotulo: "ok",
  },
};

/** Resultado do diagnóstico automático no topo da Tela. */
export function PainelDiagnostico({ diagnostico: d }: { diagnostico: Diagnostico }) {
  const [verOk, setVerOk] = useState(false);
  const problemas = d.achados.filter((a) => a.nivel !== "ok");
  const oks = d.achados.filter((a) => a.nivel === "ok");
  const conta = (n: NivelAchado) => d.achados.filter((a) => a.nivel === n).length;
  if (d.achados.length === 0 && d.pendentes.length === 0) return null;

  return (
    <section className="painel overflow-hidden" aria-label="Diagnóstico">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <IconeAlerta className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold">Diagnóstico</h3>
        {(["erro", "alerta", "info", "ok"] as const).map((n) =>
          conta(n) > 0 ? (
            <span key={n} className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
              <span className={`h-2 w-2 rounded-full ${ESTILO_NIVEL[n].ponto}`} />
              {conta(n)} {ESTILO_NIVEL[n].rotulo}
            </span>
          ) : null,
        )}
        {problemas.length === 0 && oks.length > 0 && (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">nenhum problema encontrado</span>
        )}
      </div>

      <div className="space-y-1.5 px-4 py-3">
        {problemas.map((a, k) => (
          <div key={k} className={`rounded-md border px-3 py-2 text-sm ${ESTILO_NIVEL[a.nivel].caixa}`}>
            <p className="flex items-center gap-2 font-medium">
              <span className={`h-2 w-2 shrink-0 rounded-full ${ESTILO_NIVEL[a.nivel].ponto}`} />
              {a.titulo}
            </p>
            {a.detalhe && <p className="mt-0.5 pl-4 text-xs opacity-80">{a.detalhe}</p>}
          </div>
        ))}

        {oks.length > 0 && (
          <div>
            <button
              className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline dark:text-emerald-400"
              onClick={() => setVerOk(!verOk)}
              aria-expanded={verOk}
            >
              <IconeSeta className={`h-3.5 w-3.5 transition ${verOk ? "" : "-rotate-90"}`} />
              {oks.length} verificação(ões) ok
            </button>
            {verOk && (
              <ul className="mt-1.5 space-y-1 pl-4">
                {oks.map((a, k) => (
                  <li key={k} className="text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                    {a.titulo}
                    {a.detalhe && <span className="text-zinc-400"> — {a.detalhe}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {d.pendentes.length > 0 && (
          <p className="text-xs text-zinc-500">
            Não verificado: {d.pendentes.join(", ")}. Cole essas consultas, ou use “Tudo de uma vez (JOIN)” em Ver também.
          </p>
        )}
      </div>
    </section>
  );
}
