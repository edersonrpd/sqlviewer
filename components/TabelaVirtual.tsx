"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef, type Column } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { colunaDestaque } from "@/lib/destaque";
import type { Aba } from "@/lib/estado";
import { NOMES_TIPOS } from "@/lib/formatacao";
import { buscarPerfil } from "@/lib/perfis";
import type { TipoColuna } from "@/lib/tipos";
import { alinhamento, Celula } from "./Celula";
import { IconeDireita } from "./Icones";
import { useDebounce } from "./util";

const ALTURA_LINHA = 40;
const ALTURA_CABECALHO = 62;
const LARGURA_SELECAO = 44;
const ID_SELECAO = "__selecao";
const bordaCelula = "border-b border-zinc-900/[0.06] dark:border-white/5";
const bordaCabecalho = "border-b border-zinc-900/[0.08] dark:border-white/[0.08]";
const sombraFixa = "shadow-[1px_0_0_0_rgb(18_19_26/0.08)] dark:shadow-[1px_0_0_0_rgb(255_255_255/0.08)]";
// barra índigo à esquerda da linha marcada, somada à divisória da última coluna fixa
const sombraLinha = (barra: boolean, ultimaFixa: boolean) =>
  barra
    ? ultimaFixa
      ? "shadow-[inset_3px_0_0_var(--color-blue-500),1px_0_0_0_rgb(18_19_26/0.08)] dark:shadow-[inset_3px_0_0_var(--color-blue-400),1px_0_0_0_rgb(255_255_255/0.08)]"
      : "shadow-[inset_3px_0_0_var(--color-blue-500)] dark:shadow-[inset_3px_0_0_var(--color-blue-400)]"
    : ultimaFixa
      ? sombraFixa
      : "";
// códigos, números e datas em fonte monoespaçada, como no grid do cliente SQL
const TIPOS_MONO = new Set<TipoColuna>(["inteiro", "decimal", "data", "datahora", "hora"]);

/** Linhas do topo que entram em cascata (as demais aparecem direto, para não atrasar a rolagem). */
const LINHAS_ANIMADAS = 20;
let contadorGeracao = 0;

type Props = {
  aba: Aba;
  /** colunas exibidas (fixas primeiro) */
  colunas: number[];
  qtdFixas: number;
  /** linhas filtradas e ordenadas */
  indices: number[];
  atualizar: (patch: Partial<Aba>) => void;
};

/**
 * Tabela com virtualização de linhas e colunas. O TanStack Table cuida do
 * modelo de colunas (fixação e larguras); filtro e ordenação já chegam
 * aplicados em `indices`.
 */
