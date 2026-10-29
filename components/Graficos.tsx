"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Aba } from "@/lib/estado";
import { formatarNumero, formatarPercentual } from "@/lib/formatacao";
import {
  agregar,
  candidatasCategoria,
  candidatasValor,
  motivoSemGrafico,
  ROTULO_OUTROS,
  TOP_CATEGORIAS,
  type ConfigGrafico,
  type ItemGrafico,
} from "@/lib/graficos";

export function Graficos({ aba, indices, atualizar }: { aba: Aba; indices: number[]; atualizar: (p: Partial<Aba>) => void }) {
  const { dados, grafico } = aba;
  const cats = useMemo(() => candidatasCategoria(dados), [dados]);
  const vals = useMemo(() => candidatasValor(dados), [dados]);
  const motivo = motivoSemGrafico(dados, grafico);
  const { itens, total } = useMemo(() => agregar(dados, indices, grafico), [dados, indices, grafico]);

  const casas = grafico.modo === "contagem" || grafico.valor === null ? 0 : dados.colunas[grafico.valor].casas;
  const fmt = (n: number) => formatarNumero(n, casas);
  const mudar = (p: Partial<ConfigGrafico>) => atualizar({ grafico: { ...grafico, ...p } });

  const larguraRotulo = Math.min(220, Math.max(60, ...itens.map((i) => i.categoria.length * 7 + 12)));

  return (
    <div className="absolute inset-0 overflow-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Modo">
            <select className="campo" value={grafico.modo} onChange={(e) => mudar({ modo: e.target.value as ConfigGrafico["modo"] })}>
              <option value="contagem">Contagem por categoria</option>
              <option value="soma">Soma por categoria</option>
            </select>
          </Campo>
          <Campo rotulo="Categoria">
            <select
              className="campo font-mono"
              value={grafico.categoria ?? ""}
              disabled={cats.length === 0}
              onChange={(e) => mudar({ categoria: e.target.value === "" ? null : Number(e.target.value) })}
            >
              {grafico.categoria === null && <option value="">—</option>}
              {cats.map((j) => (
                <option key={j} value={j}>
                  {dados.colunas[j].nome}
                </option>
              ))}
            </select>
          </Campo>
          {grafico.modo === "soma" && (
            <Campo rotulo="Valor (soma)">
              <select
                className="campo font-mono"
                value={grafico.valor ?? ""}
                disabled={vals.length === 0}
                onChange={(e) => mudar({ valor: e.target.value === "" ? null : Number(e.target.value) })}
              >
                {grafico.valor === null && <option value="">—</option>}
                {vals.map((j) => (
                  <option key={j} value={j}>
                    {dados.colunas[j].nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <p className="pb-2 text-xs text-zinc-500">
            Considera {indices.length === 1 ? "1 linha filtrada" : `as ${indices.length.toLocaleString("pt-BR")} linhas filtradas`} da
            tabela. Acima de {TOP_CATEGORIAS} categorias, o restante vira “{ROTULO_OUTROS}”.
          </p>
        </div>

        {motivo ? (
          <p className="painel p-6 text-sm text-zinc-600 dark:text-zinc-400">{motivo}</p>
        ) : itens.length === 0 ? (
          <p className="painel p-6 text-sm text-zinc-600 dark:text-zinc-400">Nenhuma linha corresponde aos filtros atuais.</p>
        ) : (
          <div className="painel p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2 text-sm">
              <h3 className="font-medium">
                {grafico.modo === "contagem" ? "Quantidade de linhas" : `Soma de ${dados.colunas[grafico.valor!].nome}`} por{" "}
                <span className="font-mono">{dados.colunas[grafico.categoria!].nome}</span>
              </h3>
              <span className="text-zinc-500 tabular-nums">Total: {fmt(total)}</span>
            </div>
            <div style={{ height: Math.max(160, itens.length * 30 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={itens} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: "currentColor" }} stroke="currentColor" strokeOpacity={0.3} />
                  <YAxis
                    type="category"
                    dataKey="categoria"
                    width={larguraRotulo}
                    interval={0}
                    tick={{ fontSize: 11, fill: "currentColor", fontFamily: "var(--font-mono)" }}
                    stroke="currentColor"
                    strokeOpacity={0.3}
                  />
                  <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} content={<Dica fmt={fmt} />} />
                  <Bar dataKey="valor" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {itens.map((i) => (
                      <Cell key={i.categoria} className={i.categoria === ROTULO_OUTROS ? "fill-zinc-400" : "fill-blue-600 dark:fill-blue-500"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {rotulo}
      {children}
    </label>
  );
}

function Dica({ active, payload, fmt }: { active?: boolean; payload?: { payload: ItemGrafico }[]; fmt: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="painel px-3 py-2 text-xs shadow-md">
      <div className="font-mono font-semibold">{item.categoria}</div>
      <div className="tabular-nums">
        {fmt(item.valor)} · {formatarPercentual(item.percentual)} do total
      </div>
    </div>
  );
}
