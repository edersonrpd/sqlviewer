"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { diagnosticar, temDiagnostico } from "@/lib/diagnostico";
import type { Aba, Acao } from "@/lib/estado";
import { formatarData } from "@/lib/formatacao";
import { montarFluxo, montarMapa, type EstadoEvento, type EventoFluxo, type NoMapa } from "@/lib/fluxo";
import { sqlJoin } from "@/lib/join";
import { buscarPerfil } from "@/lib/perfis";
import type { RelacaoPendente, Relacionado } from "@/lib/relacionados";
import { montarTela, sqlRelacionado } from "@/lib/tela";
import { IconeCopiar, IconeDireita, IconeEsquerda } from "./Icones";
import { ESTILO_NIVEL } from "./PainelDiagnostico";
import { SeloMarketplace } from "./SeloMarketplace";
import { ListaRegistros } from "./TelaRegistro";
import { copiarTexto } from "./util";

export type PropsVisao = {
  aba: Aba;
  abas: Aba[];
  indices: number[];
  atualizar: (patch: Partial<Aba>) => void;
  dispatch: (a: Acao) => void;
};

/**
 * Moldura comum ao Fluxo e às Relações: mesmo registro da Tela (registroTela),
 * lista lateral quando há vários, barra com o título e anterior/próximo (← →).
 */
export function MolduraRegistro({ aba, abas, indices, atualizar, children }: PropsVisao & { children: (registro: number, avisar: (t: string) => void) => ReactNode }) {
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2000);
    return () => clearTimeout(t);
  }, [aviso]);

  const posicao = aba.registroTela === null ? 0 : indices.indexOf(aba.registroTela);
  const pos = posicao >= 0 ? posicao : 0;
  const registro = indices[pos];
  const anterior = pos > 0 ? indices[pos - 1] : null;
  const proximo = pos < indices.length - 1 ? indices[pos + 1] : null;

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName;
      if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
      if (e.key === "ArrowLeft" && anterior !== null) atualizar({ registroTela: anterior });
      if (e.key === "ArrowRight" && proximo !== null) atualizar({ registroTela: proximo });
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [anterior, proximo, atualizar]);

  const perfil = buscarPerfil(aba.perfilId);
  const tela = useMemo(() => (registro === undefined ? null : montarTela(aba.dados, registro, perfil)), [aba.dados, registro, perfil]);
  if (registro === undefined || !tela) {
    return <p className="p-8 text-center text-sm text-zinc-500">Nenhum registro corresponde aos filtros atuais.</p>;
  }

  return (
    <div className="absolute inset-0 flex">
      {indices.length > 1 && (
        <ListaRegistros aba={aba} abas={abas} indices={indices} atual={registro} onEscolher={(i) => atualizar({ registroTela: i })} />
      )}
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] space-y-4 p-3 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="font-mono text-xl font-semibold tracking-tight">{tela.titulo}</h2>
            {tela.chave?.raw && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-0.5 text-sm dark:border-amber-700/70 dark:bg-amber-950/40">
                <SeloMarketplace valor={tela.chave.raw} />
                <span className="font-mono font-semibold text-amber-950 dark:text-amber-100">{tela.chave.raw}</span>
              </span>
            )}
            {tela.subtitulo.slice(0, 2).map((c) => (
              <span key={c.nome} className="text-sm text-zinc-600 dark:text-zinc-400">
                {c.rotulo} <strong className="text-zinc-900 dark:text-zinc-100">{c.texto ?? "NULL"}</strong>
              </span>
            ))}
            {indices.length > 1 && (
              <div className="ml-auto flex items-center gap-1.5">
                <button className="btn px-2" disabled={anterior === null} onClick={() => anterior !== null && atualizar({ registroTela: anterior })} title="Anterior (←)" aria-label="Registro anterior">
                  <IconeEsquerda />
                </button>
                <span className="text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
                  {(pos + 1).toLocaleString("pt-BR")} de {indices.length.toLocaleString("pt-BR")}
                </span>
                <button className="btn px-2" disabled={proximo === null} onClick={() => proximo !== null && atualizar({ registroTela: proximo })} title="Próximo (→)" aria-label="Próximo registro">
                  <IconeDireita />
                </button>
              </div>
            )}
          </div>
          {children(registro, setAviso)}
        </div>
      </div>
      {aviso && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-zinc-900 px-3 py-1.5 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
          {aviso}
        </div>
      )}
    </div>
  );
}

function sqlDoPendente(p: RelacaoPendente): string | null {
  return p.chave === null ? null : sqlRelacionado(p.tabela, p.colunaDestino, p.chave, p.extras);
}

