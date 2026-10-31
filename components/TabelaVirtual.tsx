"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef, type Column } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { colunaDestaque } from "@/lib/destaque";
import type { Aba } from "@/lib/estado";
import { alternarOrdenacao } from "@/lib/filtragem";
import { formatarValor, NOMES_TIPOS } from "@/lib/formatacao";
import { buscarPerfil } from "@/lib/perfis";
import { retangulo, type Celula as PosCelula, type Selecao } from "@/lib/selecao";
import type { TipoColuna } from "@/lib/tipos";
import { alinhamento, Celula } from "./Celula";
import { FiltroValores } from "./FiltroValores";
import { IconeDireita, IconeFunil } from "./Icones";
import { SeloMarketplace } from "./SeloMarketplace";
import { useDebounce } from "./util";

const ALTURA_LINHA = 40;
const ALTURA_CABECALHO = 62;
const ID_SELECAO = "__selecao";
const LARGURA_MIN = 56;
const LARGURA_MAX = 900;
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
// célula selecionada e célula ativa (foco do teclado), por cima do fundo e do hover da linha
const FUNDO_SELECIONADA = "bg-[#dfe3ff]! dark:bg-[#262b55]!";
const ANEL_ATIVA = "shadow-[inset_0_0_0_2px_var(--color-blue-500)]! dark:shadow-[inset_0_0_0_2px_var(--color-blue-400)]!";

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
  /** seleção de células (posições em `indices` × `colunas`) */
  selecao: Selecao | null;
  onSelecao: (s: Selecao | null) => void;
  /** Ctrl+C com células selecionadas */
  onCopiar: () => void;
};

/**
 * Tabela com virtualização de linhas e colunas. O TanStack Table cuida do
 * modelo de colunas (fixação e larguras); filtro e ordenação já chegam
 * aplicados em `indices`.
 *
 * Como num cliente SQL: clique seleciona a célula, Shift+clique ou arrastar
 * seleciona um intervalo, setas navegam, Ctrl+C copia, Enter ou duplo clique
 * abre a ficha do registro. Nada é editável.
 */