export function TabelaVirtual({ aba, colunas, qtdFixas, indices, atualizar }: Props) {
  const { dados, larguras, ordenacao, selecionadas, registro } = aba;
  // coluna-chave destacada (ex.: NUMPOK)
  const idDestaque = useMemo(() => {
    const d = colunaDestaque(dados.colunas, buscarPerfil(aba.perfilId));
    return d ? String(d.j) : null;
  }, [dados.colunas, aba.perfilId]);
  const fundoCabecalho = (id: string) =>
    `bg-[#f8f9fc] dark:bg-[#13151d] ${id === idDestaque ? "text-cyan-700 dark:text-cyan-300" : ""}`;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cada novo conjunto de linhas (abrir, filtrar, ordenar) ganha uma "geração": as linhas
  // são recriadas e as do topo sobem em cascata. Rolagem posterior não anima.
  const geracao = useMemo(() => ({ id: ++contadorGeracao, ate: Date.now() + 1200 }), [indices]); // eslint-disable-line react-hooks/exhaustive-deps

  const definicoes = useMemo<ColumnDef<number>[]>(
    () => [
      { id: ID_SELECAO, size: LARGURA_SELECAO },
      ...colunas.map((j): ColumnDef<number> => ({ id: String(j), size: larguras[j] })),
    ],
    [colunas, larguras],
  );
  const fixasIds = useMemo(() => [ID_SELECAO, ...colunas.slice(0, qtdFixas).map(String)], [colunas, qtdFixas]);

  const table = useReactTable({
    data: indices,
    columns: definicoes,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (i) => String(i),
    state: { columnPinning: { left: fixasIds } },
    manualSorting: true,
    manualFiltering: true,
  });

  const esquerda = table.getLeftLeafColumns();
  const centro = table.getCenterLeafColumns();
  const larguraFixas = esquerda.reduce((s, c) => s + c.getSize(), 0);
  const larguraTotal = larguraFixas + centro.reduce((s, c) => s + c.getSize(), 0);

  const linhasVirt = useVirtualizer({
    count: indices.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 12,
    scrollMargin: ALTURA_CABECALHO,
  });
  const colunasVirt = useVirtualizer({
    horizontal: true,
    count: centro.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (k) => centro[k]?.getSize() ?? 120,
    overscan: 4,
    scrollMargin: larguraFixas,
  });
  // larguras mudam quando colunas são mostradas/ocultadas/fixadas
  useEffect(() => colunasVirt.measure(), [definicoes, fixasIds, colunasVirt]);

  const itensColuna = colunasVirt.getVirtualItems();
  const espacoEsquerda = itensColuna.length ? itensColuna[0].start - larguraFixas : 0;

  // deslocamento "left" de cada coluna fixa
  const offsets = useMemo(() => {
    const m = new Map<string, number>();
    let x = 0;
    for (const c of esquerda) {
      m.set(c.id, x);
      x += c.getSize();
    }
    return m;
  }, [esquerda]);

  const [todasMarcadas, algumaMarcada] = useMemo(() => {
    if (selecionadas.size === 0 || indices.length === 0) return [false, false];
    const todas = indices.every((i) => selecionadas.has(i));
    return [todas, !todas && indices.some((i) => selecionadas.has(i))];
  }, [indices, selecionadas]);

  // callbacks estáveis para que as linhas memoizadas não re-renderizem à toa
  const selecionadasRef = useRef(selecionadas);
  selecionadasRef.current = selecionadas;
  const alternarLinha = useCallback(
    (i: number) => {
      const s = new Set(selecionadasRef.current);
      if (s.has(i)) s.delete(i);
      else s.add(i);
      atualizar({ selecionadas: s });
    },
    [atualizar],
  );
  const abrirRegistro = useCallback((i: number) => atualizar({ registro: i }), [atualizar]);
  const alternarTodas = () => {
    const s = new Set(selecionadas);
    for (const i of indices) {
      if (todasMarcadas) s.delete(i);
      else s.add(i);
    }
    atualizar({ selecionadas: s });
  };
  const ordenar = (j: number) => {
    if (ordenacao?.coluna !== j) atualizar({ ordenacao: { coluna: j, desc: false } });
    else if (!ordenacao.desc) atualizar({ ordenacao: { coluna: j, desc: true } });
    else atualizar({ ordenacao: null });
  };

  // volta ao topo quando o conjunto de linhas muda (filtro/ordenação)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [aba.busca, aba.filtros, aba.relacoes, ordenacao]);

  const estiloFixa = (c: Column<number>): React.CSSProperties => ({ width: c.getSize(), left: offsets.get(c.id) });

  const cabecalho = (c: Column<number>) => {
    if (c.id === ID_SELECAO) {
      return (
        <div className="flex h-full items-center justify-center">
          <input
            type="checkbox"
            aria-label="Selecionar todas as linhas filtradas"
            checked={todasMarcadas}
            ref={(el) => {
              if (el) el.indeterminate = algumaMarcada;
            }}
            onChange={alternarTodas}
          />
        </div>
      );
    }
    const j = Number(c.id);
    const col = dados.colunas[j];
    const ordenada = ordenacao?.coluna === j;
    const sentido = ordenada ? (ordenacao.desc ? "↓" : "↑") : "";
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 px-2">
        <button
          className={`flex min-w-0 items-center gap-1 text-left font-mono text-[11px] font-semibold tracking-[0.04em] transition-colors ${
            ordenada ? "text-blue-700 dark:text-blue-300" : c.id === idDestaque ? "" : "text-zinc-500 hover:text-zinc-800 dark:text-[#8b92a5] dark:hover:text-zinc-200"
          }`}
          title={`${col.nome} · ${NOMES_TIPOS[col.tipo]} — clique para ordenar`}
          onClick={() => ordenar(j)}
        >
          <span className="truncate">{col.nome}</span>
          <span key={sentido} className="shrink-0 animate-surgir text-xs">{sentido}</span>
        </button>
        <FiltroColuna
          valor={aba.filtros[j] ?? ""}
          onChange={(t) => {
            const filtros = { ...aba.filtros };
            if (t.trim()) filtros[j] = t;
            else delete filtros[j];
            atualizar({ filtros });
          }}
          nome={col.nome}
        />
      </div>
    );
  };


  return (
    // cartão de vidro em volta da tabela
    <div className="absolute inset-x-3 top-0 bottom-3 isolate overflow-hidden rounded-2xl border border-zinc-900/[0.08] bg-white shadow-[0_24px_60px_-30px_rgb(30_27_75/0.35)] sm:inset-x-5 sm:bottom-5 dark:border-white/[0.09] dark:bg-[#0c0e16] dark:shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.05)]">
    <div ref={scrollRef} className="absolute inset-0 overflow-auto text-[13px]" role="grid" aria-rowcount={indices.length + 1}>
      <div style={{ width: larguraTotal, minWidth: "100%" }}>
        {/* cabeçalho fixo */}
        <div
          className="sticky top-0 z-20 flex bg-[#f8f9fc] dark:bg-[#13151d]"
          style={{ height: ALTURA_CABECALHO, width: larguraTotal }}
          role="row"
        >
          {esquerda.map((c, k) => (
            <div
              key={c.id}
              role="columnheader"
              style={estiloFixa(c)}
              className={`sticky z-30 shrink-0 ${fundoCabecalho(c.id)} ${bordaCabecalho} ${
                k === esquerda.length - 1 ? sombraFixa : ""
              }`}
            >
              {cabecalho(c)}
            </div>
          ))}
          <div style={{ width: espacoEsquerda }} className="shrink-0" />
          {itensColuna.map((vc) => {
            const c = centro[vc.index];
            return (
              <div key={c.id} role="columnheader" style={{ width: c.getSize() }} className={`shrink-0 ${fundoCabecalho(c.id)} ${bordaCabecalho}`}>
                {cabecalho(c)}
              </div>
            );
          })}
          <div className={`min-w-0 flex-1 ${bordaCabecalho}`} />
        </div>

        {/* linhas */}
        <div className="relative" style={{ height: linhasVirt.getTotalSize() }}>
          {linhasVirt.getVirtualItems().map((vr) => {
            const i = indices[vr.index];
            if (i === undefined) return null;
            return (
              <LinhaTabela
                key={`${geracao.id}-${i}`}
                i={i}
                topo={vr.start - ALTURA_CABECALHO}
                atraso={vr.index < LINHAS_ANIMADAS && Date.now() < geracao.ate ? vr.index * 0.04 : null}
                marcada={selecionadas.has(i)}
                aberta={registro === i}
                dados={dados}
                esquerda={esquerda}
                offsets={offsets}
                centro={centro}
                colInicio={itensColuna[0]?.index ?? 0}
                colFim={itensColuna.length ? itensColuna[itensColuna.length - 1].index : -1}
                espacoEsquerda={espacoEsquerda}
                larguraTotal={larguraTotal}
                onAlternar={alternarLinha}
                onAbrir={abrirRegistro}
                idDestaque={idDestaque}
              />
            );
          })}
        </div>
        {indices.length === 0 && (
          <p className="sticky left-0 animate-subir p-6 text-sm text-zinc-500" style={{ width: "min(100%, 40rem)" }}>
            Nenhuma linha corresponde aos filtros atuais.
          </p>
        )}
      </div>
    </div>
    </div>
  );
}

