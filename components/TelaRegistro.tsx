"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CorStatus } from "@/config/perfis";
import { colunaDestaque } from "@/lib/destaque";
import { diagnosticar, nivelGeral, temDiagnostico } from "@/lib/diagnostico";
import { colunasExibidas, type Aba, type Acao } from "@/lib/estado";
import { chavesDoSelect } from "@/lib/exportar";
import { formatarNumero } from "@/lib/formatacao";
import { buscarPerfil, linhasLigadas } from "@/lib/perfis";
import { resumoParaChamado } from "@/lib/resumoChamado";
import { sqlJoin } from "@/lib/join";
import {
  cadastrosPendentes,
  extrasLigacao,
  dadosComColunasLigadas,
  relacionadosDoRegistro,
  relacoesPendentes,
  type CadastroPendente,
  type RelacaoPendente,
  type Relacionado,
} from "@/lib/relacionados";
import {
  calcularSaldo,
  montarTela,
  resumoRegistro,
  sqlRelacionado,
  type CampoMontado,
  type EtapaMontada,
  type IndicadorMontado,
  type SecaoMontada,
} from "@/lib/tela";
import { alinhamento, Celula } from "./Celula";
import { IconeChamado, IconeCopiar, IconeDireita, IconeEsquerda, IconeLink, IconeMais, IconeSeta } from "./Icones";
import { CodigoSql, SqlEmLinha } from "./CodigoSql";
import { SeloMarketplace } from "./SeloMarketplace";
import { ESTILO_NIVEL, PainelDiagnostico } from "./PainelDiagnostico";
import { BotaoCopiarChamado } from "./Saidas";
import { copiarTexto, useAviso } from "./util";

type Props = {
  aba: Aba;
  abas: Aba[];
  indices: number[];
  atualizar: (p: Partial<Aba>) => void;
  dispatch: React.Dispatch<Acao>;
};

