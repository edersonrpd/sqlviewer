"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { colunasExibidas, type Aba, type Acao } from "@/lib/estado";
import { colunasPorNome, filtrarOrdenar } from "@/lib/filtragem";
import { ComparacaoRegistros } from "./ComparacaoRegistros";
import { BotaoCopiarChamado, BotoesExportar } from "./Saidas";
import { FichaRegistro } from "./FichaRegistro";
import { Graficos } from "./Graficos";
import { IconeBusca, IconeColunas, IconeComparar, IconeX } from "./Icones";
import { ResumoConsulta } from "./ResumoConsulta";
import { SeletorColunas } from "./SeletorColunas";
import { TabelaVirtual } from "./TabelaVirtual";
import { TelaRegistro } from "./TelaRegistro";
import { useDebounce } from "./util";

export function AbaConsulta({ aba, abas, dispatch }: { aba: Aba; abas: Aba[]; dispatch: React.Dispatch<Acao> }) {
  const { dados } = aba;
  const atualizar = useCallback((patch: Partial<Aba>) => dispatch({ tipo: "atualizar", id: aba.id, patch }), [dispatch, aba.id]);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [comparando, setComparando] = useState<[number, number] | null>(null);

  // busca global com debounce (pode varrer 200 colunas × 10.000 linhas)
  const [busca, setBusca] = useState(aba.busca);
  const buscaAtrasada = useDebounce(busca, 250);
  const buscaAtual = useRef(aba.busca);
  buscaAtual.current = aba.busca;
  useEffect(() => {
    // só reage à digitação; limpar pelo chip atualiza o estado diretamente
    if (buscaAtrasada !== buscaAtual.current) atualizar({ busca: buscaAtrasada });
  }, [buscaAtrasada, atualizar]);

  const exibidas = useMemo(() => colunasExibidas(aba), [aba.ordem, aba.visiveis, aba.fixas]); // eslint-disable-line react-hooks/exhaustive-deps
  const qtdFixas = useMemo(() => aba.fixas.filter((j) => aba.visiveis[j]).length, [aba.fixas, aba.visiveis]);
  const indices = useMemo(
    () =>
      filtrarOrdenar(dados, {
        busca: aba.busca,
        filtros: aba.filtros,
        relacoes: aba.relacoes,
        ordenacao: aba.ordenacao,
        visiveis: exibidas,
      }),
    [dados, aba.busca, aba.filtros, aba.relacoes, aba.ordenacao, exibidas],
  );

  // linhas selecionadas que passam pelos filtros, na ordem atual
  const selecionadasVisiveis = useMemo(
    () => (aba.selecionadas.size ? indices.filter((i) => aba.selecionadas.has(i)) : []),
    [indices, aba.selecionadas],
  );

  // a busca também acha colunas pelo nome: um clique mostra a coluna logo após as fixas
  const colunasAchadas = useMemo(() => colunasPorNome(dados, aba.busca), [dados, aba.busca]);
  const irParaColuna = (j: number) => {
    const visiveis = [...aba.visiveis];
    visiveis[j] = true;
    setBusca("");
    atualizar({ busca: "", visiveis, ordem: [j, ...aba.ordem.filter((x) => x !== j)], visao: aba.visao === "graficos" ? "tabela" : aba.visao });
  };

  const filtrosColuna = Object.entries(aba.filtros).filter(([, t]) => t.trim());
  const temFiltros = aba.busca.trim() !== "" || filtrosColuna.length > 0 || aba.relacoes.length > 0;
  const limparFiltros = () => {
    setBusca("");
    atualizar({ busca: "", filtros: {}, relacoes: [] });
  };

  const visiveisCount = aba.visiveis.filter(Boolean).length;

  // "/" leva à busca (como no design), exceto quando já se está digitando em algum campo
  const campoBusca = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))) return;
      e.preventDefault();
      campoBusca.current?.focus();
      campoBusca.current?.select();
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <ResumoConsulta aba={aba} onTrocarPerfil={(perfilId) => dispatch({ tipo: "trocarPerfil", id: aba.id, perfilId })} />

      <div className="relative z-10 flex flex-wrap items-center gap-2.5 px-3 py-3 sm:px-5 [@media(max-height:760px)]:py-2">
        <SeletorVisao visao={aba.visao} onTrocar={(visao) => atualizar({ visao })} />

        <label className="flex h-10 w-72 max-w-full items-center gap-2 rounded-xl border border-zinc-900/[0.12] bg-white px-3 transition duration-200 focus-within:border-blue-500 focus-within:shadow-[0_0_0_4px_rgb(99_102_241/0.18),0_0_24px_-4px_rgb(99_102_241/0.45)] dark:border-white/[0.12] dark:bg-[#0a0c14]/70 dark:focus-within:border-blue-400/70">
          <span className="sr-only">Buscar em todas as colunas visíveis</span>
          <IconeBusca className="h-4 w-4 shrink-0 text-zinc-500 dark:text-[#8b92a5]" />
          <input
            ref={campoBusca}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nas colunas visíveis"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />
          {busca ? (
            <button className="btn-icone h-5 w-5" aria-label="Limpar busca" onClick={() => setBusca("")}>
              <IconeX className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="tecla" title="Atalho: /">
              /
            </kbd>
          )}
        </label>

        <span className="text-[13px] text-zinc-600 tabular-nums dark:text-zinc-400" aria-live="polite">
          <strong className="font-mono text-zinc-900 dark:text-zinc-100">{indices.length.toLocaleString("pt-BR")}</strong> de{" "}
          {dados.linhas.length.toLocaleString("pt-BR")} linhas
        </span>

        {aba.selecionadas.size > 0 && (
          <span className="inline-flex h-7 animate-surgir items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 pr-1.5 pl-3 text-xs font-medium text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/[0.18] dark:text-blue-200">
            {aba.selecionadas.size} selecionada(s)
            {selecionadasVisiveis.length !== aba.selecionadas.size && ` (${selecionadasVisiveis.length} no filtro)`}
            <button
              className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 transition hover:bg-blue-200 dark:bg-white/[0.08] dark:hover:bg-white/15"
              title="Limpar seleção"
              aria-label="Limpar seleção"
              onClick={() => atualizar({ selecionadas: new Set() })}
            >
              <IconeX className="h-2.5 w-2.5" />
            </button>
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2 [&_.btn]:h-10 [&_.btn]:rounded-[10px] [&_.btn]:px-3.5 [&_.btn-destaque]:h-10 [&_.btn-destaque]:rounded-[10px] [&_.btn-destaque]:px-4">
          <button
            className="btn"
            disabled={selecionadasVisiveis.length !== 2}
            style={{ opacity: selecionadasVisiveis.length === 2 ? undefined : 0.5 }}
            title={selecionadasVisiveis.length === 2 ? "Ver as colunas que diferem entre as 2 linhas marcadas" : "Marque 2 linhas na tabela para comparar"}
            onClick={() => setComparando([selecionadasVisiveis[0], selecionadasVisiveis[1]])}
          >
            <IconeComparar /> Comparar
          </button>
          <button className="btn" onClick={() => setSeletorAberto(true)}>
            <IconeColunas /> Colunas
            <span className="text-xs text-zinc-500 tabular-nums">
              {visiveisCount} de {dados.colunas.length}
            </span>
          </button>
          <BotoesExportar dados={dados} linhas={indices} colunas={exibidas} nomeBase={aba.nome} />
          <BotaoCopiarChamado
            destaque
            dados={dados}
            linhas={selecionadasVisiveis}
            colunas={exibidas}
            rotulo="Copiar para chamado"
            semLinhas="Marque as linhas na tabela para copiar"
          />
        </div>
      </div>

      {temFiltros && (
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 px-3 pb-3 text-xs sm:px-5">
          <span className="text-zinc-500 dark:text-[#8b92a5]">Filtros</span>
          {aba.relacoes.map((r, k) => (
            <Chip
              key={`r${k}`}
              destaque
              titulo={r.rotulo}
              onRemover={() => atualizar({ relacoes: aba.relacoes.filter((_, x) => x !== k) })}
            >
              {dados.colunas[r.coluna].nome} = {r.valor}
            </Chip>
          ))}
          {filtrosColuna.map(([j, t]) => (
            <Chip
              key={`f${j}`}
              onRemover={() => {
                const filtros = { ...aba.filtros };
                delete filtros[Number(j)];
                atualizar({ filtros });
              }}
            >
              {dados.colunas[Number(j)].nome} contém “{t}”
            </Chip>
          ))}
          {aba.busca.trim() && (
            <Chip
              onRemover={() => {
                setBusca("");
                atualizar({ busca: "" });
              }}
            >
              busca: “{aba.busca}”
            </Chip>
          )}
          <button className="ml-1 text-blue-600 hover:underline dark:text-blue-400" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>
      )}

      {colunasAchadas.length > 0 && (
        <div className="relative z-10 flex flex-wrap items-center gap-1.5 px-3 pb-3 text-xs sm:px-5">
          <span className="text-zinc-500">Colunas com “{aba.busca.trim()}” no nome:</span>
          {colunasAchadas.map((j) => (
            <button
              key={j}
              className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 font-mono text-blue-700 hover:bg-blue-100 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-200"
              title="Mostrar a coluna no início da tabela e limpar a busca"
              onClick={() => irParaColuna(j)}
            >
              {dados.colunas[j].nome}
            </button>
          ))}
          <span className="text-zinc-400">a busca procura nos valores; clique para ir até a coluna</span>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {aba.visao === "tela" ? (
          <TelaRegistro aba={aba} abas={abas} indices={indices} atualizar={atualizar} dispatch={dispatch} />
        ) : aba.visao === "tabela" ? (
          exibidas.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              Nenhuma coluna visível.{" "}
              <button className="text-blue-600 hover:underline" onClick={() => setSeletorAberto(true)}>
                Escolher colunas
              </button>
            </div>
          ) : (
            <TabelaVirtual
              aba={aba}
              colunas={exibidas}
              qtdFixas={qtdFixas}
              indices={indices}
              atualizar={atualizar}
            />
          )
        ) : (
          <Graficos aba={aba} indices={indices} atualizar={atualizar} />
        )}
      </div>

      {comparando && <ComparacaoRegistros aba={aba} a={comparando[0]} b={comparando[1]} onFechar={() => setComparando(null)} />}

      {seletorAberto && <SeletorColunas aba={aba} atualizar={atualizar} onFechar={() => setSeletorAberto(false)} />}

      {aba.registro !== null && (
        <FichaRegistro
          aba={aba}
          abas={abas}
          indices={indices}
          colunasExibidas={exibidas}
          onNavegar={(registro) => atualizar({ registro })}
          onFechar={() => atualizar({ registro: null })}
          onAbrirTela={() => atualizar({ visao: "tela", registroTela: aba.registro, registro: null })}
          onAbrirRelacao={(destino, coluna, valor, rotulo) => dispatch({ tipo: "abrirRelacao", destino, coluna, valor, rotulo })}
        />
      )}
    </div>
  );
}

function Chip({
  children,
  onRemover,
  destaque,
  titulo,
}: {
  children: React.ReactNode;
  onRemover: () => void;
  destaque?: boolean;
  titulo?: string;
}) {
  return (
    <span
      title={titulo}
      className={`inline-flex max-w-96 animate-surgir items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-2.5 font-mono ${
        destaque
          ? "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-400/[0.35] dark:bg-violet-400/[0.14] dark:text-violet-200"
          : "border-zinc-200 bg-white text-zinc-700 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-zinc-300"
      }`}
    >
      <span className="truncate">{children}</span>
      <button
        onClick={onRemover}
        aria-label="Remover filtro"
        className="grid h-[18px] w-[18px] place-items-center rounded-full opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
      >
        <IconeX className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

const VISOES = [
  { id: "tela", rotulo: "Tela" },
  { id: "tabela", rotulo: "Tabela" },
  { id: "graficos", rotulo: "Gráficos" },
] as const;

/** Tela / Tabela / Gráficos com um indicador que desliza (com leve "mola") até a visão escolhida. */
function SeletorVisao({ visao, onTrocar }: { visao: Aba["visao"]; onTrocar: (v: Aba["visao"]) => void }) {
  const pos = Math.max(0, VISOES.findIndex((v) => v.id === visao));
  return (
    <div
      role="tablist"
      aria-label="Visão"
      className="relative grid grid-cols-[repeat(3,96px)] rounded-xl border border-zinc-900/10 bg-white/70 p-1 dark:border-white/10 dark:bg-white/[0.03]"
    >
      <span
        aria-hidden
        className="absolute top-1 left-1 h-[calc(100%-8px)] w-24 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-[0_4px_18px_-4px_rgb(99_102_241/0.9)] transition-transform duration-[350ms] ease-[cubic-bezier(.3,1.4,.5,1)]"
        style={{ transform: `translateX(${pos * 96}px)` }}
      />
      {VISOES.map((v) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={visao === v.id}
          onClick={() => onTrocar(v.id)}
          className={`relative h-[34px] text-[13px] font-semibold transition-colors duration-200 ${
            visao === v.id ? "text-white" : "text-zinc-600 hover:text-zinc-900 dark:text-[#9aa1b2] dark:hover:text-zinc-100"
          }`}
        >
          {v.rotulo}
        </button>
      ))}
    </div>
  );
}
