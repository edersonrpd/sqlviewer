"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef, type Column } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { colunaDestaque } from "@/lib/destaque";
import type { Aba } from "@/lib/estado";
import { NOMES_TIPOS } from "@/lib/formatacao";
import { buscarPerfil } from "@/lib/perfis";
import { alinhamento, Celula } from "./Celula";
import { useDebounce } from "./util";

const ALTURA_LINHA = 30;
const ALTURA_CABECALHO = 62;
const LARGURA_SELECAO = 36;
const ID_SELECAO = "__selecao";
const bordaCelula = "border-r border-b border-zinc-200 dark:border-zinc-800";
const sombraFixa = "shadow-[2px_0_0_0_rgba(0,0,0,0.08)]";

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
    id === idDestaque ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-zinc-100 dark:bg-zinc-900";
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const sentido = ordenacao?.coluna === j ? (ordenacao.desc ? "▼" : "▲") : "";
    return (
      <div className="flex h-full flex-col justify-center gap-1 px-1.5">
        <button
          className="flex min-w-0 items-center gap-1 text-left font-mono text-xs font-semibold"
          title={`${col.nome} · ${NOMES_TIPOS[col.tipo]} — clique para ordenar`}
          onClick={() => ordenar(j)}
        >
          <span className="truncate">{col.nome}</span>
          <span className="shrink-0 text-[10px] text-blue-600 dark:text-blue-400">{sentido}</span>
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
    <div ref={scrollRef} className="absolute inset-0 overflow-auto text-sm" role="grid" aria-rowcount={indices.length + 1}>
      <div style={{ width: larguraTotal, minWidth: "100%" }}>
        {/* cabeçalho fixo */}
        <div
          className="sticky top-0 z-20 flex bg-zinc-100 dark:bg-zinc-900"
          style={{ height: ALTURA_CABECALHO, width: larguraTotal }}
          role="row"
        >
          {esquerda.map((c, k) => (
            <div
              key={c.id}
              role="columnheader"
              style={estiloFixa(c)}
              className={`sticky z-30 shrink-0 ${fundoCabecalho(c.id)} ${bordaCelula} ${
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
              <div key={c.id} role="columnheader" style={{ width: c.getSize() }} className={`shrink-0 ${fundoCabecalho(c.id)} ${bordaCelula}`}>
                {cabecalho(c)}
              </div>
            );
          })}
        </div>

        {/* linhas */}
        <div className="relative" style={{ height: linhasVirt.getTotalSize() }}>
          {linhasVirt.getVirtualItems().map((vr) => {
            const i = indices[vr.index];
            if (i === undefined) return null;
            return (
              <LinhaTabela
                key={i}
                i={i}
                topo={vr.start - ALTURA_CABECALHO}
                par={vr.index % 2 === 0}
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
          <p className="sticky left-0 p-6 text-sm text-zinc-500" style={{ width: "min(100%, 40rem)" }}>
            Nenhuma linha corresponde aos filtros atuais.
          </p>
        )}
      </div>
    </div>
  );
}

type PropsLinha = {
  i: number;
  topo: number;
  par: boolean;
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
  const fundo = p.aberta
    ? "bg-blue-100 dark:bg-blue-950"
    : p.marcada
      ? "bg-blue-50 dark:bg-blue-950/50"
      : p.par
        ? "bg-white dark:bg-zinc-950"
        : "bg-zinc-50 dark:bg-zinc-900/60";
  const classeCelula = `flex shrink-0 items-center ${fundo} group-hover:bg-amber-50 dark:group-hover:bg-zinc-800 ${bordaCelula}`;
  const classeDestaque = `flex shrink-0 items-center bg-amber-50 font-mono font-semibold text-amber-900 group-hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200 ${bordaCelula}`;
  const classe = (c: Column<number>) => (c.id === p.idDestaque ? classeDestaque : classeCelula);

  const conteudo = (c: Column<number>) => {
    if (c.id === ID_SELECAO) {
      return (
        <label className="flex h-full w-full cursor-pointer items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" aria-label="Selecionar linha" checked={p.marcada} onChange={() => p.onAlternar(i)} />
        </label>
      );
    }
    const j = Number(c.id);
    const col = dados.colunas[j];
    const v = dados.linhas[i][j];
    return (
      <div className={`min-w-0 flex-1 truncate px-2 ${alinhamento(col.tipo)}`} title={v === null ? "NULL" : v}>
        <Celula valor={v} tipo={col.tipo} />
      </div>
    );
  };

  const centro: React.ReactNode[] = [];
  for (let k = p.colInicio; k <= p.colFim; k++) {
    const c = p.centro[k];
    if (!c) continue;
    centro.push(
      <div key={c.id} role="gridcell" style={{ width: c.getSize() }} className={classe(c)}>
        {conteudo(c)}
      </div>,
    );
  }

  return (
    <div
      role="row"
      aria-selected={p.marcada}
      onClick={() => p.onAbrir(i)}
      className="group absolute top-0 left-0 flex cursor-pointer"
      style={{ height: ALTURA_LINHA, width: p.larguraTotal, transform: `translateY(${p.topo}px)` }}
    >
      {p.esquerda.map((c, k) => (
        <div
          key={c.id}
          role="gridcell"
          style={{ width: c.getSize(), left: p.offsets.get(c.id) }}
          className={`sticky z-10 ${classe(c)} ${k === p.esquerda.length - 1 ? sombraFixa : ""}`}
        >
          {conteudo(c)}
        </div>
      ))}
      <div style={{ width: p.espacoEsquerda }} className="shrink-0" />
      {centro}
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
      className="w-full min-w-0 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs font-normal outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
    />
  );
}
