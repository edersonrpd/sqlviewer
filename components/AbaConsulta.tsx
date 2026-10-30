"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { colunasExibidas, type Aba, type Acao } from "@/lib/estado";
import { colunasPorNome, filtrarOrdenar } from "@/lib/filtragem";
import { BotaoCopiarChamado, BotoesExportar } from "./Saidas";
import { FichaRegistro } from "./FichaRegistro";
import { Graficos } from "./Graficos";
import { IconeBusca, IconeColunas, IconeX } from "./Icones";
import { ResumoConsulta } from "./ResumoConsulta";
import { SeletorColunas } from "./SeletorColunas";
import { TabelaVirtual } from "./TabelaVirtual";
import { TelaRegistro } from "./TelaRegistro";
import { useDebounce } from "./util";

export function AbaConsulta({ aba, abas, dispatch }: { aba: Aba; abas: Aba[]; dispatch: React.Dispatch<Acao> }) {
  const { dados } = aba;
  const atualizar = useCallback((patch: Partial<Aba>) => dispatch({ tipo: "atualizar", id: aba.id, patch }), [dispatch, aba.id]);
  const [seletorAberto, setSeletorAberto] = useState(false);

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

  return (
    <div className="flex h-full flex-col">
      <ResumoConsulta aba={aba} onTrocarPerfil={(perfilId) => dispatch({ tipo: "trocarPerfil", id: aba.id, perfilId })} />

      <div className="vidro relative z-10 flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-white/10">
        <div className="inline-flex rounded-xl border border-zinc-300 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5" role="tablist">
          {(["tela", "tabela", "graficos"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={aba.visao === v}
              onClick={() => atualizar({ visao: v })}
              className={`rounded-lg px-4 py-1 text-sm font-semibold transition duration-300 ${
                aba.visao === v
                  ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-[0_4px_18px_-4px_rgb(99_102_241/0.9)]"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
              }`}
            >
              {v === "tela" ? "Tela" : v === "tabela" ? "Tabela" : "Gráficos"}
            </button>
          ))}
        </div>

        <label className="relative">
          <span className="sr-only">Buscar em todas as colunas visíveis</span>
          <IconeBusca className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nas colunas visíveis"
            className="campo w-64 pl-8"
          />
        </label>

        <span className="text-sm text-zinc-600 tabular-nums dark:text-zinc-400" aria-live="polite">
          <strong className="text-zinc-900 dark:text-zinc-100">{indices.length.toLocaleString("pt-BR")}</strong> de{" "}
          {dados.linhas.length.toLocaleString("pt-BR")} linhas
        </span>

        {aba.selecionadas.size > 0 && (
          <span className="inline-flex animate-surgir items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-200">
            {aba.selecionadas.size} selecionada(s)
            {selecionadasVisiveis.length !== aba.selecionadas.size && ` (${selecionadasVisiveis.length} no filtro)`}
            <button className="ml-0.5 hover:text-blue-900" title="Limpar seleção" onClick={() => atualizar({ selecionadas: new Set() })}>
              <IconeX className="h-3 w-3" />
            </button>
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="btn" onClick={() => setSeletorAberto(true)}>
            <IconeColunas /> Colunas
            <span className="text-xs text-zinc-500 tabular-nums">
              {visiveisCount} de {dados.colunas.length}
            </span>
          </button>
          <BotoesExportar dados={dados} linhas={indices} colunas={exibidas} nomeBase={aba.nome} />
          <BotaoCopiarChamado
            dados={dados}
            linhas={selecionadasVisiveis}
            colunas={exibidas}
            rotulo="Copiar para chamado"
            semLinhas="Marque as linhas na tabela para copiar"
          />
        </div>
      </div>

      {temFiltros && (
        <div className="vidro relative z-10 flex flex-wrap items-center gap-1.5 border-b border-zinc-200 px-3 py-1.5 text-xs dark:border-white/10">
          <span className="text-zinc-500">Filtros:</span>
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
        <div className="vidro relative z-10 flex flex-wrap items-center gap-1.5 border-b border-zinc-200 px-3 py-1.5 text-xs dark:border-white/10">
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
      className={`inline-flex max-w-96 animate-surgir items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono ${
        destaque
          ? "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-200"
          : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
      }`}
    >
      <span className="truncate">{children}</span>
      <button onClick={onRemover} aria-label="Remover filtro" className="opacity-60 hover:opacity-100">
        <IconeX className="h-3 w-3" />
      </button>
    </span>
  );
}