/** Visão "Tela": um registro por vez, como um formulário de ERP. */
export function TelaRegistro({ aba, abas, indices, atualizar, dispatch }: Props) {
  const { dados } = aba;
  const perfil = buscarPerfil(aba.perfilId);
  const [mostrarVazios, setMostrarVazios] = useState(false);
  const [mostrarNomes, setMostrarNomes] = useState(true);
  const rolagem = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useAviso();

  const posicao = aba.registroTela !== null ? indices.indexOf(aba.registroTela) : -1;
  const pos = posicao >= 0 ? posicao : 0;
  const registro = indices[pos];
  const anterior = pos > 0 ? indices[pos - 1] : null;
  const proximo = pos < indices.length - 1 ? indices[pos + 1] : null;
  const ir = (i: number | null) => i !== null && atualizar({ registroTela: i });

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

  // com as colunas das abas ligadas (ex.: medidas da DESSIT na Tela do item)
  const tela = useMemo(() => {
    if (registro === undefined) return null;
    const d = dadosComColunasLigadas(aba, registro, abas);
    return montarTela(d.dados, d.registro, perfil);
  }, [aba, abas, registro, perfil]);
  const diagnostico = useMemo(
    () => (registro === undefined || !temDiagnostico(aba.perfilId) ? null : diagnosticar(aba, registro, abas)),
    [aba, registro, abas],
  );
  const relacionados = useMemo(() => (registro === undefined ? [] : relacionadosDoRegistro(aba, registro, abas)), [aba, registro, abas]);
  const pendentes = useMemo(() => (registro === undefined ? [] : relacoesPendentes(aba, registro, abas)), [aba, registro, abas]);
  const cadastros = useMemo(() => (registro === undefined ? [] : cadastrosPendentes(aba, registro)), [aba, registro]);
  const join = useMemo(() => (registro === undefined ? null : sqlJoin(dados, registro, aba.perfilId)), [dados, registro, aba.perfilId]);
  const exibidas = useMemo(() => colunasExibidas(aba), [aba]);

  if (registro === undefined || !tela) {
    return <p className="p-8 text-center text-sm text-zinc-500">Nenhum registro corresponde aos filtros atuais.</p>;
  }

  const copiarValor = async (rotulo: string, raw: string | null) => {
    const ok = await copiarTexto(raw ?? "NULL");
    setAviso(ok ? `${rotulo} copiado` : "Não foi possível copiar");
  };

  const navSecoes = tela.secoes.map((s, k) => {
    const visiveis = mostrarVazios ? s.campos.length : s.campos.filter((c) => !c.vazio).length;
    return { id: `tela-s-${k}`, rotulo: s.titulo, contagem: visiveis, alerta: false };
  });
  // o primeiro registro ligado com dados (ex.: itens do pedido) vai para o topo; os demais, para "Registros ligados"
  const ligadosComId = relacionados.map((r, k) => ({ r, id: `tela-r-${k}` }));
  const principal = ligadosComId[0]?.r.quantidade ? ligadosComId[0] : null;
  const outrosLigados = principal ? ligadosComId.slice(1) : ligadosComId;
  const navLigados = relacionados.map((r, k) => ({
    id: `tela-r-${k}`,
    rotulo: r.rotulo,
    contagem: r.quantidade,
    alerta: r.quantidade === 0,
  }));
  const abrirLigado = (r: Relacionado) => (linha?: number) => {
    dispatch({ tipo: "abrirRelacao", destino: r.abaId, coluna: r.colunaDestino, valor: r.chave!, rotulo: r.rotulo, extras: r.extras.map((e) => ({ coluna: e.coluna, valor: e.chave })) });
    if (linha !== undefined) dispatch({ tipo: "atualizar", id: r.abaId, patch: { registroTela: linha } });
  };
  const copiarResumo = async () => {
    const texto = resumoParaChamado(
      tela,
      perfil,
      diagnostico,
      relacionados.map((r) => ({ rotulo: r.rotulo, aba: r.abaNome, quantidade: r.quantidade })),
    );
    setAviso((await copiarTexto(texto)) ? "Resumo para chamado copiado" : "Não foi possível copiar");
  };
  const navegacao = (
    <div className="flex items-center gap-1.5">
      <button className="btn px-2" disabled={anterior === null} onClick={() => ir(anterior)} title="Anterior (←)" aria-label="Registro anterior">
        <IconeEsquerda />
      </button>
      <span className="min-w-20 flex-1 text-center text-sm text-zinc-600 tabular-nums dark:text-zinc-400">
        {(pos + 1).toLocaleString("pt-BR")} de {indices.length.toLocaleString("pt-BR")}
      </span>
      <button className="btn px-2" disabled={proximo === null} onClick={() => ir(proximo)} title="Próximo (→)" aria-label="Próximo registro">
        <IconeDireita />
      </button>
    </div>
  );
  const listaLateral = indices.length > 1;

  return (
    <div className="absolute inset-0 flex">
      {listaLateral && (
        <ListaRegistros aba={aba} abas={abas} indices={indices} atual={registro} onEscolher={(i) => atualizar({ registroTela: i })} />
      )}

      <div ref={rolagem} className="min-w-0 flex-1 overflow-y-auto">
        <div
          className={`mx-auto grid max-w-[1600px] items-start gap-5 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_17rem] ${
            listaLateral ? "2xl:grid-cols-[11rem_minmax(0,1fr)_17rem]" : "xl:grid-cols-[11rem_minmax(0,1fr)_17rem]"
          }`}
        >
          {/* menu de seções */}
          <NavSecoes
            className={listaLateral ? "hidden 2xl:flex" : "hidden xl:flex"}
            rolagem={rolagem}
            topo={{ id: "tela-topo", rotulo: "Resumo", contagem: null, alerta: false }}
            secoes={navSecoes}
            ligados={navLigados}
            rotuloRegistro={perfil?.tela?.titulo}
          />

          <main className="min-w-0 space-y-4">
            {/* cabeçalho do documento */}
            <header id="tela-topo" data-secao className="painel scroll-mt-4 overflow-hidden">
              <div className="flex flex-wrap items-start gap-5 p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                    {perfil ? `${perfil.id} · ${perfil.nome}` : "Consulta"}
                  </p>
                  <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                    <span className="truncate font-mono">{tela.titulo}</span>
                    <button className="btn-icone" title="Copiar" aria-label="Copiar título" onClick={() => copiarValor("Título", tela.valorTitulo)}>
                      <IconeCopiar />
                    </button>
                  </h2>
                  {(tela.subtitulo.length > 0 || tela.status.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tela.subtitulo.map((c) => (
                        <span
                          key={`${c.j}-${c.nome}`}
                          title={c.nome}
                          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs dark:bg-white/5"
                        >
                          <span className="text-zinc-500">{c.rotulo}</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100">{c.texto ?? "NULL"}</span>
                        </span>
                      ))}
                      {tela.status.map((s) => (
                        <ChipStatus key={s.nome} cor={s.cor} titulo={s.nome}>
                          {s.rotulo}: <strong>{s.texto}</strong>
                        </ChipStatus>
                      ))}
                    </div>
                  )}
                </div>

                {tela.chave && <BlocoChave campo={tela.chave} onCopiar={copiarValor} />}

                {/* telas estreitas: sem a coluna de ações à direita */}
                <div className="flex w-full flex-wrap items-center gap-2 lg:hidden">
                  {navegacao}
                  <button className="btn" onClick={copiarResumo}>
                    <IconeChamado /> Resumo
                  </button>
                </div>
              </div>
              {tela.etapas.length > 0 && <LinhaEtapas etapas={tela.etapas} />}
              {tela.indicadores.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
                  {tela.indicadores.map((ind) => (
                    <Indicador key={ind.campo.j} indicador={ind} />
                  ))}
                </div>
              )}
            </header>

            {diagnostico && <PainelDiagnostico diagnostico={diagnostico} />}

            {/* valores principais */}
            {tela.destaques.length > 0 && (
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]">
                {tela.destaques.map((c) => (
                  <div key={`${c.j}-${c.nome}`} className="painel px-3.5 py-3" title={c.nome}>
                    <p className="text-xs text-zinc-500">{c.rotulo}</p>
                    <p className={`mt-0.5 text-lg font-semibold tabular-nums ${c.vazio ? "text-zinc-400" : ""}`}>
                      {c.texto ?? <span className="valor-null text-base">NULL</span>}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">{c.nome}</p>
                  </div>
                ))}
              </div>
            )}

            {/* primeiro registro ligado (ex.: itens do pedido) logo abaixo dos valores */}
            {principal && (
              <BlocoLigado id={principal.id} rel={principal.r} abas={abas} tabela onAbrir={abrirLigado(principal.r)} />
            )}

            {tela.secoes.map((s, k) => (
              <Secao
                key={s.titulo}
                id={`tela-s-${k}`}
                secao={s}
                mostrarVazios={mostrarVazios}
                mostrarNomes={mostrarNomes}
                inicialAberta={!s.recolhida && s.titulo !== "Outros campos"}
                onCopiar={copiarValor}
              />
            ))}

            {outrosLigados.length > 0 && (
              <section aria-label="Registros ligados" className="space-y-3 pt-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[15px] font-semibold">Registros ligados</h3>
                  <span className="text-xs text-zinc-500">{outrosLigados.length} tabela(s) · clique para abrir a aba</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {outrosLigados.map(({ r, id }) => (
                    <BlocoLigado key={`${r.abaId}-${r.colunaDestino}`} id={id} rel={r} abas={abas} onAbrir={abrirLigado(r)} />
                  ))}
                </div>
              </section>
            )}

            {/* telas estreitas: consultas pendentes no fim */}
            {(pendentes.length > 0 || cadastros.length > 0) && (
              <div className="lg:hidden">
                <BlocoPendentes pendentes={pendentes} cadastros={cadastros} join={join} onColar={() => dispatch({ tipo: "ativar", id: null })} />
              </div>
            )}
          </main>

          {/* ações e consultas pendentes */}
          <aside className="sticky top-5 hidden max-h-[calc(100vh-2.5rem)] min-w-0 flex-col gap-4 overflow-y-auto lg:flex">
            <section className="painel space-y-2.5 p-3.5" aria-label="Ações">
              <h3 className="text-[13px] font-semibold">Ações</h3>
              <button
                className="btn-destaque w-full justify-center"
                title="Copia um resumo pronto para o chamado: identificação, situação, valores, diagnóstico e registros ligados"
                onClick={copiarResumo}
              >
                <IconeChamado /> Resumo para chamado
              </button>
              <div className="[&>*]:w-full [&_button]:w-full [&_button]:justify-center">
                <BotaoCopiarChamado
                  dados={dados}
                  tabela={perfil?.tabela}
                  chave={chavesDoSelect(dados, perfil, aba.fixas)}
                  linhas={[registro]}
                  colunas={exibidas}
                  rotulo="Copiar registro"
                  semLinhas="Nenhuma coluna visível"
                />
              </div>
              {navegacao}
              <div className="space-y-1.5 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <input type="checkbox" checked={mostrarVazios} onChange={(e) => setMostrarVazios(e.target.checked)} />
                  Mostrar campos vazios
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <input type="checkbox" checked={mostrarNomes} onChange={(e) => setMostrarNomes(e.target.checked)} />
                  Mostrar nome técnico
                </label>
              </div>
            </section>
            {(pendentes.length > 0 || cadastros.length > 0) && (
              <BlocoPendentes pendentes={pendentes} cadastros={cadastros} join={join} onColar={() => dispatch({ tipo: "ativar", id: null })} />
            )}
          </aside>
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

