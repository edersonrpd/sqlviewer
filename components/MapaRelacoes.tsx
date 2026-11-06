"use client";

import { useEffect, useMemo, useState } from "react";
import { condicaoJoin, montarMapa, NO_ALTURA, NO_LARGURA, type ArestaMapa, type NoMapa } from "@/lib/mapaRelacoes";
import { IconeCopiar, IconeX } from "./Icones";
import { copiarTexto, useAviso } from "./util";

type Props = {
  /** perfis com aba aberta (destacados no mapa) */
  abertos: Set<string>;
  onFechar: () => void;
};

/** Diagrama das tabelas conhecidas (perfis) e das colunas que as ligam. */
export function MapaRelacoes({ abertos, onFechar }: Props) {
  const [comCadastros, setComCadastros] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aviso, setAviso] = useAviso();
  const mapa = useMemo(() => montarMapa(undefined, { cadastros: comCadastros }), [comCadastros]);
  const porId = useMemo(() => new Map(mapa.nos.map((n) => [n.id, n])), [mapa]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selecionado) setSelecionado(null);
      else onFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [selecionado, onFechar]);

  // a seleção some quando o nó deixa de existir (cadastros ocultos)
  const sel = selecionado && porId.has(selecionado) ? selecionado : null;
  const vizinhos = useMemo(() => {
    if (!sel) return null;
    const s = new Set([sel]);
    for (const a of mapa.arestas) if (a.de === sel || a.para === sel) s.add(a.de === sel ? a.para : a.de);
    return s;
  }, [sel, mapa]);
  const ligadas = sel ? mapa.arestas.filter((a) => a.de === sel || a.para === sel) : [];

  const copiar = async (t: string) => setAviso((await copiarTexto(t)) ? "Copiado" : "Não foi possível copiar");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50/95 backdrop-blur dark:bg-[#0d0f15]/95" role="dialog" aria-label="Relações entre tabelas">
      <div className="vidro flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-2 dark:border-white/[0.08]">
        <h2 className="text-base font-bold">Relações entre tabelas</h2>
        <span className="text-xs text-zinc-500">Clique numa tabela para ver as ligações e a condição do JOIN</span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm">
          <input type="checkbox" checked={comCadastros} onChange={(e) => setComCadastros(e.target.checked)} />
          Mostrar cadastros (cliente, operador, empresa…)
        </label>
        <button className="btn-icone h-8 w-8" onClick={onFechar} aria-label="Fechar" title="Fechar (Esc)">
          <IconeX />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-0 flex-1 overflow-auto" onClick={() => setSelecionado(null)}>
          <svg width={mapa.largura} height={mapa.altura} className="block select-none">
            <defs>
              <marker id="seta-mapa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 10 5 0 10z" className="fill-zinc-400 dark:fill-zinc-500" />
              </marker>
              <marker id="seta-mapa-ativa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 10 5 0 10z" className="fill-indigo-500" />
              </marker>
            </defs>
            {mapa.arestas.map((a) => (
              <Aresta key={`${a.de}>${a.para}`} a={a} de={porId.get(a.de)!} para={porId.get(a.para)!} sel={sel} apagada={!!sel && a.de !== sel && a.para !== sel} />
            ))}
            {mapa.nos.map((n) => (
              <No
                key={n.id}
                n={n}
                aberto={abertos.has(n.id)}
                selecionado={n.id === sel}
                apagado={!!vizinhos && !vizinhos.has(n.id)}
                onClick={() => setSelecionado(n.id === sel ? null : n.id)}
              />
            ))}
          </svg>
        </div>

        <aside className="max-h-[45vh] shrink-0 overflow-auto border-t border-zinc-200 p-4 text-sm md:max-h-none md:w-96 md:border-t-0 md:border-l dark:border-white/[0.08]">
          {sel ? (
            <Detalhes no={porId.get(sel)!} ligadas={ligadas} porId={porId} aberto={abertos.has(sel)} onIr={setSelecionado} onCopiar={copiar} />
          ) : (
            <Legenda />
          )}
          {aviso && (
            <span role="status" className="fixed right-4 bottom-4 rounded bg-zinc-900 px-2 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
              {aviso}
            </span>
          )}
        </aside>
      </div>
    </div>
  );
}