function abrirRelacionado(dispatch: (a: Acao) => void, r: Relacionado) {
  if (r.chave === null) return;
  dispatch({
    tipo: "abrirRelacao",
    destino: r.abaId,
    coluna: r.colunaDestino,
    valor: r.chave,
    rotulo: r.rotulo,
    extras: r.extras.map((e) => ({ coluna: e.coluna, valor: e.chave })),
  });
}

/** "2024-10-14 08:03:43" → "14/10/2024" e "08:03:43" */
function partesData(q: string | null): { dia: string; hora: string } | null {
  if (!q) return null;
  return { dia: formatarData(q.slice(0, 10)), hora: q.slice(11, 19) };
}

const ESTILO_EVENTO: Record<EstadoEvento, { ponto: string; selo: string; rotulo: string; cartao: string }> = {
  ok: {
    ponto: "bg-emerald-500",
    selo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    rotulo: "ok",
    cartao: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-white/[0.03]",
  },
  neutro: {
    ponto: "bg-zinc-300 dark:bg-zinc-600",
    selo: "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-400",
    rotulo: "sem registro (normal)",
    cartao: "border-dashed border-zinc-300 bg-white/60 dark:border-zinc-700 dark:bg-transparent",
  },
  pendente: {
    ponto: "bg-amber-500",
    selo: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    rotulo: "pendente",
    cartao: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-white/[0.03]",
  },
  ausente: {
    ponto: "bg-red-500",
    selo: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    rotulo: "sem registro",
    cartao: "border-dashed border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20",
  },
  naoConsultado: {
    ponto: "border-2 border-dashed border-zinc-400 bg-transparent dark:border-zinc-500",
    selo: "bg-zinc-200 text-zinc-700 dark:bg-white/10 dark:text-zinc-300",
    rotulo: "não consultado",
    cartao: "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-transparent",
  },
  semChave: {
    ponto: "border-2 border-dashed border-zinc-300 bg-transparent dark:border-zinc-600",
    selo: "bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-400",
    rotulo: "sem chave",
    cartao: "border-dashed border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-transparent",
  },
};

/* ------------------------------------------------------------------ Fluxo */

export function FluxoRegistro(props: PropsVisao) {
  const { aba, abas, dispatch } = props;
  return (
    <MolduraRegistro {...props}>
      {(registro, avisar) => <ConteudoFluxo aba={aba} abas={abas} registro={registro} dispatch={dispatch} avisar={avisar} />}
    </MolduraRegistro>
  );
}