type ItemNav = { id: string; rotulo: string; contagem: number | null; alerta: boolean };

/** Menu lateral: seções do registro e tabelas ligadas, com a seção visível marcada. */
function NavSecoes({
  className,
  rolagem,
  topo,
  secoes,
  ligados,
  rotuloRegistro,
}: {
  className: string;
  rolagem: React.RefObject<HTMLDivElement | null>;
  topo: ItemNav;
  secoes: ItemNav[];
  ligados: ItemNav[];
  rotuloRegistro?: string;
}) {
  const [ativo, setAtivo] = useState(topo.id);
  const chaveIds = [topo, ...secoes, ...ligados].map((i) => i.id).join("|");

  useEffect(() => {
    const raiz = rolagem.current;
    if (!raiz || typeof IntersectionObserver === "undefined") return;
    const alvos = chaveIds
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((e): e is HTMLElement => e !== null);
    const obs = new IntersectionObserver(
      (entradas) => {
        const visiveis = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visiveis[0]) setAtivo(visiveis[0].target.id);
      },
      { root: raiz, rootMargin: "0px 0px -65% 0px" },
    );
    alvos.forEach((a) => obs.observe(a));
    return () => obs.disconnect();
  }, [rolagem, chaveIds]);

  const irPara = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setAtivo(id);
  };
  const item = (i: ItemNav) => (
    <li key={i.id}>
      <a
        href={`#${i.id}`}
        onClick={(e) => {
          e.preventDefault();
          irPara(i.id);
        }}
        aria-current={ativo === i.id ? "location" : undefined}
        className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition ${
          ativo === i.id
            ? "bg-blue-100/70 font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-200"
            : i.alerta
              ? "text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
        }`}
      >
        <span className="truncate">{i.rotulo}</span>
        {i.contagem !== null && <span className="font-mono text-[11px] tabular-nums opacity-80">{i.contagem}</span>}
      </a>
    </li>
  );
  const titulo = (t: string) => <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">{t}</p>;

  return (
    <nav aria-label="Seções do registro" className={`sticky top-5 max-h-[calc(100vh-2.5rem)] flex-col gap-4 overflow-y-auto ${className}`}>
      <div>
        {titulo(rotuloRegistro ? `Neste ${rotuloRegistro.toLowerCase()}` : "Neste registro")}
        <ul className="space-y-0.5">{[topo, ...secoes].map(item)}</ul>
      </div>
      {ligados.length > 0 && (
        <div>
          {titulo("Ligados")}
          <ul className="space-y-0.5">{ligados.map(item)}</ul>
        </div>
      )}
    </nav>
  );
}

/** Linha do tempo no cabeçalho (ex.: entrada → liberado → faturado → entrega). */
function LinhaEtapas({ etapas }: { etapas: EtapaMontada[] }) {
  return (
    <ol className="flex flex-wrap gap-y-3 border-t border-zinc-100 bg-zinc-50/70 px-5 py-3.5 dark:border-zinc-800 dark:bg-white/[0.02]">
      {etapas.map((e, k) => {
        const ultima = k === etapas.length - 1;
        const proximaFeita = !ultima && etapas[k + 1].feito;
        return (
          <li key={e.nome + k} className="flex min-w-40 flex-1 items-start gap-2.5" title={e.nome}>
            <span
              className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                e.feito ? "bg-emerald-500 text-white" : "border-2 border-dashed border-zinc-400 text-transparent dark:border-zinc-600"
              }`}
              aria-hidden="true"
            >
              ✓
            </span>
            <div className="min-w-0">
              <p className={`text-[13px] font-semibold ${e.feito ? "" : "text-zinc-500"}`}>
                {e.rotulo}
                <span className="sr-only">{e.feito ? " (concluída)" : " (pendente)"}</span>
              </p>
              <p className="truncate font-mono text-[11px] text-zinc-500">{e.detalhe || (e.feito ? "" : "pendente")}</p>
            </div>
            {!ultima && (
              <span
                className={`mt-[10px] mr-3 h-0.5 min-w-4 flex-1 rounded ${e.feito && proximaFeita ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

const CORES: Record<CorStatus, string> = {
  verde: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  amarelo: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  vermelho: "bg-red-100 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-900",
  azul: "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900",
  cinza: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
};

const CORES_INDICADOR: Record<CorStatus, { caixa: string; valor: string }> = {
  azul: { caixa: "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40", valor: "text-blue-900 dark:text-blue-100" },
  verde: { caixa: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40", valor: "text-emerald-900 dark:text-emerald-100" },
  amarelo: { caixa: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40", valor: "text-amber-900 dark:text-amber-100" },
  vermelho: { caixa: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40", valor: "text-red-900 dark:text-red-100" },
  cinza: { caixa: "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900", valor: "text-zinc-500" },
};

/** Indicador do cabeçalho (ex.: liberações): valor com os detalhes na mesma linha. */
function Indicador({ indicador: { campo: c, detalhes, cor } }: { indicador: IndicadorMontado }) {
  const estilo = CORES_INDICADOR[cor];
  const detalhesVisiveis = detalhes.filter((d) => !d.vazio);
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border px-3 py-1.5 text-sm ${estilo.caixa}`} title={c.nome}>
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{c.rotulo}</span>
      <span className={`font-semibold break-words ${estilo.valor}`}>
        {c.texto === null ? <span className="valor-null">NULL</span> : c.raw?.trim() === "" ? "não informado" : c.texto}
      </span>
      {detalhesVisiveis.map((d) => (
        <span key={`${d.j}-${d.nome}`} title={d.nome} className="text-xs text-zinc-600 dark:text-zinc-400">
          {d.rotulo}: <span className="font-medium text-zinc-800 dark:text-zinc-200">{d.texto}</span>
        </span>
      ))}
    </div>
  );
}