export function TabelaVirtual({ aba, colunas, qtdFixas, indices, atualizar, selecao, onSelecao, onCopiar }: Props) {
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

  // coluna de nº da linha + caixa de marcar: cresce com a quantidade de dígitos
  const larguraSelecao = 40 + String(Math.max(1, indices.length)).length * 8;
  const definicoes = useMemo<ColumnDef<number>[]>(
    () => [
      { id: ID_SELECAO, size: larguraSelecao },
      ...colunas.map((j): ColumnDef<number> => ({ id: String(j), size: larguras[j], minSize: LARGURA_MIN, maxSize: LARGURA_MAX })),
    ],
    [colunas, larguras, larguraSelecao],
  );
  const fixasIds = useMemo(() => [ID_SELECAO, ...colunas.slice(0, qtdFixas).map(String)], [colunas, qtdFixas]);
  // posição de cada coluna entre as exibidas (coordenada "c" da seleção)
  const posColuna = useMemo(() => new Map(colunas.map((j, k) => [String(j), k])), [colunas]);

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
  // larguras mudam quando colunas são mostradas/ocultadas/fixadas/redimensionadas
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

  // volta ao topo quando o conjunto de linhas muda (filtro/ordenação)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [aba.busca, aba.filtros, aba.filtrosValores, aba.relacoes, ordenacao]);

  // ---------- seleção de células ----------
  const selecaoRef = useRef(selecao);
  selecaoRef.current = selecao;
  const arrastando = useRef(false);
  useEffect(() => {
    const soltar = () => (arrastando.current = false);
    window.addEventListener("mouseup", soltar);
    return () => window.removeEventListener("mouseup", soltar);
  }, []);
  const ultimaColuna = colunas.length - 1;

  const pressionar = useCallback(
    (cel: PosCelula, shift: boolean) => {
      const s = selecaoRef.current;
      onSelecao(shift && s ? { ancora: s.ancora, foco: cel } : { ancora: cel, foco: cel });
      arrastando.current = true;
      scrollRef.current?.focus({ preventScroll: true });
    },
    [onSelecao],
  );
  const arrastar = useCallback(
    (cel: PosCelula) => {
      const s = selecaoRef.current;
      if (arrastando.current && s && (s.foco.r !== cel.r || s.foco.c !== cel.c)) onSelecao({ ancora: s.ancora, foco: cel });
    },
    [onSelecao],
  );
  // clique no nº da linha: seleciona a linha inteira
  const pressionarLinha = useCallback(
    (r: number, shift: boolean) => {
      const s = selecaoRef.current;
      const ancora = shift && s ? { r: s.ancora.r, c: 0 } : { r, c: 0 };
      onSelecao({ ancora, foco: { r, c: ultimaColuna } });
      scrollRef.current?.focus({ preventScroll: true });
    },
    [onSelecao, ultimaColuna],
  );

  const mostrarCelula = (cel: PosCelula) => {
    linhasVirt.scrollToIndex(cel.r, { align: "auto" });
    if (cel.c >= qtdFixas) colunasVirt.scrollToIndex(cel.c - qtdFixas, { align: "auto" });
  };

  const teclado = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const ctrl = e.ctrlKey || e.metaKey;
    const total = indices.length;
    if (total === 0 || colunas.length === 0) return;
    if (ctrl && e.key.toLowerCase() === "a") {
      e.preventDefault();
      onSelecao({ ancora: { r: 0, c: 0 }, foco: { r: total - 1, c: ultimaColuna } });
      return;
    }
    if (ctrl && e.key.toLowerCase() === "c") {
      if (selecao) {
        e.preventDefault();
        onCopiar();
      }
      return;
    }
    if (e.key === "Escape") {
      if (selecao) onSelecao(null);
      return;
    }
    const foco = selecao?.foco ?? { r: 0, c: 0 };
    if (e.key === "Enter") {
      e.preventDefault();
      abrirRegistro(indices[foco.r]);
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      alternarLinha(indices[foco.r]);
      return;
    }
    const pagina = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 400) / ALTURA_LINHA) - 2);
    const mov: Record<string, () => PosCelula> = {
      ArrowUp: () => ({ r: ctrl ? 0 : foco.r - 1, c: foco.c }),
      ArrowDown: () => ({ r: ctrl ? total - 1 : foco.r + 1, c: foco.c }),
      ArrowLeft: () => ({ r: foco.r, c: ctrl ? 0 : foco.c - 1 }),
      ArrowRight: () => ({ r: foco.r, c: ctrl ? ultimaColuna : foco.c + 1 }),
      PageUp: () => ({ r: foco.r - pagina, c: foco.c }),
      PageDown: () => ({ r: foco.r + pagina, c: foco.c }),
      Home: () => ({ r: ctrl ? 0 : foco.r, c: 0 }),
      End: () => ({ r: ctrl ? total - 1 : foco.r, c: ultimaColuna }),
    };
    const f = mov[e.key];
    if (!f) return;
    e.preventDefault();
    const p = f();
    const novo = { r: Math.min(Math.max(0, p.r), total - 1), c: Math.min(Math.max(0, p.c), ultimaColuna) };
    onSelecao(e.shiftKey && selecao ? { ancora: selecao.ancora, foco: novo } : { ancora: novo, foco: novo });
    mostrarCelula(novo);
  };

  const ret = selecao ? retangulo(selecao) : null;

  // ---------- redimensionar colunas ----------
  const redimensionar = (j: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const inicioX = e.clientX;
    const inicio = larguras[j];
    let quadro = 0;
    const mover = (ev: PointerEvent) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const novas = [...larguras];
        novas[j] = Math.round(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, inicio + ev.clientX - inicioX)));
        atualizar({ larguras: novas });
      });
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  // duplo clique na borda: ajusta a largura ao conteúdo (amostra das linhas filtradas)
  const ajustarLargura = (j: number) => {
    const col = dados.colunas[j];
    let max = col.nome.length + 4;
    for (const i of indices.slice(0, 2000)) {
      const v = dados.linhas[i][j];
      const len = v === null ? 4 : formatarValor(v, col.tipo).length;
      if (len > max) max = len;
    }
    const extra = String(j) === idDestaque ? 100 : 0;
    const novas = [...larguras];
    novas[j] = Math.round(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, max * 7.9 + 30 + extra)));
    atualizar({ larguras: novas });
  };

  // ---------- filtro por valores ----------
  const [menuValores, setMenuValores] = useState<{ j: number; ancora: DOMRect } | null>(null);

  const estiloFixa = (c: Column<number>): React.CSSProperties => ({ width: c.getSize(), left: offsets.get(c.id) });

  const cabecalho = (c: Column<number>) => {
    if (c.id === ID_SELECAO) {
      return (
        <div className="flex h-full items-center justify-end gap-2 pr-3">
          <span className="font-mono text-[10px] text-zinc-400" title="Nº da linha na ordem exibida">
            #
          </span>
          <input
            type="checkbox"
            aria-label="Marcar todas as linhas filtradas"
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
    const pos = ordenacao.findIndex((o) => o.coluna === j);
    const criterio = pos >= 0 ? ordenacao[pos] : null;
    const sentido = criterio ? (criterio.desc ? "↓" : "↑") : "";
    const filtroValores = aba.filtrosValores[j];
    return (
      <div className="flex h-full flex-col justify-center gap-1.5 px-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            className={`flex min-w-0 flex-1 items-center gap-1 text-left font-mono text-[11px] font-semibold tracking-[0.04em] transition-colors ${
              criterio
                ? "text-blue-700 dark:text-blue-300"
                : c.id === idDestaque
                  ? ""
                  : "text-zinc-500 hover:text-zinc-800 dark:text-[#8b92a5] dark:hover:text-zinc-200"
            }`}
            title={`${col.nome} · ${NOMES_TIPOS[col.tipo]}\nClique para ordenar · Shift+clique ordena também por esta coluna`}
            onClick={(e) => atualizar({ ordenacao: alternarOrdenacao(ordenacao, j, e.shiftKey) })}
          >
            <span className="truncate">{col.nome}</span>
            {sentido && (
              <span key={sentido} className="inline-flex shrink-0 animate-surgir items-center text-xs">
                {sentido}
                {ordenacao.length > 1 && <sup className="ml-px text-[9px]">{pos + 1}</sup>}
              </span>
            )}
          </button>
          <button
            className={`grid h-5 w-5 shrink-0 place-items-center rounded transition ${
              filtroValores
                ? "bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-200"
                : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            }`}
            title={filtroValores ? `Filtrando por ${filtroValores.length} valor(es)` : "Filtrar por valores"}
            aria-label={`Filtrar ${col.nome} por valores`}
            aria-haspopup="dialog"
            onClick={(e) => setMenuValores({ j, ancora: e.currentTarget.getBoundingClientRect() })}
          >
            <IconeFunil className="h-3 w-3" />
          </button>
        </div>
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
        <span
          role="separator"
          aria-orientation="vertical"
          title="Arraste para redimensionar · duplo clique ajusta ao conteúdo"
          onPointerDown={(e) => redimensionar(j, e)}
          onDoubleClick={() => ajustarLargura(j)}
          className="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize after:absolute after:inset-y-3 after:left-1/2 after:w-px after:bg-zinc-900/10 after:transition hover:after:w-0.5 hover:after:bg-blue-500 dark:after:bg-white/10"
        />
      </div>
    );
  };

  const colInicio = itensColuna[0]?.index ?? 0;
  const colFim = itensColuna.length ? itensColuna[itensColuna.length - 1].index : -1;

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      onKeyDown={teclado}
      className="absolute inset-0 overflow-auto text-[13px] outline-none select-none"
      role="grid"
      aria-label="Resultado da consulta"
      aria-multiselectable
      aria-rowcount={indices.length + 1}
    >
      <div style={{ width: larguraTotal, minWidth: "100%" }}>
        {/* cabeçalho fixo */}
        <div className="sticky top-0 z-20 flex bg-[#f8f9fc] dark:bg-[#13151d]" style={{ height: ALTURA_CABECALHO, width: larguraTotal }} role="row">
          {esquerda.map((c, k) => (
            <div
              key={c.id}
              role="columnheader"
              style={estiloFixa(c)}
              className={`sticky z-30 shrink-0 ${fundoCabecalho(c.id)} ${bordaCabecalho} ${k === esquerda.length - 1 ? sombraFixa : ""}`}
            >
              {cabecalho(c)}
            </div>
          ))}
          <div style={{ width: espacoEsquerda }} className="shrink-0" />
          {itensColuna.map((vc) => {
            const c = centro[vc.index];
            return (
              <div key={c.id} role="columnheader" style={{ width: c.getSize() }} className={`relative shrink-0 ${fundoCabecalho(c.id)} ${bordaCabecalho}`}>
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
            const r = vr.index;
            const dentro = ret && r >= ret.r0 && r <= ret.r1;
            return (
              <LinhaTabela
                key={`${geracao.id}-${i}`}
                i={i}
                r={r}
                topo={vr.start - ALTURA_CABECALHO}
                atraso={r < LINHAS_ANIMADAS && Date.now() < geracao.ate ? r * 0.04 : null}
                marcada={selecionadas.has(i)}
                aberta={registro === i}
                selC0={dentro ? ret.c0 : -1}
                selC1={dentro ? ret.c1 : -1}
                ativa={selecao && selecao.foco.r === r ? selecao.foco.c : -1}
                dados={dados}
                esquerda={esquerda}
                offsets={offsets}
                centro={centro}
                posColuna={posColuna}
                colInicio={colInicio}
                colFim={colFim}
                espacoEsquerda={espacoEsquerda}
                larguraTotal={larguraTotal}
                onAlternar={alternarLinha}
                onAbrir={abrirRegistro}
                onPressionar={pressionar}
                onArrastar={arrastar}
                onPressionarLinha={pressionarLinha}
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

      {menuValores && (
        <FiltroValores
          dados={dados}
          coluna={menuValores.j}
          ancora={menuValores.ancora}
          aceitos={aba.filtrosValores[menuValores.j] ?? null}
          onAplicar={(aceitos) => {
            const filtrosValores = { ...aba.filtrosValores };
            if (aceitos) filtrosValores[menuValores.j] = aceitos;
            else delete filtrosValores[menuValores.j];
            atualizar({ filtrosValores });
            setMenuValores(null);
          }}
          onFechar={() => setMenuValores(null)}
        />
      )}
    </div>
  );
}

type PropsLinha = {
  i: number;
  /** posição da linha na ordem exibida */
  r: number;
  topo: number;
  /** atraso (s) da animação de entrada; null = sem animação */
  atraso: number | null;
  marcada: boolean;
  aberta: boolean;
  /** colunas selecionadas nesta linha (-1 = nenhuma) */
  selC0: number;
  selC1: number;
  /** coluna da célula ativa nesta linha (-1 = nenhuma) */
  ativa: number;
  dados: Aba["dados"];
  esquerda: Column<number>[];
  offsets: Map<string, number>;
  centro: Column<number>[];
  posColuna: Map<string, number>;
  colInicio: number;
  colFim: number;
  espacoEsquerda: number;
  larguraTotal: number;
  onAlternar: (i: number) => void;
  onAbrir: (i: number) => void;
  onPressionar: (cel: PosCelula, shift: boolean) => void;
  onArrastar: (cel: PosCelula) => void;
  onPressionarLinha: (r: number, shift: boolean) => void;
  idDestaque: string | null;
};

const LinhaTabela = memo(function LinhaTabela(p: PropsLinha) {
  const { i, r, dados } = p;
  // fundos opacos (as colunas fixas cobrem as demais ao rolar), equivalentes ao índigo translúcido do design
  const fundo = p.aberta
    ? "bg-[#e6e9ff] dark:bg-[#1c1f3d]"
    : p.marcada
      ? "bg-[#f1f2ff] dark:bg-[#15172c]"
      : "bg-white dark:bg-[#0c0e16]";
  const classe = `flex shrink-0 items-center text-zinc-700 transition-colors duration-150 ${fundo} group-hover:bg-[#eef0ff] dark:text-zinc-300 dark:group-hover:bg-[#191c33] ${bordaCelula}`;
  const classeCelula = (c: Column<number>) => {
    const k = p.posColuna.get(c.id);
    // a coluna de nº/caixa de marcar não faz parte da seleção
    if (k === undefined) return classe;
    const sel = p.selC0 >= 0 && k >= p.selC0 && k <= p.selC1;
    return `${classe} ${sel ? FUNDO_SELECIONADA : ""} ${k === p.ativa ? ANEL_ATIVA : ""}`;
  };
  const eventos = (c: Column<number>) => {
    const k = p.posColuna.get(c.id);
    if (k === undefined) return {};
    return {
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        p.onPressionar({ r, c: k }, e.shiftKey);
      },
      onMouseEnter: () => p.onArrastar({ r, c: k }),
      onDoubleClick: () => p.onAbrir(i),
    };
  };

  // primeira coluna de dados (identificador) em cor mais forte
  const k0 = (c: Column<number>) => c.id === p.esquerda[1]?.id;
  const conteudo = (c: Column<number>) => {
    if (c.id === ID_SELECAO) {
      return (
        <div className="flex h-full w-full items-center justify-end gap-2 pr-3">
          <span
            className="cursor-e-resize font-mono text-[11px] text-zinc-400 tabular-nums hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-300"
            title="Selecionar a linha inteira"
            onMouseDown={(e) => {
              e.preventDefault();
              p.onPressionarLinha(r, e.shiftKey);
            }}
          >
            {r + 1}
          </span>
          <input type="checkbox" className="h-[15px] w-[15px]" aria-label="Marcar linha" checked={p.marcada} onChange={() => p.onAlternar(i)} />
        </div>
      );
    }
    const j = Number(c.id);
    const col = dados.colunas[j];
    const v = dados.linhas[i][j];
    if (c.id === p.idDestaque) {
      // coluna-chave (ex.: NUMPOK) como etiqueta ciano
      return (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate px-2" title={v === null ? "NULL" : v}>
          <SeloMarketplace valor={v} compacto />
          {v ? (
            <span className="truncate rounded-md bg-cyan-100 px-2 py-0.5 font-mono text-xs font-medium text-cyan-800 dark:bg-cyan-400/[0.12] dark:text-cyan-300">
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
      <div key={c.id} role="gridcell" style={{ width: c.getSize() }} className={classeCelula(c)} {...eventos(c)}>
        {conteudo(c)}
      </div>,
    );
  }

  return (
    <div
      role="row"
      aria-selected={p.marcada}
      className="group absolute top-0 left-0 flex min-w-full cursor-cell"
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
            className={`sticky z-10 ${classeCelula(c)} ${sombraLinha(k === 0 && (p.marcada || p.aberta), k === p.esquerda.length - 1)}`}
            {...eventos(c)}
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
            title="Abrir ficha (Enter ou duplo clique)"
            className="absolute top-1/2 right-2.5 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-lg border border-zinc-900/10 bg-white text-blue-700 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 dark:border-white/15 dark:bg-[#1a1d2e] dark:text-blue-200"
            onMouseDown={(e) => e.stopPropagation()}
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
      className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs font-normal transition outline-none select-text focus:border-blue-500 focus:shadow-[0_0_0_3px_rgb(99_102_241/0.2)] dark:border-white/10 dark:bg-zinc-950"
    />
  );
}
