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
  // o aviso de "separada do JOIN" é só informativo: não abre o painel sozinho (ocupa espaço da grade)
  const [aberto, setAberto] = useState(dados.avisos.some((a) => a.tipo !== "separacao") || deteccao.tipo === "combinada");
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

  // faixa compacta: rótulo e valor na mesma linha, 36px de altura
  const cartao =
    "flex h-9 shrink-0 items-baseline gap-2 rounded-[10px] border border-zinc-900/[0.1] bg-white px-3.5 leading-[34px] dark:border-white/[0.08] dark:bg-white/[0.04]";
  const rotuloCartao = "text-xs text-zinc-500 dark:text-[#8b92a5]";
  const valorCartao = "font-mono text-[15px] font-semibold tabular-nums";

  return (
    <section className="relative z-10 animate-[aparecer_0.3s_ease-out_both] px-3 pt-2.5 text-[13px] sm:px-5">
      <div className="flex flex-wrap items-stretch gap-2">
        <div className={`${cartao} animate-subir`}>
          <span className={rotuloCartao}>Linhas</span>
          <span className={valorCartao}>{dados.linhas.length.toLocaleString("pt-BR")}</span>
        </div>
        <button
          className={`${cartao} animate-subir pr-3 text-left transition duration-200 [animation-delay:60ms] hover:border-zinc-900/20 dark:hover:border-white/20`}
          onClick={() => setAberto(!aberto)}
          aria-expanded={aberto}
          title="Ver os tipos detectados"
        >
          <span className={rotuloCartao}>Colunas</span>
          <span className={valorCartao}>{dados.colunas.length.toLocaleString("pt-BR")}</span>
          <IconeSeta className={`h-3.5 w-3.5 self-center text-zinc-500 transition ${aberto ? "" : "-rotate-90"}`} />
        </button>

        <div
          className={`flex h-9 min-w-[320px] flex-1 animate-subir items-center gap-2.5 rounded-[10px] border pr-1 pl-3.5 [animation-delay:120ms] ${
            perfil
              ? "border-[#c3ddd0] bg-[#e8f2ed] dark:border-emerald-400/25 dark:bg-emerald-400/[0.08]"
              : "border-zinc-900/[0.1] bg-white dark:border-white/[0.08] dark:bg-white/[0.03]"
          }`}
          title={perfil && detectadoId !== perfil.id ? "Perfil escolhido manualmente" : "Perfil detectado pelas colunas"}
        >
          <span
            className={`flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap ${
              perfil ? "text-[#2f6f55] dark:text-emerald-300" : "text-zinc-500 dark:text-[#8b92a5]"
            }`}
          >
            {perfil && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
            {perfil ? (detectadoId === perfil.id ? "Perfil detectado" : "Perfil escolhido") : "Perfil"}
          </span>
          <span className="min-w-0 truncate text-[13.5px] font-semibold">{badge}</span>
          {/* o nome do perfil já aparece ao lado: o seletor vira um botão compacto (select invisível por cima) */}
          <label className="relative ml-auto inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[7px] border border-zinc-300 bg-white px-2.5 text-xs whitespace-nowrap text-zinc-700 transition focus-within:border-blue-500 hover:border-zinc-400 dark:border-white/10 dark:bg-[#0a0c14]/80 dark:text-zinc-200">
            Trocar perfil
            <IconeSeta className="h-3.5 w-3.5" />
            <select
              aria-label="Trocar perfil"
              className="absolute inset-0 cursor-pointer opacity-0"
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
            className="inline-flex h-9 shrink-0 animate-subir items-center gap-1.5 rounded-[10px] border border-[#e3d3a6] bg-[#f5efdf] px-3 text-[12.5px] font-medium whitespace-nowrap text-[#7a5a14] transition duration-200 [animation-delay:180ms] hover:-translate-y-px dark:border-amber-400/30 dark:bg-amber-400/[0.08] dark:text-amber-300"
            onClick={() => setAberto(!aberto)}
            aria-expanded={aberto}
          >
            <IconeAlerta className="h-3.5 w-3.5" /> {qtdAvisos} {qtdAvisos === 1 ? "aviso" : "avisos"}
          </button>
        )}
      </div>

      {aberto && (
        <div className="mt-2.5 animate-subir space-y-2">
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
