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
  const [aberto, setAberto] = useState(dados.avisos.length > 0 || deteccao.tipo === "combinada");
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

  const cartao =
    "rounded-[14px] border border-zinc-900/[0.08] bg-gradient-to-b from-white/90 to-white/60 px-4 py-3 backdrop-blur-md dark:border-white/[0.08] dark:from-white/[0.05] dark:to-white/[0.015] [@media(max-height:760px)]:py-2";
  const valorCartao = "mt-1 font-mono text-2xl leading-tight font-semibold tabular-nums [@media(max-height:760px)]:mt-0 [@media(max-height:760px)]:text-lg";

  return (
    <section className="relative z-10 animate-[aparecer_0.3s_ease-out_both] px-3 pt-4 text-sm sm:px-5 [@media(max-height:760px)]:pt-2">
      <div className="flex flex-wrap gap-3 [@media(max-height:760px)]:gap-2">
        <div className={`${cartao} flex-[1_1_150px] animate-subir`}>
          <div className="text-xs text-zinc-500 dark:text-[#8b92a5]">Linhas</div>
          <div className={valorCartao}>{dados.linhas.length.toLocaleString("pt-BR")}</div>
        </div>
        <button
          className={`${cartao} flex-[1_1_150px] animate-subir text-left transition duration-200 [animation-delay:60ms] hover:-translate-y-px hover:border-zinc-900/15 dark:hover:border-white/20`}
          onClick={() => setAberto(!aberto)}
          aria-expanded={aberto}
          title="Ver os tipos detectados"
        >
          <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-[#8b92a5]">
            Colunas
            <IconeSeta className={`h-3.5 w-3.5 transition ${aberto ? "" : "-rotate-90"}`} />
          </div>
          <div className={valorCartao}>{dados.colunas.length.toLocaleString("pt-BR")}</div>
        </button>

        <div
          className={`flex flex-[2_1_320px] animate-subir flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3 [animation-delay:120ms] [@media(max-height:760px)]:py-2 ${
            perfil
              ? "border-emerald-300/70 bg-gradient-to-b from-emerald-50 to-emerald-50/40 dark:border-emerald-400/25 dark:from-emerald-400/10 dark:to-emerald-400/[0.02]"
              : "border-zinc-900/[0.08] bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.03]"
          }`}
          title={perfil && detectadoId !== perfil.id ? "Perfil escolhido manualmente" : "Perfil detectado pelas colunas"}
        >
          <div className="min-w-0">
            <div className={`text-xs ${perfil ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-500 dark:text-[#8b92a5]"}`}>
              {perfil ? (detectadoId === perfil.id ? "Perfil detectado" : "Perfil escolhido") : "Perfil"}
            </div>
            <div className="mt-1 truncate text-base font-semibold [@media(max-height:760px)]:mt-0">{badge}</div>
          </div>
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-[#9aa1b2]">
            Perfil
            <select
              className="campo h-8 py-0 text-xs dark:bg-[#0a0c14]/80"
              value={aba.perfilId ?? ""}
              onChange={(e) => onTrocarPerfil(e.target.value || null)}
            >
              <option value="">Genérica</option>
              {PERFIS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} – {p.nome}
                  {p.id === detectadoId ? " (detectado)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {qtdAvisos > 0 && (
          <button
            className="inline-flex flex-[0_1_auto] animate-subir items-center gap-2 rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800 transition duration-200 [animation-delay:180ms] hover:-translate-y-px dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-300 [@media(max-height:760px)]:py-2"
            onClick={() => setAberto(!aberto)}
            aria-expanded={aberto}
          >
            <IconeAlerta className="h-4 w-4" /> {qtdAvisos} aviso(s)
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-3 animate-subir space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-zinc-500">Tipos detectados:</span>
            {ORDEM_TIPOS.filter((t) => porTipo.has(t)).map((t) => (
              <button
                key={t}
                onClick={() => setTipoAberto(tipoAberto === t ? null : t)}
                className={`rounded-md border px-1.5 py-0.5 text-xs transition ${
                  tipoAberto === t
                    ? "border-blue-500 bg-blue-50 shadow-[0_0_12px_-4px_rgb(99_102_241/0.7)] dark:bg-blue-500/15"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-white/10 dark:hover:border-white/25"
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
    <li className="flex animate-subir gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
      <IconeAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}