function ConteudoFluxo({
  aba,
  abas,
  registro,
  dispatch,
  avisar,
}: {
  aba: Aba;
  abas: Aba[];
  registro: number;
  dispatch: (a: Acao) => void;
  avisar: (t: string) => void;
}) {
  const eventos = useMemo(() => montarFluxo(aba, registro, abas), [aba, registro, abas]);
  const diagnostico = useMemo(() => (temDiagnostico(aba.perfilId) ? diagnosticar(aba, registro, abas) : null), [aba, registro, abas]);
  const join = useMemo(() => sqlJoin(aba.dados, registro, aba.perfilId), [aba.dados, registro, aba.perfilId]);
  const copiar = async (sql: string, msg: string) => avisar((await copiarTexto(sql)) ? msg : "Não foi possível copiar");

  const conhecidos = eventos.filter((e) => e.estado !== "naoConsultado" && e.estado !== "semChave" && e.estado !== "neutro");
  const okCount = conhecidos.filter((e) => e.estado === "ok").length;
  const parou = conhecidos.find((e) => e.estado !== "ok");
  const atencao = (diagnostico?.achados ?? []).filter((a) => a.nivel !== "ok");
  const faltando = eventos.filter((e) => e.estado === "naoConsultado");

  const copiarLinhaDoTempo = () => {
    const linhas = eventos.map((e) => {
      const d = partesData(e.quando);
      return `${d ? `${d.dia} ${d.hora}`.trim() : "sem data"}\t${e.rotulo} (${e.origem})\t${ESTILO_EVENTO[e.estado].rotulo}\t${e.detalhe}`;
    });
    copiar(linhas.join("\n"), "Linha do tempo copiada");
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="painel p-4 sm:p-5" aria-label="Linha do tempo">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Linha do tempo</h3>
          <span className="text-xs text-zinc-500">o registro e as abas ligadas a ele, em ordem de data</span>
          <button className="btn ml-auto" onClick={copiarLinhaDoTempo}>
            <IconeCopiar className="h-3.5 w-3.5" /> Copiar linha do tempo
          </button>
        </div>
        <ol className="relative">
          {/* trilho */}
          <span aria-hidden className="absolute top-2 bottom-2 left-[7.6rem] w-0.5 bg-zinc-200 sm:left-[9.1rem] dark:bg-zinc-800" />
          {eventos.map((e) => (
            <ItemFluxo
              key={e.id}
              evento={e}
              onAbrir={e.relacionado && e.estado === "ok" ? () => abrirRelacionado(dispatch, e.relacionado!) : undefined}
              onCopiarSql={e.pendente && sqlDoPendente(e.pendente) ? () => copiar(sqlDoPendente(e.pendente!)!, "SQL copiado") : undefined}
            />
          ))}
        </ol>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-5">
        <section className="painel space-y-2.5 p-4" aria-label="Onde o registro está">
          <h3 className="text-sm font-semibold">Onde está</h3>
          <div className="flex gap-1" aria-hidden>
            {eventos.map((e) => (
              <span key={e.id} title={e.rotulo} className={`h-2 flex-1 rounded ${e.estado === "ok" ? "bg-emerald-500" : e.estado === "pendente" ? "bg-amber-500" : e.estado === "ausente" ? "bg-red-500" : "bg-zinc-300 dark:bg-zinc-700"}`} />
            ))}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {okCount} de {conhecidos.length} etapa(s) ok
            {parou && (
              <>
                {" "}
                · parou em <strong className={parou.estado === "ausente" ? "text-red-700 dark:text-red-400" : "text-amber-800 dark:text-amber-300"}>{parou.rotulo}</strong>
              </>
            )}
            {faltando.length > 0 && ` · ${faltando.length} consulta(s) faltando`}
          </p>
        </section>

        {atencao.length > 0 && (
          <section className="painel space-y-2 p-4" aria-label="Pontos de atenção">
            <h3 className="text-sm font-semibold">Pontos de atenção</h3>
            <ul className="space-y-2">
              {atencao.map((a, k) => (
                <li key={k} className="flex gap-2 text-[13px]">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ESTILO_NIVEL[a.nivel].ponto}`} />
                  <span>
                    <span className="font-medium">{a.titulo}</span>
                    {a.detalhe && <span className="block text-xs text-zinc-500">{a.detalhe}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(faltando.length > 0 || join) && (
          <section className="painel space-y-2 p-4" aria-label="Completar a linha do tempo">
            <h3 className="text-sm font-semibold">Completar a linha do tempo</h3>
            <p className="text-xs text-zinc-500">Execute no MySQL e cole o resultado: a etapa entra no lugar certo.</p>
            {join && (
              <button className="btn-destaque w-full justify-center" onClick={() => copiar(join, "JOIN copiado")}>
                <IconeCopiar className="h-3.5 w-3.5" /> Copiar tudo (JOIN)
              </button>
            )}
            <button className="btn w-full justify-center" onClick={() => dispatch({ tipo: "ativar", id: null })}>
              Colar resultado
            </button>
          </section>
        )}
      </aside>
    </div>
  );
}

function ItemFluxo({ evento: e, onAbrir, onCopiarSql }: { evento: EventoFluxo; onAbrir?: () => void; onCopiarSql?: () => void }) {
  const d = partesData(e.quando);
  const estilo = ESTILO_EVENTO[e.estado];
  const apagado = e.estado === "naoConsultado" || e.estado === "semChave";
  return (
    <li className="relative flex items-start gap-3 pb-3 last:pb-0 sm:gap-4">
      <div className="w-[6.4rem] shrink-0 pt-2 text-right sm:w-[7.9rem]">
        {d ? (
          <>
            <p className="font-mono text-[13px] font-semibold tabular-nums">{d.dia}</p>
            <p className="font-mono text-[11px] text-zinc-500 tabular-nums">{d.hora}</p>
          </>
        ) : (
          <p className="pt-0.5 text-xs text-zinc-500">{apagado ? "—" : "sem data"}</p>
        )}
      </div>
      <span className={`relative z-10 mt-2.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-zinc-50 dark:ring-zinc-900 ${estilo.ponto}`} aria-hidden />
      <div className={`flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border px-3.5 py-2.5 ${estilo.cartao}`}>
        <div className="min-w-0 flex-1">
          <p className={`flex flex-wrap items-baseline gap-x-2 text-sm font-semibold ${apagado ? "text-zinc-600 dark:text-zinc-400" : ""}`}>
            {e.rotulo}
            <span className="font-mono text-[10.5px] font-normal text-zinc-500">
              {e.origem}
              {e.quantidade !== undefined && e.quantidade > 1 && ` · ${e.quantidade} registros`}
            </span>
          </p>
          {e.detalhe && <p className="mt-0.5 text-xs break-words text-zinc-600 dark:text-zinc-400">{e.detalhe}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${estilo.selo}`}>{estilo.rotulo}</span>
          {onAbrir && (
            <button className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={onAbrir}>
              Abrir
            </button>
          )}
          {onCopiarSql && (
            <button className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={onCopiarSql}>
              Copiar SQL
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------- Relações */

export function MapaRelacoes(props: PropsVisao) {
  const { aba, abas, dispatch } = props;
  return (
    <MolduraRegistro {...props}>
      {(registro, avisar) => <ConteudoMapa aba={aba} abas={abas} registro={registro} dispatch={dispatch} avisar={avisar} />}
    </MolduraRegistro>
  );
}

/** Área virtual do mapa; o desenho é reduzido para caber na largura disponível. */
const W = 1400;
const NO_L = 200;
const NO_A = 86;

type Pos = { x: number; y: number };

/** Altura do mapa: menor quando não há 2º nível. */
function alturaMapa(nos: NoMapa[]): number {
  return nos.some((n) => n.nivel === 2) ? 860 : 640;
}

function posicionar(nos: NoMapa[]): Map<string, Pos> {
  const H = alturaMapa(nos);
  const dois = H > 700;
  const pos = new Map<string, Pos>([["centro", { x: W / 2, y: H / 2 }]]);
  const n1 = nos.filter((n) => n.nivel === 1);
  const ang = new Map<string, number>();
  n1.forEach((n, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / Math.max(n1.length, 1);
    ang.set(n.id, a);
    pos.set(n.id, { x: W / 2 + 390 * Math.cos(a), y: H / 2 + (dois ? 250 : 225) * Math.sin(a) });
  });
  const limitar = (p: Pos): Pos => ({
    x: Math.min(W - NO_L / 2 - 8, Math.max(NO_L / 2 + 8, p.x)),
    y: Math.min(H - NO_A / 2 - 8, Math.max(NO_A / 2 + 8, p.y)),
  });
  for (const pai of n1) {
    const filhos = nos.filter((n) => n.pai === pai.id);
    const base = ang.get(pai.id)!;
    filhos.forEach((f, i) => {
      const a = base + (i - (filhos.length - 1) / 2) * 0.34;
      pos.set(f.id, limitar({ x: W / 2 + 610 * Math.cos(a), y: H / 2 + 385 * Math.sin(a) }));
    });
  }
  return pos;
}

const ESTILO_NO: Record<NoMapa["estado"], { caixa: string; linha: string; traco?: string }> = {
  ok: { caixa: "border-emerald-500/80 bg-white dark:bg-zinc-900", linha: "#9aa1b2" },
  neutro: { caixa: "border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900", linha: "#c3c8d2", traco: "4 4" },
  ausente: { caixa: "border-dashed border-red-400 bg-red-50 dark:border-red-800 dark:bg-[#2a1210]", linha: "#dc6b4a", traco: "6 5" },
  naoConsultado: { caixa: "border-dashed border-zinc-400 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900", linha: "#8a90a0", traco: "6 5" },
  semChave: { caixa: "border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900", linha: "#b4b9c4", traco: "3 5" },
};

function ConteudoMapa({
  aba,
  abas,
  registro,
  dispatch,
  avisar,
}: {
  aba: Aba;
  abas: Aba[];
  registro: number;
  dispatch: (a: Acao) => void;
  avisar: (t: string) => void;
}) {
  const mapa = useMemo(() => montarMapa(aba, registro, abas), [aba, registro, abas]);
  const pos = useMemo(() => posicionar(mapa.nos), [mapa.nos]);
  const H = alturaMapa(mapa.nos);
  const join = useMemo(() => sqlJoin(aba.dados, registro, aba.perfilId), [aba.dados, registro, aba.perfilId]);
  const caixa = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setEscala(Math.min(1, Math.max(0.45, e.contentRect.width / W))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const copiar = async (sql: string, msg: string) => avisar((await copiarTexto(sql)) ? msg : "Não foi possível copiar");
  const centro = pos.get("centro")!;

  if (mapa.nos.length === 0) {
    return (
      <div className="painel p-8 text-center text-sm text-zinc-500">
        {aba.perfilId
          ? "Este perfil não tem relações com outras tabelas."
          : "Sem perfil detectado para esta consulta: não há como saber com quais tabelas ela se liga."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-emerald-500/80 bg-white dark:bg-zinc-900" /> com dados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-dashed border-red-400 bg-red-50 dark:bg-red-950/50" /> 0 registros
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-dashed border-zinc-400" /> não consultado
        </span>
        <span>Clique num nó para abrir a aba (ou copiar a consulta que falta)</span>
        {join && (
          <button className="btn-destaque ml-auto" onClick={() => copiar(join, "JOIN copiado")}>
            <IconeCopiar className="h-3.5 w-3.5" /> Copiar tudo (JOIN)
          </button>
        )}
      </div>

      <div ref={caixa} className="painel overflow-hidden bg-[radial-gradient(#d9dce3_1px,transparent_1px)] [background-size:20px_20px] dark:bg-[radial-gradient(#ffffff14_1px,transparent_1px)]">
        <div style={{ width: W * escala, height: H * escala }} className="relative mx-auto">
          <div style={{ width: W, height: H, transform: `scale(${escala})`, transformOrigin: "0 0" }} className="absolute top-0 left-0">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="absolute inset-0" aria-hidden>
              {mapa.nos.map((n) => {
                const a = pos.get(n.pai)!;
                const b = pos.get(n.id)!;
                const e = ESTILO_NO[n.estado];
                return <line key={n.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.linha} strokeWidth={1.5} strokeDasharray={e.traco} />;
              })}
            </svg>
            {/* nome da coluna da ligação no meio de cada linha */}
            {mapa.nos.map((n) => {
              const a = pos.get(n.pai)!;
              const b = pos.get(n.id)!;
              return (
                <span
                  key={`l-${n.id}`}
                  style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-zinc-100 px-1.5 py-px font-mono text-[10.5px] whitespace-nowrap text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {n.chave}
                </span>
              );
            })}

            <div
              style={{ left: centro.x, top: centro.y, width: 250 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-indigo-500 bg-white px-4 py-3 shadow-[0_10px_30px_-12px_rgb(84_88_232/0.5)] dark:bg-zinc-900"
            >
              <p className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold">{mapa.centro.aba}</span>
                <span className="rounded-full bg-indigo-100 px-2 text-[11px] font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">este registro</span>
              </p>
              {mapa.centro.perfil && <p className="truncate text-xs text-zinc-500">{mapa.centro.perfil}</p>}
              <p className="mt-1.5 truncate font-mono text-[15px] font-semibold">{mapa.centro.titulo}</p>
              {mapa.centro.resumo && <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{mapa.centro.resumo}</p>}
            </div>

            {mapa.nos.map((n) => {
              const p = pos.get(n.id)!;
              const sql = n.pendente ? sqlDoPendente(n.pendente) : null;
              const clicavel = (n.relacionado && n.estado === "ok") || sql;
              const vermelho = n.estado === "ausente";
              return (
                <button
                  key={n.id}
                  type="button"
                  disabled={!clicavel}
                  onClick={() => {
                    if (n.relacionado && n.estado === "ok") abrirRelacionado(dispatch, n.relacionado);
                    else if (sql) copiar(sql, `SQL de ${n.rotulo} copiado`);
                  }}
                  title={n.relacionado ? (n.estado === "ok" ? `Abrir na aba ${n.aba}` : "Nenhum registro ligado") : sql ? "Copiar a consulta" : n.resumo}
                  style={{ left: p.x, top: p.y, width: n.nivel === 1 ? NO_L : NO_L - 20 }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-[1.5px] px-3 py-2 text-left transition enabled:hover:-translate-y-[calc(50%+2px)] enabled:hover:shadow-md disabled:cursor-default ${ESTILO_NO[n.estado].caixa}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate font-mono text-xs font-bold ${vermelho ? "text-red-800 dark:text-red-300" : ""}`}>{n.aba}</span>
                    <span className={`font-mono text-[11px] ${vermelho ? "font-bold text-red-800 dark:text-red-300" : "text-zinc-500"}`}>{n.quantidade ?? "—"}</span>
                  </span>
                  <span className={`block truncate text-xs ${vermelho ? "text-red-800 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}`}>{n.rotulo}</span>
                  <span className={`mt-1 block truncate text-xs ${
                      n.estado === "ok"
                        ? "font-medium"
                        : vermelho
                          ? "font-semibold text-red-800 dark:text-red-300"
                          : n.estado === "naoConsultado"
                            ? "font-semibold text-blue-700 dark:text-blue-300"
                            : "text-zinc-500"
                    }`}>
                    {n.estado === "naoConsultado" ? "Copiar consulta" : n.resumo}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