function No({ n, aberto, selecionado, apagado, onClick }: { n: NoMapa; aberto: boolean; selecionado: boolean; apagado: boolean; onClick: () => void }) {
  const fundo = selecionado
    ? "fill-indigo-50 dark:fill-indigo-950"
    : n.cadastro
      ? "fill-zinc-100 dark:fill-zinc-800"
      : n.banco
        ? "fill-cyan-50 dark:fill-cyan-950"
        : "fill-white dark:fill-zinc-900";
  const borda =
    selecionado ? "stroke-indigo-500" : aberto ? "stroke-indigo-400" : n.cadastro ? "stroke-zinc-400 dark:stroke-zinc-600" : n.banco ? "stroke-cyan-500 dark:stroke-cyan-600" : "stroke-zinc-300 dark:stroke-zinc-600";
  return (
    <g
      transform={`translate(${n.x},${n.y})`}
      className={`cursor-pointer transition-opacity ${apagado ? "opacity-25" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <title>{`${n.tabela} – ${n.nome}${n.banco ? ` (banco ${n.banco})` : ""}${aberto ? " · aba aberta" : ""}`}</title>
      <rect
        width={NO_LARGURA}
        height={NO_ALTURA}
        rx={10}
        strokeWidth={selecionado ? 2.5 : aberto ? 2 : 1}
        strokeDasharray={n.cadastro ? "4 3" : undefined}
        className={`${fundo} ${borda}`}
      />
      <text x={12} y={21} className="fill-zinc-900 font-mono text-[13px] font-semibold dark:fill-zinc-100">
        {n.tabela}
      </text>
      <text x={12} y={39} className="fill-zinc-500 text-[11px] dark:fill-zinc-400">
        {n.nome.length > 30 ? n.nome.slice(0, 29) + "…" : n.nome}
      </text>
      {n.banco && (
        <text x={NO_LARGURA - 10} y={20} textAnchor="end" className="fill-cyan-700 text-[10px] font-semibold dark:fill-cyan-400">
          {n.banco}
        </text>
      )}
      {aberto && <circle cx={NO_LARGURA - 10} cy={n.banco ? 38 : 12} r={4} className="fill-indigo-500" />}
    </g>
  );
}

function Aresta({ a, de, para, sel, apagada }: { a: ArestaMapa; de: NoMapa; para: NoMapa; sel: string | null; apagada: boolean }) {
  const ativa = !!sel && !apagada;
  const cadastro = a.ligacoes.every((l) => l.tipo === "cadastro");
  // da direita da origem para a esquerda do destino; destino na mesma coluna ou antes: contorna por fora
  const x1 = de.x + NO_LARGURA;
  const y1 = de.y + NO_ALTURA / 2;
  const frente = para.x > de.x;
  const x2 = frente ? para.x : para.x + NO_LARGURA;
  const y2 = para.y + NO_ALTURA / 2;
  const curva = frente ? Math.max(40, (x2 - x1) / 2) : 60;
  const d = frente ? `M${x1},${y1} C${x1 + curva},${y1} ${x2 - curva},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1 + curva},${y1} ${x2 + curva},${y2} ${x2},${y2}`;
  const titulo = a.ligacoes.map((l) => `${l.rotulo}: ${l.pares.map((p) => `${p.origem} = ${p.destino}`).join(" e ")}`).join("\n");
  return (
    <g className={`transition-opacity ${apagada ? "opacity-15" : ""}`}>
      <title>{`${de.tabela} → ${para.tabela}\n${titulo}`}</title>
      <path
        d={d}
        fill="none"
        strokeWidth={ativa ? 2 : 1.3}
        strokeDasharray={cadastro ? "4 3" : undefined}
        markerEnd={`url(#${ativa ? "seta-mapa-ativa" : "seta-mapa"})`}
        className={ativa ? "stroke-indigo-500" : "stroke-zinc-400 dark:stroke-zinc-500"}
      />
      {/* área de clique/hover mais larga */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
    </g>
  );
}

function Detalhes({
  no,
  ligadas,
  porId,
  aberto,
  onIr,
  onCopiar,
}: {
  no: NoMapa;
  ligadas: ArestaMapa[];
  porId: Map<string, NoMapa>;
  aberto: boolean;
  onIr: (id: string) => void;
  onCopiar: (t: string) => void;
}) {
  const saem = ligadas.filter((a) => a.de === no.id);
  const chegam = ligadas.filter((a) => a.para === no.id);
  const bloco = (titulo: string, lista: ArestaMapa[]) =>
    lista.length > 0 && (
      <section className="mt-4">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">{titulo}</h4>
        <ul className="space-y-2">
          {lista.map((a) => {
            const de = porId.get(a.de)!;
            const para = porId.get(a.para)!;
            const outro = a.de === no.id ? para : de;
            return a.ligacoes.map((l, k) => {
              const cond = condicaoJoin(de, para, l);
              return (
                <li key={`${a.de}>${a.para}#${k}`} className="painel p-2">
                  <div className="flex items-center gap-2">
                    <button className="font-mono font-semibold text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => onIr(outro.id)}>
                      {outro.tabela}
                    </button>
                    <span className="truncate text-xs text-zinc-500">{l.rotulo}</span>
                    {l.tipo === "cadastro" && <span className="ml-auto rounded bg-zinc-100 px-1 text-[10px] text-zinc-500 dark:bg-zinc-800">cadastro</span>}
                  </div>
                  <div className="mt-1 flex items-start gap-1">
                    <code className="min-w-0 flex-1 text-xs break-all text-zinc-700 dark:text-zinc-300">{cond}</code>
                    <button className="btn-icone h-6 w-6 shrink-0" title="Copiar a condição do JOIN" aria-label="Copiar a condição do JOIN" onClick={() => onCopiar(cond)}>
                      <IconeCopiar className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            });
          })}
        </ul>
      </section>
    );

  return (
    <div>
      <h3 className="font-mono text-lg font-bold">{no.tabela}</h3>
      <p className="text-zinc-600 dark:text-zinc-400">
        {no.nome}
        {no.banco && <> · banco {no.banco}</>}
        {no.cadastro && <> · cadastro (sem perfil)</>}
      </p>
      {aberto && <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">● Aberta numa aba</p>}
      {bloco("Aponta para", saem)}
      {bloco("Apontada por", chegam)}
      {ligadas.length === 0 && <p className="mt-4 text-zinc-500">Nenhuma ligação cadastrada.</p>}
    </div>
  );
}

function Legenda() {
  return (
    <div className="space-y-3 text-zinc-600 dark:text-zinc-400">
      <p>
        Cada caixa é uma tabela com perfil; cada seta, uma ligação usada no <strong>JOIN sugerido</strong> e em <strong>Ver também</strong>. A seta sai da
        tabela que tem a coluna de ligação para a tabela ligada.
      </p>
      <ul className="space-y-1.5 text-xs">
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900" /> Tabela do ERP
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded border border-cyan-500 bg-cyan-50 dark:bg-cyan-950" /> Outro banco (ex.: HUB)
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded border border-dashed border-zinc-400 bg-zinc-100 dark:bg-zinc-800" /> Cadastro sem perfil
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" /> Tabela aberta numa aba
        </li>
      </ul>
      <p className="text-xs">Para incluir uma tabela ou ligação, cadastre o perfil em config/perfis.ts (veja o README).</p>
    </div>
  );
}