/** Coluna-chave em destaque no cabeçalho (ex.: NUMPOK do pedido). */
function BlocoChave({ campo: c, onCopiar }: { campo: CampoMontado; onCopiar: (rotulo: string, raw: string | null) => void }) {
  const semValor = c.raw === null || c.raw.trim() === "";
  return (
    <div
      className={`w-full rounded-xl border px-4 py-3 sm:w-auto sm:min-w-72 ${
        semValor
          ? "border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          : "border-amber-300 bg-amber-50 dark:border-amber-700/70 dark:bg-amber-950/40"
      }`}
      title={c.nome}
    >
      <p className="flex items-center justify-between gap-3 text-[11px] font-bold tracking-wider text-amber-800 uppercase dark:text-amber-300">
        <span className="inline-flex items-center gap-2">
          {c.rotulo}
          <span className="tracking-normal normal-case">
            <SeloMarketplace valor={c.raw} />
          </span>
        </span>
        <span className="font-mono text-[10px] font-normal tracking-normal text-amber-800/70 normal-case dark:text-amber-300/70">{c.nome}</span>
      </p>
      <div className="mt-1 flex items-center gap-2">
        {semValor ? (
          <span className="text-lg text-zinc-400">{c.raw === null ? <span className="valor-null">NULL</span> : "não informado"}</span>
        ) : (
          <>
            <span className="font-mono text-xl font-semibold tracking-tight text-amber-950 dark:text-amber-100">{c.raw}</span>
            <button className="btn-icone" title={`Copiar ${c.rotulo}`} aria-label={`Copiar ${c.nome}`} onClick={() => onCopiar(c.nome, c.raw)}>
              <IconeCopiar />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ChipStatus({ cor, titulo, children }: { cor: CorStatus; titulo: string; children: React.ReactNode }) {
  return (
    <span title={titulo} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${CORES[cor]}`}>
      {children}
    </span>
  );
}

function Secao({
  id,
  secao,
  mostrarVazios,
  mostrarNomes,
  inicialAberta,
  onCopiar,
}: {
  id: string;
  secao: SecaoMontada;
  mostrarVazios: boolean;
  mostrarNomes: boolean;
  inicialAberta: boolean;
  onCopiar: (rotulo: string, raw: string | null) => void;
}) {
  const [aberta, setAberta] = useState(inicialAberta);
  const visiveis = mostrarVazios ? secao.campos : secao.campos.filter((c) => !c.vazio);
  const ocultos = secao.campos.length - visiveis.length;

  if (visiveis.length === 0) {
    return (
      <section
        id={id}
        data-secao
        className="flex scroll-mt-4 items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-2 text-sm text-zinc-500 dark:border-zinc-800"
      >
        <span className="font-medium">{secao.titulo}</span>
        <span className="text-xs">· {secao.campos.length} campo(s), todos vazios ou zerados</span>
      </section>
    );
  }

  return (
    <section id={id} data-secao className="painel scroll-mt-4">
      <button className="flex w-full items-center gap-2 px-4 py-3 text-left" onClick={() => setAberta(!aberta)} aria-expanded={aberta}>
        <IconeSeta className={`h-4 w-4 text-zinc-500 transition ${aberta ? "" : "-rotate-90"}`} />
        <h3 className="text-sm font-semibold">{secao.titulo}</h3>
        <span className="text-xs text-zinc-500 tabular-nums">
          {visiveis.length} campo(s){ocultos > 0 && ` · ${ocultos} vazio(s) oculto(s)`}
        </span>
      </button>
      {aberta && (
        <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-zinc-100 px-4 pt-3.5 pb-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 dark:border-zinc-800">
          {visiveis.map((c) => (
            <Campo key={`${c.j}-${c.nome}`} campo={c} mostrarNome={mostrarNomes} onCopiar={onCopiar} />
          ))}
        </dl>
      )}
    </section>
  );
}

/** Campo em modo leitura: rótulo em cima, valor embaixo, nome técnico discreto à direita. */
function Campo({
  campo: c,
  mostrarNome,
  onCopiar,
}: {
  campo: CampoMontado;
  mostrarNome: boolean;
  onCopiar: (rotulo: string, raw: string | null) => void;
}) {
  const bloco = c.texto !== null && c.texto.includes("\n");
  return (
    <div className={`group min-w-0 ${c.largo || bloco ? "sm:col-span-2" : ""}`}>
      <dt className="flex items-baseline justify-between gap-2 text-xs text-zinc-500">
        <span className="truncate" title={c.rotulo}>
          {c.rotulo}
        </span>
        {/* campo de dentro do JSON: só a última parte do caminho (o caminho inteiro fica na dica) */}
        {mostrarNome && (
          <span className="shrink-0 font-mono text-[10px] text-zinc-500/80" title={c.nome}>
            {c.nome.replace(/^.*\./, "")}
          </span>
        )}
      </dt>
      <dd className="m-0 mt-0.5 flex min-w-0 items-start gap-1" title={c.raw === null ? "NULL" : c.raw}>
        {bloco ? (
          <pre className="max-h-80 min-w-0 flex-1 overflow-auto rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap dark:bg-white/5">
            {c.texto}
          </pre>
        ) : (
          <span
            className={`min-w-0 text-sm break-words ${c.vazio ? "text-zinc-500" : "font-medium text-zinc-900 dark:text-zinc-100"} ${
              c.numerico ? "tabular-nums" : ""
            }`}
          >
            {c.texto === null ? <span className="valor-null">NULL</span> : c.texto === "" ? <span className="valor-null">vazio</span> : c.texto}
          </span>
        )}
        <button
          className="btn-icone -my-0.5 h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Copiar valor original"
          aria-label={`Copiar ${c.nome}`}
          onClick={() => onCopiar(c.nome, c.raw)}
        >
          <IconeCopiar className="h-3.5 w-3.5" />
        </button>
      </dd>
    </div>
  );
}

const MAX_LINHAS_BLOCO = 200;

/**
 * Registros ligados de outra aba. Uma linha vira cartão de leitura; várias linhas
 * (ou `tabela`) viram grade com totais; nenhuma linha vira um aviso discreto.
 */
function BlocoLigado({
  id,
  rel,
  abas,
  tabela = false,
  onAbrir,
}: {
  id: string;
  rel: Relacionado;
  abas: Aba[];
  tabela?: boolean;
  onAbrir: (linha?: number) => void;
}) {
  const destino = abas.find((a) => a.id === rel.abaId);
  const linhas = useMemo(
    () => (destino && rel.chave !== null ? linhasLigadas(rel.chave, destino.dados.linhas, rel.colunaDestino, extrasLigacao(rel.extras)) : []),
    [destino, rel.chave, rel.colunaDestino, rel.extras],
  );
  const colunas = useMemo(() => (destino ? colunasExibidas(destino) : []), [destino]);
  if (!destino) return null;
  const { dados } = destino;
  const ligacao = `${rel.colunaDestinoNome} = ${rel.chave ?? "NULL"}${rel.extras.map((e) => ` · ${e.nome} = ${e.chave ?? "NULL"}`).join("")}`;

  const cabecalho = (
    <div className="flex flex-wrap items-center gap-2">
      <IconeLink className="h-4 w-4 text-violet-500" />
      <h3 className="text-sm font-semibold">{rel.rotulo}</h3>
      <span className="rounded-full bg-violet-100 px-2 text-xs text-violet-800 tabular-nums dark:bg-violet-950 dark:text-violet-300">
        {linhas.length}
      </span>
      <span className="min-w-0 truncate font-mono text-[10px] text-zinc-500" title={`${ligacao} · aba ${destino.nome}`}>
        {destino.nome} · {ligacao}
      </span>
      {linhas.length > 0 && (
        <button className="ml-auto text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={() => onAbrir()}>
          Abrir na aba
        </button>
      )}
    </div>
  );

  if (linhas.length === 0) {
    return (
      <section
        id={id}
        data-secao
        className="flex scroll-mt-4 flex-wrap items-center gap-2 rounded-xl border border-dashed border-red-300 bg-red-50/60 px-4 py-3 text-sm sm:col-span-2 dark:border-red-900 dark:bg-red-950/20"
      >
        <IconeLink className="h-4 w-4 text-red-500" />
        <h3 className="font-semibold text-red-800 dark:text-red-300">{rel.rotulo}</h3>
        <span className="font-mono text-[10px] text-red-800/80 dark:text-red-300/80">
          {destino.nome} · {ligacao}
        </span>
        <span className="text-red-800 dark:text-red-300">Nenhum registro ligado.</span>
      </section>
    );
  }

  if (linhas.length === 1 && !tabela) {
    const i = linhas[0];
    const preenchidas = colunas.filter((j) => {
      const v = dados.linhas[i][j];
      return v !== null && v.trim() !== "" && dados.colunas[j].nome !== rel.colunaDestinoNome;
    });
    const mostradas = preenchidas.slice(0, 8);
    return (
      <section id={id} data-secao className="painel scroll-mt-4 px-4 py-3">
        {cabecalho}
        <button className="mt-2.5 block w-full text-left" onClick={() => onAbrir(i)} title="Abrir este registro">
          <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-2.5 md:grid-cols-3">
            {mostradas.map((j) => {
              const longo = (dados.linhas[i][j]?.length ?? 0) > 40;
              return (
                <div key={j} className={`min-w-0 ${longo ? "col-span-2 md:col-span-3" : ""}`}>
                  <dt className="truncate font-mono text-[10px] text-zinc-500">{dados.colunas[j].nome}</dt>
                  <dd className="m-0 truncate text-sm font-medium">
                    <Celula valor={dados.linhas[i][j]} tipo={dados.colunas[j].tipo} />
                  </dd>
                </div>
              );
            })}
          </dl>
          {preenchidas.length > mostradas.length && (
            <p className="mt-2 text-xs text-zinc-500">+ {preenchidas.length - mostradas.length} coluna(s) — abra a aba para ver tudo</p>
          )}
        </button>
      </section>
    );
  }

  const perfilDestino = buscarPerfil(destino.perfilId);
  const saldo = perfilDestino?.saldo ? calcularSaldo(dados, linhas, perfilDestino.saldo) : null;
  const decimais = colunas.filter((j) => {
    const c = dados.colunas[j];
    if (perfilDestino?.totais) return perfilDestino.totais.includes(c.nome) && (c.tipo === "decimal" || c.tipo === "inteiro");
    return c.tipo === "decimal";
  });
  const totais = new Map(decimais.map((j) => [j, linhas.reduce((s, i) => s + (Number(dados.linhas[i][j]) || 0), 0)] as const));

  return (
    <section id={id} data-secao className="painel scroll-mt-4 overflow-hidden sm:col-span-2">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">{cabecalho}</div>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-left dark:bg-zinc-900">
            <tr>
              {colunas.map((j) => (
                <th key={j} className={`px-3 py-1.5 font-mono text-[11px] font-semibold whitespace-nowrap text-zinc-600 dark:text-zinc-400 ${alinhamento(dados.colunas[j].tipo)}`}>
                  {dados.colunas[j].nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.slice(0, MAX_LINHAS_BLOCO).map((i) => (
              <tr
                key={i}
                onClick={() => onAbrir(i)}
                title="Abrir este registro"
                className="cursor-pointer border-t border-zinc-100 hover:bg-blue-50/60 dark:border-zinc-800 dark:hover:bg-white/5"
              >
                {colunas.map((j) => (
                  <td key={j} className={`px-3 py-2 whitespace-nowrap ${alinhamento(dados.colunas[j].tipo)}`}>
                    <Celula valor={dados.linhas[i][j]} tipo={dados.colunas[j].tipo} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {decimais.length > 0 && linhas.length > 1 && (
            <tfoot className="sticky bottom-0 border-t border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-700 dark:bg-zinc-900">
              <tr>
                {colunas.map((j, k) => (
                  <td key={j} className={`px-3 py-1.5 whitespace-nowrap ${alinhamento(dados.colunas[j].tipo)}`}>
                    {totais.has(j) ? formatarNumero(totais.get(j)!, dados.colunas[j].casas) : k === 0 ? "Total" : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {saldo && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900">
            <span>
              Créditos: <strong className="text-emerald-700 dark:text-emerald-400">{moedaBR(saldo.creditos)}</strong>
            </span>
            <span>
              Débitos: <strong className="text-red-700 dark:text-red-400">{moedaBR(saldo.debitos)}</strong>
            </span>
            <span className="rounded-md bg-white px-2 py-0.5 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-700">
              Saldo:{" "}
              <strong className={saldo.saldo < 0 ? "text-red-700 dark:text-red-400" : saldo.saldo > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}>
                {moedaBR(saldo.saldo)}
              </strong>
            </span>
          </div>
        )}
        {linhas.length > MAX_LINHAS_BLOCO && (
          <p className="px-4 py-2 text-xs text-zinc-500">
            Mostrando {MAX_LINHAS_BLOCO} de {linhas.length}. Abra a aba para ver todos.
          </p>
        )}
      </div>
    </section>
  );
}

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moedaBR = (n: number) => FORMATO_MOEDA.format(n);

/** Relações do perfil sem aba aberta: sugere a consulta para colar (coluna da direita). */
function BlocoPendentes({
  pendentes,
  cadastros,
  join,
  onColar,
}: {
  pendentes: RelacaoPendente[];
  cadastros: CadastroPendente[];
  join: string | null;
  onColar: () => void;
}) {
  const [verJoin, setVerJoin] = useState(false);
  const [verCadastros, setVerCadastros] = useState(false);
  const [aviso, setAviso] = useAviso();
  const copiar = async (sql: string, msg: string) => setAviso((await copiarTexto(sql)) ? msg : "Não foi possível copiar");

  const item = (chave: string, rotulo: string, sql: string | null, motivo?: React.ReactNode, dica?: string) => (
    <li key={chave} className="rounded-lg border border-zinc-200 bg-white/70 px-2.5 py-2 dark:border-zinc-800 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium" title={dica}>
          {rotulo}
        </span>
        {sql && (
          <button className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300" onClick={() => copiar(sql, "SQL copiado")}>
            Copiar
          </button>
        )}
      </div>
      {sql ? (
        <SqlEmLinha sql={sql} className="mt-1 line-clamp-2 block font-mono text-[11px] break-all text-zinc-600 dark:text-zinc-400" />
      ) : (
        <p className="mt-1 text-[11px] text-zinc-500">{motivo}</p>
      )}
    </li>
  );

  return (
    <section className="painel space-y-2.5 p-3.5" aria-label="Consultas pendentes">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold">Consultas pendentes</h3>
        <span className="rounded-full bg-zinc-100 px-2 text-xs text-zinc-600 tabular-nums dark:bg-white/10 dark:text-zinc-300">
          {pendentes.length + cadastros.length}
        </span>
        {aviso && <span className="ml-auto text-xs text-emerald-700 dark:text-emerald-400">{aviso}</span>}
      </div>
      <p className="-mt-1 text-xs text-zinc-500">Execute no MySQL e cole o resultado numa nova aba.</p>
      {pendentes.length > 0 && (
        <ul className="space-y-1.5">
          {pendentes.map((p) =>
            p.chave === null
              ? item(
                  `${p.perfilDestino}-${p.colunaOrigem}`,
                  p.rotulo,
                  null,
                  <>
                    Sem consulta: <span className="font-mono">{p.colunaOrigem}</span> está vazio neste registro
                  </>,
                )
              : item(`${p.perfilDestino}-${p.colunaOrigem}`, p.rotulo, sqlRelacionado(p.tabela, p.colunaDestino, p.chave, p.extras)),
          )}
        </ul>
      )}
      {join && (
        <div className="space-y-1.5">
          <button className="btn-destaque w-full justify-center" onClick={() => copiar(join, "JOIN copiado")} title="Uma consulta só; ao colar o resultado, cada tabela abre na sua aba, sem linhas repetidas">
            <IconeCopiar className="h-3.5 w-3.5" /> Copiar tudo (JOIN)
          </button>
          <button className="w-full text-center text-xs text-violet-700 hover:underline dark:text-violet-300" onClick={() => setVerJoin(!verJoin)}>
            {verJoin ? "Ocultar SQL do JOIN" : "Ver SQL do JOIN"}
          </button>
          {verJoin && <CodigoSql sql={join} className="max-h-72 overflow-auto rounded-lg bg-zinc-100 p-2 text-[11px] dark:bg-zinc-950" />}
        </div>
      )}
      <button className="btn w-full justify-center" onClick={onColar}>
        <IconeMais className="h-3.5 w-3.5" /> Colar resultado
      </button>
      {cadastros.length > 0 && (
        <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <button
            className="flex w-full items-center gap-1 text-xs font-semibold tracking-wide text-zinc-600 uppercase hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            onClick={() => setVerCadastros(!verCadastros)}
            aria-expanded={verCadastros}
          >
            <IconeSeta className={`h-3.5 w-3.5 transition ${verCadastros ? "" : "-rotate-90"}`} /> Cadastros ({cadastros.length})
          </button>
          {verCadastros && (
            <ul className="mt-1.5 space-y-1.5">
              {cadastros.map((c) =>
                item(
                  `${c.tabela}-${c.colunas[0]}`,
                  c.rotulo,
                  sqlRelacionado(c.tabela, c.colunaTabela, c.chave),
                  undefined,
                  c.papeis.map((p, k) => `${p} (${c.colunas[k]})`).join("\n"),
                ),
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Lista lateral de registros (virtualizada), respeitando filtro e ordenação. */
export function ListaRegistros({
  aba,
  abas,
  indices,
  atual,
  onEscolher,
}: {
  aba: Aba;
  abas: Aba[];
  indices: number[];
  atual: number;
  onEscolher: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const perfil = buscarPerfil(aba.perfilId);
  const temChave = useMemo(() => colunaDestaque(aba.dados.colunas, perfil) !== null, [aba.dados.colunas, perfil]);
  const virt = useVirtualizer({ count: indices.length, getScrollElement: () => ref.current, estimateSize: () => (temChave ? 66 : 52), overscan: 8 });
  const pos = indices.indexOf(atual);

  // nível do diagnóstico por registro (bolinha colorida), calculado só para os visíveis e guardado
  const comDiagnostico = temDiagnostico(aba.perfilId);
  const cacheNivel = useMemo(() => new Map<number, ReturnType<typeof nivelGeral>>(), [aba.dados, aba.perfilId, abas]); // eslint-disable-line react-hooks/exhaustive-deps
  const nivelDe = (i: number) => {
    if (!comDiagnostico) return null;
    if (!cacheNivel.has(i)) cacheNivel.set(i, nivelGeral(diagnosticar(aba, i, abas)));
    return cacheNivel.get(i) ?? null;
  };

  // mantém o registro atual visível ao navegar com Anterior/Próximo
  useEffect(() => {
    if (pos >= 0) virt.scrollToIndex(pos, { align: "auto" });
  }, [pos, virt]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900">
      <p className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
        {indices.length.toLocaleString("pt-BR")} registro(s)
      </p>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: virt.getTotalSize() }}>
          {virt.getVirtualItems().map((v) => {
            const i = indices[v.index];
            const r = resumoRegistro(aba.dados, i, perfil);
            const ativo = i === atual;
            return (
              <button
                key={i}
                onClick={() => onEscolher(i)}
                className={`absolute top-0 left-0 flex w-full flex-col justify-center border-b border-l-4 border-zinc-100 px-3 text-left dark:border-b-zinc-800 ${
                  ativo
                    ? "border-l-blue-600 bg-blue-50 dark:bg-blue-950/60"
                    : "border-l-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                }`}
                style={{ height: temChave ? 66 : 52, transform: `translateY(${v.start}px)` }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-sm font-medium">{r.titulo}</span>
                  {(() => {
                    const n = nivelDe(i);
                    return n && n !== "ok" && n !== "info" ? (
                      <span className={`ml-auto h-2.5 w-2.5 shrink-0 rounded-full ${ESTILO_NIVEL[n].ponto}`} title={`Diagnóstico: ${ESTILO_NIVEL[n].rotulo}`} />
                    ) : null;
                  })()}
                </span>
                <span className="truncate text-xs text-zinc-500">{r.detalhe}</span>
                {r.chave && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">{r.chave}</span>
                    <SeloMarketplace valor={r.valorChave} compacto />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