type PropsLinha = {
  i: number;
  topo: number;
  /** atraso (s) da animação de entrada; null = sem animação */
  atraso: number | null;
  marcada: boolean;
  aberta: boolean;
  dados: Aba["dados"];
  esquerda: Column<number>[];
  offsets: Map<string, number>;
  centro: Column<number>[];
  colInicio: number;
  colFim: number;
  espacoEsquerda: number;
  larguraTotal: number;
  onAlternar: (i: number) => void;
  onAbrir: (i: number) => void;
  idDestaque: string | null;
};

const LinhaTabela = memo(function LinhaTabela(p: PropsLinha) {
  const { i, dados } = p;
  // fundos opacos (as colunas fixas cobrem as demais ao rolar), equivalentes ao índigo translúcido do design
  const fundo = p.aberta
    ? "bg-[#e6e9ff] dark:bg-[#1c1f3d]"
    : p.marcada
      ? "bg-[#f1f2ff] dark:bg-[#15172c]"
      : "bg-white dark:bg-[#0c0e16]";
  const classe = `flex shrink-0 items-center text-zinc-700 transition-colors duration-150 ${fundo} group-hover:bg-[#eef0ff] dark:text-zinc-300 dark:group-hover:bg-[#191c33] ${bordaCelula}`;

  // primeira coluna de dados (identificador) em cor mais forte
  const k0 = (c: Column<number>) => c.id === p.esquerda[1]?.id;
  const conteudo = (c: Column<number>) => {
    if (c.id === ID_SELECAO) {
      return (
        <label className="flex h-full w-full cursor-pointer items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" className="h-[15px] w-[15px]" aria-label="Selecionar linha" checked={p.marcada} onChange={() => p.onAlternar(i)} />
        </label>
      );
    }
    const j = Number(c.id);
    const col = dados.colunas[j];
    const v = dados.linhas[i][j];
    if (c.id === p.idDestaque) {
      // coluna-chave (ex.: NUMPOK) como etiqueta ciano
      return (
        <div className="min-w-0 flex-1 truncate px-2" title={v === null ? "NULL" : v}>
          {v ? (
            <span className="rounded-md bg-cyan-100 px-2 py-0.5 font-mono text-xs font-medium text-cyan-800 dark:bg-cyan-400/[0.12] dark:text-cyan-300">
              <Celula valor={v} tipo={col.tipo} />
            </span>
          ) : (
            <Celula valor={v} tipo={col.tipo} />
          )}
        </div>
      );
    }
    return (
      <div
        className={`min-w-0 flex-1 truncate px-3 ${alinhamento(col.tipo)} ${TIPOS_MONO.has(col.tipo) ? "font-mono" : ""} ${
          k0(c) ? "text-zinc-900 dark:text-zinc-100" : ""
        }`}
        title={v === null ? "NULL" : v}
      >
        <Celula valor={v} tipo={col.tipo} />
      </div>
    );
  };

  const centro: React.ReactNode[] = [];
  for (let k = p.colInicio; k <= p.colFim; k++) {
    const c = p.centro[k];
    if (!c) continue;
    centro.push(
      <div key={c.id} role="gridcell" style={{ width: c.getSize() }} className={classe}>
        {conteudo(c)}
      </div>,
    );
  }

  return (
    <div
      role="row"
      aria-selected={p.marcada}
      onClick={() => p.onAbrir(i)}
      className="group absolute top-0 left-0 flex min-w-full cursor-pointer"
      style={{ height: ALTURA_LINHA, width: p.larguraTotal, transform: `translateY(${p.topo}px)` }}
    >
      {/* a animação fica num filho: o transform da linha é usado pelo posicionamento virtual */}
      <div
        className={`flex flex-1 ${p.atraso !== null ? "animate-entrar-linha" : ""}`}
        style={p.atraso !== null ? { animationDelay: `${p.atraso}s` } : undefined}
      >
        {p.esquerda.map((c, k) => (
          <div
            key={c.id}
            role="gridcell"
            style={{ width: c.getSize(), left: p.offsets.get(c.id) }}
            className={`sticky z-10 ${classe} ${sombraLinha(k === 0 && (p.marcada || p.aberta), k === p.esquerda.length - 1)}`}
          >
            {conteudo(c)}
          </div>
        ))}
        <div style={{ width: p.espacoEsquerda }} className="shrink-0" />
        {centro}
        <div className={`min-w-0 flex-1 ${classe}`} />
        {/* "abrir ficha": aparece ao passar o mouse, preso à borda direita */}
        <div className="sticky right-0 z-10 w-0 shrink-0">
          <button
            tabIndex={-1}
            aria-label="Abrir ficha do registro"
            title="Abrir ficha"
            className="absolute top-1/2 right-2.5 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg border border-zinc-900/10 bg-white text-blue-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 dark:border-white/15 dark:bg-[#1a1d2e] dark:text-blue-200"
            onClick={(e) => {
              e.stopPropagation();
              p.onAbrir(i);
            }}
          >
            <IconeDireita className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

function FiltroColuna({ valor, onChange, nome }: { valor: string; onChange: (t: string) => void; nome: string }) {
  const [texto, setTexto] = useState(valor);
  const atrasado = useDebounce(texto, 250);
  const ultimo = useRef(valor);
  // sincroniza quando o filtro é removido por fora (chip / limpar filtros)
  useEffect(() => {
    if (valor !== ultimo.current) {
      ultimo.current = valor;
      setTexto(valor);
    }
  }, [valor]);
  useEffect(() => {
    if (atrasado !== ultimo.current) {
      ultimo.current = atrasado;
      onChange(atrasado);
    }
  }, [atrasado]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      placeholder="contém…"
      aria-label={`Filtrar ${nome}`}
      className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs font-normal transition outline-none focus:border-blue-500 focus:shadow-[0_0_0_3px_rgb(99_102_241/0.2)] dark:border-white/10 dark:bg-zinc-950"
    />
  );
}
